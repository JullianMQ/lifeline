import { Hono } from "hono";
import { upgradeWebSocket, websocket } from "hono/bun";
import { auth } from "../lib/auth";
import type { AuthType } from "../lib/auth";

type User = NonNullable<typeof auth.$Infer.Session.user>;

interface ClientInfo {
    id: string;
    ws: any;
    name?: string;
    roomId: string;
    user: User;
}

interface Room {
    id: string;
    clients: Map<string, ClientInfo>;
}

const rooms = new Map<string, Room>();
const clients = new Map<string, ClientInfo>();

function broadcastToRoom(roomId: string, message: any, excludeClientId?: string): void {
    const room = rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    // console.log(`Broadcasting to room ${roomId}:`, messageStr); // Debug log

    let sentCount = 0;
    room.clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId) {
            try {
                client.ws.send(messageStr);
                sentCount++;
                // console.log(`Sent to client ${clientId} in room ${roomId}`); // Debug log
            } catch (error) {
                console.error('Error sending message to client:', error);
                // Remove disconnected client
                room.clients.delete(clientId);
                clients.delete(clientId);
            }
        }
    });

    // console.log(`Message sent to ${sentCount} clients in room ${roomId}`); // Debug log

    // Clean up empty rooms
    if (room.clients.size === 0) {
        rooms.delete(roomId);
    }
}

function removeClientFromRoom(clientId: string): void {
    const clientInfo = clients.get(clientId);
    if (!clientInfo) return;

    const { roomId } = clientInfo;
    const room = rooms.get(roomId);
    if (room) {
        room.clients.delete(clientId);

        if (room.clients.size === 0) {
            rooms.delete(roomId);
        }
    }

    clients.delete(clientId);

    broadcastToRoom(roomId, {
        type: 'user_left',
        clientId: clientId,
        userName: clientInfo.user.name,
        timestamp: new Date().toISOString()
    });
}

const ws = new Hono<{ Bindings: AuthType; Variables: { user: User } }>({
    strict: false
});

// Add authentication middleware
ws.use("*", async (c, next) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        c.set("user", session.user);
        return next();
    } catch (error) {
        console.error('Auth error:', error);
        return c.json({ error: "Authentication failed" }, 401);
    }
});

// TODO: Add room access control for security
// FUTURE: Implement validateRoomAccess() function to check:
// - Family relationships for family-{familyId} rooms
// - Organization membership for org-{orgId} rooms  
// - Emergency contact relationships for emergency-{userId} rooms
// This will ensure users can only join authorized rooms

ws.get('/ws/:roomId', upgradeWebSocket((c) => {
    const roomId = c.req.param('roomId');
    const user = c.get("user");
    const clientId = user.id; // Use user ID as client ID

    return {
        onOpen(_event, ws) {
            let room = rooms.get(roomId);
            if (!room) {
                room = { id: roomId, clients: new Map() };
                rooms.set(roomId, room);
            }

            const clientInfo: ClientInfo = {
                id: clientId,
                ws: ws,
                roomId: roomId,
                user: user,
                name: user.name
            };

            room.clients.set(clientId, clientInfo);
            clients.set(clientId, clientInfo);

            // Send connection confirmation with user info
            ws.send(JSON.stringify({
                type: 'connected',
                clientId: clientId,
                roomId: roomId,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone_no: user.phone_no
                },
                timestamp: new Date().toISOString()
            }));

            // Notify others in room
            broadcastToRoom(roomId, {
                type: 'user_joined',
                clientId: clientId,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone_no: user.phone_no
                },
                timestamp: new Date().toISOString()
            }, clientId);

            // Send current room users list
            const roomUsers = Array.from(room.clients.values()).map(client => ({
                id: client.id,
                name: client.name,
                user: {
                    id: client.user.id,
                    name: client.user.name,
                    email: client.user.email,
                    role: client.user.role,
                    phone_no: client.user.phone_no
                }
            }));

            ws.send(JSON.stringify({
                type: 'room_users',
                users: roomUsers,
                timestamp: new Date().toISOString()
            }));

            // console.log(`User ${user.name} (${user.id}) joined room ${roomId}`);
        },
        onMessage(e, ws) {
            try {
                const messageStr = e.data.toString();
                // console.log(`Received message from ${user.name} (${clientId}):`, messageStr); // Debug log

                // Check if message looks like JSON before parsing
                if (!messageStr.trim().startsWith('{') || !messageStr.trim().endsWith('}')) {
                    // console.log('Non-JSON message received, ignoring:', messageStr);
                    return; // Silently ignore non-JSON messages
                }

                const data = JSON.parse(messageStr);
                const clientInfo = clients.get(clientId);

                if (!clientInfo) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Client not found',
                        timestamp: new Date().toISOString()
                    }));
                    return;
                }

                switch (data.type) {
                    case 'chat':
                        broadcastToRoom(clientInfo.roomId, {
                            type: 'chat',
                            message: data.message,
                            clientId: clientId,
                            userName: clientInfo.user.name,
                            user: {
                                id: clientInfo.user.id,
                                name: clientInfo.user.name,
                                email: clientInfo.user.email,
                                role: clientInfo.user.role,
                                phone_no: clientInfo.user.phone_no
                            },
                            timestamp: new Date().toISOString()
                        });
                        break;

                    case 'direct_message': {
                        const targetRoom = rooms.get(clientInfo.roomId);
                        if (targetRoom && targetRoom.clients.has(data.targetClientId)) {
                            const targetClient = targetRoom.clients.get(data.targetClientId);
                            if (targetClient) {
                                try {
                                    targetClient.ws.send(JSON.stringify({
                                        type: 'direct_message',
                                        message: data.message,
                                        fromClientId: clientId,
                                        fromName: clientInfo.user.name,
                                        fromUser: {
                                            id: clientInfo.user.id,
                                            name: clientInfo.user.name,
                                            email: clientInfo.user.email,
                                            role: clientInfo.user.role,
                                            phone_no: clientInfo.user.phone_no
                                        },
                                        timestamp: new Date().toISOString()
                                    }));
                                } catch (error) {
                                    console.error('Error sending direct message:', error);
                                }
                            }
                        }
                        break;
                    }

                    case 'ping':
                        ws.send(JSON.stringify({
                            type: 'pong',
                            timestamp: new Date().toISOString()
                        }));
                        break;

                    case 'get_users': {
                        const room = rooms.get(clientInfo.roomId);
                        if (room) {
                            const roomUsers = Array.from(room.clients.values()).map(client => ({
                                id: client.id,
                                name: client.name,
                                user: {
                                    id: client.user.id,
                                    name: client.user.name,
                                    email: client.user.email,
                                    role: client.user.role,
                                    phone_no: client.user.phone_no
                                }
                            }));

                            ws.send(JSON.stringify({
                                type: 'room_users',
                                users: roomUsers,
                                timestamp: new Date().toISOString()
                            }));
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error('Error parsing message:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format',
                    timestamp: new Date().toISOString()
                }));
            }
        },
        onClose(_event, _ws) {
            removeClientFromRoom(clientId);
            // console.log(`User ${user.name} (${clientId}) disconnected`);
        },
        onError(error) {
            console.error(`WebSocket error for user ${user.name} (${clientId}):`, error);
            removeClientFromRoom(clientId);
        }
    };
}));

// REST endpoint to get room information
ws.get('/rooms-info', (c) => {
    const roomList = Array.from(rooms.values()).map(room => ({
        id: room.id,
        clientCount: room.clients.size,
        clients: Array.from(room.clients.values()).map(client => ({
            id: client.id,
            name: client.name,
            user: {
                id: client.user.id,
                name: client.user.name,
                email: client.user.email,
                role: client.user.role,
                phone_no: client.user.phone_no
            }
        }))
    }));

    return c.json({
        rooms: roomList,
        totalRooms: rooms.size,
        totalClients: clients.size
    });
});

export default ws;
export { websocket };
