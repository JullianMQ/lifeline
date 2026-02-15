import { Hono } from "hono";
import { auth } from "../lib/auth";
import { z } from "zod";
import { rooms, broadcastToRoom, clients } from "./websocket";
import { sendEmergencyAlertEmail } from "../lib/email";
import { dbPool } from "../lib/db";

type User = NonNullable<typeof auth.$Infer.Session.user>;

const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timestamp: z.string().or(z.number()),
    accuracy: z.number().optional(),
    formattedLocation: z.string().trim().optional(),
    roomId: z.string().optional(),
    sos: z.boolean().optional()
});

const sosSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    formattedLocation: z.string().trim().optional(),
    timestamp: z.string().or(z.number()).optional(),
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

function parseNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

async function insertLocationWithRetention(
    userId: string,
    latitude: number,
    longitude: number,
    formattedLocation: string | null,
    sos: boolean,
    acknowledged: boolean,
    recordedAt: Date,
    retentionDays: number
): Promise<void> {
    const client = await dbPool.connect();

    try {
        await client.query("BEGIN");

        await client.query(
            `INSERT INTO user_locations (
                user_id, latitude, longitude, formatted_location, sos, acknowledged, recorded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, latitude, longitude, formattedLocation, sos, acknowledged, recordedAt]
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
            [userId, LOCATION_TIMEZONE, retentionDays]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

function extractSosLocation(data: any): { formattedLocation: string | null; latitude: number | null; longitude: number | null } {
    const formattedLocation =
        (typeof data?.formattedLocation === "string" && data.formattedLocation.trim()) ||
        (typeof data?.formatted_location === "string" && data.formatted_location.trim()) ||
        (typeof data?.location?.formattedLocation === "string" && data.location.formattedLocation.trim()) ||
        (typeof data?.location?.formatted_location === "string" && data.location.formatted_location.trim()) ||
        (typeof data?.location?.address === "string" && data.location.address.trim()) ||
        (typeof data?.address === "string" && data.address.trim()) ||
        null;

    const latitude =
        parseNumber(data?.latitude) ??
        parseNumber(data?.lat) ??
        parseNumber(data?.location?.latitude) ??
        parseNumber(data?.location?.lat) ??
        null;
    const longitude =
        parseNumber(data?.longitude) ??
        parseNumber(data?.long) ??
        parseNumber(data?.lng) ??
        parseNumber(data?.location?.longitude) ??
        parseNumber(data?.location?.lng) ??
        null;

    return {
        formattedLocation,
        latitude,
        longitude
    };
}

type EmergencyContactEmail = {
    email: string;
    name: string | null;
};

async function getEmergencyContactEmails(userId: string): Promise<EmergencyContactEmail[]> {
    try {
        const result = await dbPool.query(`
            SELECT c.emergency_contacts
            FROM contacts c
            WHERE c.user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return [];
        }

        const emergencyPhones: string[] = result.rows[0].emergency_contacts || [];
        if (emergencyPhones.length === 0) {
            return [];
        }

        const userResult = await dbPool.query(`
            SELECT name, email, phone_no
            FROM "user"
            WHERE phone_no = ANY($1)
        `, [emergencyPhones]);

        const byPhone = new Map<string, { name: string | null; email: string | null }>();
        for (const row of userResult.rows) {
            byPhone.set(row.phone_no, { name: row.name, email: row.email });
        }

        const emails: EmergencyContactEmail[] = [];
        for (const phone of emergencyPhones) {
            const record = byPhone.get(phone);
            if (record?.email) {
                emails.push({ email: record.email, name: record.name });
            }
        }

        return emails;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching emergency contact emails for user ${userId}:`, error);
        return [];
    }
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

    const { latitude, longitude, timestamp, accuracy, formattedLocation, roomId, sos } = parsed.data;
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

    try {
        await insertLocationWithRetention(
            user.id,
            latitude,
            longitude,
            formattedLocation || null,
            sos === true,
            false,
            recordedAt,
            retentionDays
        );
    } catch (error) {
        console.error("Failed to save location:", error);
        return c.json({ error: "Failed to save location" }, 500);
    }

    const locationMessage = {
        type: "location-update",
        data: {
            visiblePhone: userPhone,
            userName: user.name,
            latitude,
            longitude,
            timestamp: timestampStr,
            accuracy,
            sos: sos === true
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
});

router.post("/sos", async (c) => {
    const user = c.get("user");
    const body = await c.req.json();

    const { formattedLocation, latitude, longitude } = extractSosLocation(body);
    const parsed = sosSchema.safeParse({
        latitude,
        longitude,
        formattedLocation: formattedLocation || undefined,
        timestamp: body?.timestamp,
        roomId: body?.roomId
    });

    if (!parsed.success) {
        return c.json({ error: "Invalid SOS data", details: parsed.error.issues }, 400);
    }

    const userPhone = user.phone_no;
    if (!userPhone) {
        return c.json({ error: "User phone number not available" }, 400);
    }

    const recordedAt = parsed.data.timestamp ? parseTimestamp(parsed.data.timestamp) : new Date();
    if (!recordedAt) {
        return c.json({ error: "Invalid timestamp" }, 400);
    }

    const userRoomIds: string[] = [];
    if (parsed.data.roomId) {
        const room = rooms.get(parsed.data.roomId);
        if (!room) {
            return c.json({ error: "Room not found" }, 404);
        }

        const ownerClient = clients.get(room.owner);
        const isOwner = ownerClient?.user?.phone_no === userPhone;
        const isEmergencyContact = room.emergencyContacts.includes(userPhone);

        if (!isOwner && !isEmergencyContact) {
            return c.json({ error: "User is not authorized to broadcast to this room" }, 403);
        }

        userRoomIds.push(parsed.data.roomId);
    } else {
        rooms.forEach((room, rid) => {
            const ownerClient = clients.get(room.owner);
            const isOwner = ownerClient?.user?.phone_no === userPhone;
            const isEmergencyContact = room.emergencyContacts.includes(userPhone);

            if (isOwner || isEmergencyContact) {
                userRoomIds.push(rid);
            }
        });

        if (userRoomIds.length === 0) {
            return c.json({ error: "User is not in any active room. Provide roomId for disconnected SOS." }, 400);
        }
    }

    const retentionDays = getRetentionDays(user);

    try {
        await insertLocationWithRetention(
            user.id,
            parsed.data.latitude,
            parsed.data.longitude,
            parsed.data.formattedLocation || null,
            true,
            false,
            recordedAt,
            retentionDays
        );
    } catch (error) {
        console.error("Failed to save SOS location:", error);
        return c.json({ error: "Failed to save SOS" }, 500);
    }

    const timestampStr = recordedAt.toISOString();
    const locationMessage = {
        type: "location-update",
        data: {
            visiblePhone: userPhone,
            userName: user.name,
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
            timestamp: timestampStr,
            accuracy: null,
            sos: true
        },
        timestamp: new Date().toISOString()
    };

    userRoomIds.forEach(roomId => {
        broadcastToRoom(roomId, locationMessage);
    });

    const emergencyEmails = await getEmergencyContactEmails(user.id);
    if (emergencyEmails.length > 0) {
        const triggeredAt = new Date();
        await Promise.allSettled(
            emergencyEmails.map(contact =>
                sendEmergencyAlertEmail({
                    toEmail: contact.email,
                    toName: contact.name,
                    emergencyUserName: user?.name || null,
                    emergencyUserPhone: user?.phone_no || null,
                    formattedLocation: parsed.data.formattedLocation || null,
                    latitude: parsed.data.latitude,
                    longitude: parsed.data.longitude,
                    triggeredAt
                })
            )
        );
    }

    return c.json({
        success: true,
        timestamp: timestampStr,
        rooms: userRoomIds
    });
});

router.get("/locations", async (c) => {
    const user = c.get("user");
    const retentionDays = getRetentionDays(user);

    try {
        const result = await dbPool.query(
            `WITH cutoff AS (
                SELECT ((now() AT TIME ZONE $2)::date - ($3 - 1))::date AS day
            )
            SELECT id, user_id, latitude, longitude, formatted_location, sos, acknowledged, recorded_at, created_at
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
            sos: row.sos,
            acknowledged: row.acknowledged,
            timestamp: row.recorded_at,
            created_at: row.created_at
        }));

        return c.json({ locations });
    } catch (error) {
        console.error("Failed to fetch locations:", error);
        return c.json({ error: "Failed to fetch locations" }, 500);
    }
});

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
                   ul.sos, ul.acknowledged, ul.recorded_at, ul.created_at, u.name as user_name, u.phone_no as user_phone
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
                sos: boolean;
                acknowledged: boolean;
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
                sos: row.sos,
                acknowledged: row.acknowledged,
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
});

router.patch("/locations/:id/acknowledge", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const locationId = Number.parseInt(id, 10);
    const userPhone = user.phone_no;

    if (!Number.isFinite(locationId)) {
        return c.json({ error: "Invalid location id" }, 400);
    }

    try {
        const result = await dbPool.query(
            `UPDATE user_locations ul
             SET acknowledged = true
             FROM contacts c
             WHERE ul.id = $1
               AND (
                 ul.user_id = $2
                 OR (
                   $3::text IS NOT NULL
                   AND c.user_id = ul.user_id
                   AND $3::text = ANY(c.emergency_contacts)
                 )
               )
             RETURNING ul.id, ul.acknowledged`,
            [locationId, user.id, userPhone || null]
        );

        if (result.rows.length === 0) {
            return c.json({ error: "Location not found" }, 404);
        }

        return c.json({
            success: true,
            id: result.rows[0].id,
            acknowledged: result.rows[0].acknowledged
        });
    } catch (error) {
        console.error("Failed to acknowledge location:", error);
        return c.json({ error: "Failed to acknowledge location" }, 500);
    }
});

export default router;
