import { Hono } from "hono";
import { auth } from "../lib/auth";
import { z } from "zod";
import { rooms, broadcastToRoom } from "./websocket";

type User = NonNullable<typeof auth.$Infer.Session.user>;

const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timestamp: z.string().or(z.number()),
    accuracy: z.number().optional()
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

router.post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json();

    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: "Invalid location data", details: parsed.error.errors }, 400);
    }

    const { latitude, longitude, timestamp, accuracy } = parsed.data;

    const timestampStr = typeof timestamp === "number" ? new Date(timestamp).toISOString() : timestamp;

    const userRoomIds: string[] = [];
    rooms.forEach((room, roomId) => {
        if (room.clients.has(user.id)) {
            userRoomIds.push(roomId);
        }
    });

    if (userRoomIds.length === 0) {
        return c.json({ error: "User is not in any active room" }, 400);
    }

    const locationMessage = {
        type: "location-update",
        data: {
            userId: user.id,
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
});

export default router;