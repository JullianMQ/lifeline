import { Hono } from "hono";
import { auth } from "../lib/auth";
import { z } from "zod";
import { rooms, broadcastToRoom, clients } from "./websocket";
import { dbPool } from "../lib/db";

type User = NonNullable<typeof auth.$Infer.Session.user>;

const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timestamp: z.string().or(z.number()),
    accuracy: z.number().optional(),
    formattedLocation: z.string().trim().optional(),
    roomId: z.string().optional()
});

const LOCATION_TIMEZONE = process.env.LOCATION_TIMEZONE || "Asia/Singapore";
const DEFAULT_RETENTION_DAYS = Number(process.env.LOCATION_RETENTION_DAYS ?? 3);

function getRetentionDays(_user: User): number {
    if (Number.isNaN(DEFAULT_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS <= 0) {
        return 3;
    }
    return DEFAULT_RETENTION_DAYS;
}

function parseTimestamp(value: string | number): Date | null {
    const parsed = typeof value === "number" ? new Date(value) : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

const router = new Hono<{ Variables: { user: User } }>({
    strict: false,
});

router.use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", session.user);
    return next();
});

router.post("/location", async (c) => {
    const user = c.get("user");
    const body = await c.req.json();

    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: "Invalid location data", details: parsed.error.issues }, 400);
    }

    const { latitude, longitude, timestamp, accuracy, formattedLocation, roomId } = parsed.data;
    const userPhone = user.phone_no;

    if (!userPhone) {
        return c.json({ error: "User phone number not available" }, 400);
    }

    const recordedAt = parseTimestamp(timestamp);
    if (!recordedAt) {
        return c.json({ error: "Invalid timestamp" }, 400);
    }

    const timestampStr = recordedAt.toISOString();

    const userRoomIds: string[] = [];

    // If roomId is provided, validate and use it (for disconnected mobile users)
    if (roomId) {
        const room = rooms.get(roomId);
        if (!room) {
            return c.json({ error: "Room not found" }, 404);
        }
        
        // Verify user is the owner or an emergency contact of this room (by phone number)
        const ownerClient = clients.get(room.owner);
        const isOwner = ownerClient?.user?.phone_no === userPhone;
        const isEmergencyContact = room.emergencyContacts.includes(userPhone);
        
        if (!isOwner && !isEmergencyContact) {
            return c.json({ error: "User is not authorized to broadcast to this room" }, 403);
        }
        
        userRoomIds.push(roomId);
    } else {
        // Find rooms where user is authorized (by phone number)
        rooms.forEach((room, rid) => {
            const ownerClient = clients.get(room.owner);
            const isOwner = ownerClient?.user?.phone_no === userPhone;
            const isEmergencyContact = room.emergencyContacts.includes(userPhone);
            
            if (isOwner || isEmergencyContact) {
                userRoomIds.push(rid);
            }
        });

        if (userRoomIds.length === 0) {
            return c.json({ error: "User is not in any active room. Provide roomId for disconnected location updates." }, 400);
        }
    }

    const retentionDays = getRetentionDays(user);
    const client = await dbPool.connect();

    try {
        await client.query("BEGIN");

        await client.query(
            `INSERT INTO user_locations (
                user_id, latitude, longitude, formatted_location, recorded_at
            ) VALUES ($1, $2, $3, $4, $5)`,
            [user.id, latitude, longitude, formattedLocation || null, recordedAt]
        );

        await client.query(
            `WITH day_list AS (
                SELECT DISTINCT (recorded_at AT TIME ZONE $2)::date AS day
                FROM user_locations
                WHERE user_id = $1
            ),
            ordered_days AS (
                SELECT day
                FROM day_list
                ORDER BY day DESC
            ),
            days_to_delete AS (
                SELECT day
                FROM ordered_days
                OFFSET $3
            )
            DELETE FROM user_locations ul
            USING days_to_delete d
            WHERE ul.user_id = $1
              AND (ul.recorded_at AT TIME ZONE $2)::date = d.day`,
            [user.id, LOCATION_TIMEZONE, retentionDays]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Failed to save location:", error);
        return c.json({ error: "Failed to save location" }, 500);
    } finally {
        client.release();
    }

    const locationMessage = {
        type: "location-update",
        data: {
            visiblePhone: userPhone,
            userName: user.name,
            latitude,
            longitude,
            timestamp: timestampStr,
            accuracy
        },
        timestamp: new Date().toISOString()
    };

    userRoomIds.forEach(roomId => {
        broadcastToRoom(roomId, locationMessage);
    });

    return c.json({
        success: true,
        timestamp: timestampStr,
        rooms: userRoomIds
    });
}).basePath("/api");

router.get("/locations", async (c) => {
    const user = c.get("user");
    const retentionDays = getRetentionDays(user);

    try {
        const result = await dbPool.query(
            `WITH cutoff AS (
                SELECT ((now() AT TIME ZONE $2)::date - ($3 - 1))::date AS day
            )
            SELECT id, user_id, latitude, longitude, formatted_location, recorded_at, created_at
            FROM user_locations
            WHERE user_id = $1
              AND (recorded_at AT TIME ZONE $2)::date >= (SELECT day FROM cutoff)
            ORDER BY recorded_at DESC`,
            [user.id, LOCATION_TIMEZONE, retentionDays]
        );

        const locations = result.rows.map(row => ({
            id: row.id,
            user_id: row.user_id,
            latitude: row.latitude,
            longitude: row.longitude,
            formatted_location: row.formatted_location,
            timestamp: row.recorded_at,
            created_at: row.created_at
        }));

        return c.json({ locations });
    } catch (error) {
        console.error("Failed to fetch locations:", error);
        return c.json({ error: "Failed to fetch locations" }, 500);
    }
}).basePath("/api");

router.get("/locations/contacts", async (c) => {
    const user = c.get("user");
    const userPhone = user.phone_no;
    if (!userPhone) {
        return c.json({ locations: [] });
    }

    const retentionDays = getRetentionDays(user);

    try {
        const result = await dbPool.query(
            `WITH cutoff AS (
                SELECT ((now() AT TIME ZONE $2)::date - ($3 - 1))::date AS day
            )
            SELECT ul.id, ul.user_id, ul.latitude, ul.longitude, ul.formatted_location,
                   ul.recorded_at, ul.created_at, u.name as user_name, u.phone_no as user_phone
            FROM user_locations ul
            JOIN "user" u ON ul.user_id = u.id
            JOIN contacts c ON c.user_id = u.id
            WHERE $1 = ANY(c.emergency_contacts)
              AND (ul.recorded_at AT TIME ZONE $2)::date >= (SELECT day FROM cutoff)
            ORDER BY ul.recorded_at DESC`,
            [userPhone, LOCATION_TIMEZONE, retentionDays]
        );

        const locationsByUser: Record<string, {
            user_name: string | null;
            user_phone: string | null;
            locations: Array<{
                id: number;
                latitude: number;
                longitude: number;
                formatted_location: string | null;
                timestamp: string;
                created_at: string;
            }>;
        }> = {};

        result.rows.forEach(row => {
            if (!locationsByUser[row.user_id]) {
                locationsByUser[row.user_id] = {
                    user_name: row.user_name,
                    user_phone: row.user_phone,
                    locations: []
                };
            }

            locationsByUser[row.user_id].locations.push({
                id: row.id,
                latitude: row.latitude,
                longitude: row.longitude,
                formatted_location: row.formatted_location,
                timestamp: row.recorded_at,
                created_at: row.created_at
            });
        });

        return c.json({
            locations_by_user: locationsByUser
        });
    } catch (error) {
        console.error("Failed to fetch contact locations:", error);
        return c.json({ error: "Failed to fetch contact locations" }, 500);
    }
}).basePath("/api");

export default router;
