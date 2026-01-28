import { Hono } from "hono";
import { auth } from "../lib/auth";
import { z } from "zod";
import { rooms, broadcastToRoom, clients } from "./websocket";

type User = NonNullable<typeof auth.$Infer.Session.user>;

const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timestamp: z.string().or(z.number()),
    accuracy: z.number().optional(),
    roomId: z.string().optional()
});

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
        return c.json({ error: "Invalid location data", details: parsed.error.errors }, 400);
    }

    const { latitude, longitude, timestamp, accuracy, roomId } = parsed.data;
    const userPhone = user.phone_no;

    if (!userPhone) {
        return c.json({ error: "User phone number not available" }, 400);
    }

    const timestampStr = typeof timestamp === "number" ? new Date(timestamp).toISOString() : timestamp;

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

export default router;
