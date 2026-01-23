import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { auth } from "../lib/auth";
import type { AuthType } from "../lib/auth";
import { randomBytes } from "crypto";
import { dbPool } from "../lib/db";

type User = NonNullable<typeof auth.$Infer.Session.user>;

interface ClientInfo {
    id: string;
    ws: any;
    name?: string;
    roomIds: Set<string>;
    user: User;
}

interface Room {
    id: string;
    clients: Map<string, ClientInfo>;
    owner: string;
    emergencyContacts: string[];
    isActive: boolean;
}

const rooms = new Map<string, Room>();
const clients = new Map<string, ClientInfo>();

function generateRoomId(): string {
    return randomBytes(16).toString('hex');
}

function broadcastToRoom(roomId: string, message: any, excludeClientId?: string): void {
    const room = rooms.get(roomId);
    if (!room) {
        console.error(`[${new Date().toISOString()}] Room ${roomId} not found for broadcast`);
        return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    let failedCount = 0;

    room.clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId) {
            try {
                client.ws.send(messageStr);
                sentCount++;
            } catch (error) {
                failedCount++;
                console.error(`[${new Date().toISOString()}] Error broadcasting to client ${clientId} in room ${roomId}:`, error);
                room.clients.delete(clientId);
                clients.delete(clientId);
            }
        }
    });

    if (failedCount > 0) {
        console.error(`[${new Date().toISOString()}] Failed to send to ${failedCount} clients in room ${roomId}`);
    }
    console.log(`[${new Date().toISOString()}] Message sent to ${sentCount} clients in room ${roomId}`);

    if (room.clients.size === 0) {
        rooms.delete(roomId);
        console.log(`[${new Date().toISOString()}] Room ${roomId} deleted (empty)`);
    }
}

function removeClientFromAllRooms(clientId: string): void {
    const clientInfo = clients.get(clientId);
    if (!clientInfo) return;

    const { roomIds } = clientInfo;
    const roomIdsArray = Array.from(roomIds);

    roomIdsArray.forEach(roomId => {
        const room = rooms.get(roomId);
        if (room) {
            room.clients.delete(clientId);

            if (room.clients.size === 0) {
                setTimeout(() => {
                    const roomAfterDelay = rooms.get(roomId);
                    if (roomAfterDelay && roomAfterDelay.clients.size === 0) {
                        rooms.delete(roomId);
                        console.log(`[${new Date().toISOString()}] Room ${roomId} deleted after 1 hour of inactivity`);
                    }
                }, 3600000);
            } else {
                broadcastToRoom(roomId, {
                    type: 'user-left',
                    clientId: clientId,
                    userName: clientInfo.user.name,
                    timestamp: new Date().toISOString()
                });
            }
        }
    });

        console.log(`[${new Date().toISOString()}] Removed ${clientInfo.user?.name || "Unknown"} (${clientId}) from ${roomIdsArray.length} room(s)`);
    clients.delete(clientInfo.id);
}

async function autoJoinEmergencyContacts(clientId: string, clientInfo: ClientInfo): Promise<void> {
    try {
        const authorizedRooms: Array<{ roomId: string; owner: string }> = [];
        const userPhone = clientInfo.user.phone_no;

        rooms.forEach((room, roomId) => {
            const isOwner = room.owner === clientId;
            const isEmergencyContact = userPhone && room.emergencyContacts.includes(userPhone);

            if (isEmergencyContact && !isOwner && !clientInfo.roomIds.has(roomId)) {
                try {
                    room.clients.set(clientId, clientInfo);
                    clientInfo.roomIds.add(roomId);
                    authorizedRooms.push({ roomId, owner: room.owner });

                    clientInfo.ws.send(JSON.stringify({
                        type: 'auto-joined',
                        roomId: roomId,
                        roomOwner: room.owner,
                        message: 'Auto-joined as emergency contact',
                        timestamp: new Date().toISOString()
                    }));

                    broadcastToRoom(roomId, {
                        type: 'emergency-contact-joined',
                        contactId: clientId,
                        contactName: clientInfo.user.name,
                        timestamp: new Date().toISOString()
                    }, clientId);

                    console.log(`[${new Date().toISOString()}] ${clientInfo.user?.name || "Unknown"} (${clientId}) auto-joined room ${roomId} as emergency contact`);
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error auto-joining room ${roomId} for ${clientInfo.user?.name || "Unknown"} (${clientId}):`, error);
                }
            }
        });

        if (authorizedRooms.length > 0) {
            console.log(`[${new Date().toISOString()}] ${clientInfo.user?.name || "Unknown"} (${clientId}) auto-joined ${authorizedRooms.length} room(s) as emergency contact`);
            clientInfo.ws.send(JSON.stringify({
                type: 'auto-join-summary',
                roomsJoined: authorizedRooms,
                message: `Auto-joined to ${authorizedRooms.length} room(s) as emergency contact`,
                timestamp: new Date().toISOString()
            }));
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in autoJoinEmergencyContacts for ${clientInfo.user?.name || "Unknown"} (${clientId}):`, error);
    }
}

async function getEmergencyContacts(userId: string): Promise<string[]> {
    try {
        const result = await dbPool.query(`
            SELECT emergency_contacts
            FROM contacts
            WHERE user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            console.log(`[${new Date().toISOString()}] No contacts found for user ${userId}`);
            return [];
        }

        const contactRow = result.rows[0];
        const contactPhoneNumbers: string[] = [];

        if (contactRow.emergency_contacts && Array.isArray(contactRow.emergency_contacts)) {
            contactPhoneNumbers.push(...contactRow.emergency_contacts);
        }

        console.log(`[${new Date().toISOString()}] Found ${contactPhoneNumbers.length} emergency contacts for user ${userId}`);
        return contactPhoneNumbers;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching emergency contacts for user ${userId}:`, error);
        return [];
    }
}

async function handleCreateRoom(clientId: string, clientInfo: ClientInfo, data: any, ws: any): Promise<void> {
    try {
        const roomId = data.roomId || generateRoomId();
        let room = rooms.get(roomId);

        if (room) {
            console.error(`[${new Date().toISOString()}] Room creation failed: room ${roomId} already exists for user ${clientInfo.user.name}`);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Room already exists',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        const emergencyContacts = await getEmergencyContacts(clientInfo.id);

        room = {
            id: roomId,
            clients: new Map(),
            owner: clientId,
            emergencyContacts: emergencyContacts,
            isActive: true
        };
        rooms.set(roomId, room);
        room.clients.set(clientId, clientInfo);
        clientInfo.roomIds.add(roomId);

        console.log(`[${new Date().toISOString()}] Room ${roomId} created by ${clientInfo.user?.name || "Unknown"} (${clientId}) with ${emergencyContacts.length} emergency contacts`);

        ws.send(JSON.stringify({
            type: 'room-created',
            roomId: roomId,
            owner: clientId,
            emergencyContacts: emergencyContacts,
            timestamp: new Date().toISOString()
        }));

        broadcastToRoom(roomId, {
            type: 'user-joined',
            clientId: clientId,
            user: {
                id: clientInfo.user.id,
                name: clientInfo.user.name,
                email: clientInfo.user.email,
                role: clientInfo.user.role,
                phone_no: clientInfo.user.phone_no
            },
            timestamp: new Date().toISOString()
        }, clientId);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error creating room for ${clientInfo.user?.name || "Unknown"} (${clientId}):`, error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to create room',
            timestamp: new Date().toISOString()
        }));
    }
}

function handleJoinRoom(clientId: string, clientInfo: ClientInfo, data: any, ws: any): void {
    const roomId = data.roomId;
    const room = rooms.get(roomId);

    if (!room) {
        console.log(`[${new Date().toISOString()}] Join denied for ${clientInfo.user?.name || "Unknown"} (${clientId}): room ${roomId} not found`);
        ws.send(JSON.stringify({
            type: 'join-denied',
            message: 'Room not found',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    if (!room.isActive) {
        console.log(`[${new Date().toISOString()}] Join denied for ${clientInfo.user?.name || "Unknown"} (${clientId}): room ${roomId} not active`);
        ws.send(JSON.stringify({
            type: 'join-denied',
            message: 'Room is not active',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    const isOwner = room.owner === clientId;
            const userPhone = clientInfo.user.phone_no;
            const isEmergencyContact = userPhone && room.emergencyContacts.includes(userPhone);

    if (!isOwner && !isEmergencyContact) {
        console.log(`[${new Date().toISOString()}] Join denied for ${clientInfo.user?.name || "Unknown"} (${clientId}): not authorized to join room ${roomId}`);
        ws.send(JSON.stringify({
            type: 'join-denied',
            message: 'Not authorized to join this room',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    if (clientInfo.roomIds.has(roomId)) {
        console.log(`[${new Date().toISOString()}] Join denied for ${clientInfo.user?.name || "Unknown"} (${clientId}): already in room ${roomId}`);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Already in room',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    room.clients.set(clientId, clientInfo);
    clientInfo.roomIds.add(roomId);

        console.log(`[${new Date().toISOString()}] ${clientInfo.user?.name || "Unknown"} (${clientId}) joined room ${roomId} as ${isOwner ? 'owner' : 'emergency contact'}`);

    ws.send(JSON.stringify({
        type: 'join-approved',
        roomId: roomId,
        timestamp: new Date().toISOString()
    }));

    broadcastToRoom(roomId, {
        type: 'user-joined',
        clientId: clientId,
        user: {
            id: clientInfo.user.id,
            name: clientInfo.user.name,
            email: clientInfo.user.email,
            role: clientInfo.user.role,
            phone_no: clientInfo.user.phone_no
        },
        timestamp: new Date().toISOString()
    }, clientId);
}

function handleRequestJoin(clientId: string, clientInfo: ClientInfo, data: any, ws: any): void {
    const roomId = data.roomId;
    const room = rooms.get(roomId);

    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    const ownerClient = room.clients.get(room.owner);
    if (ownerClient) {
        ownerClient.ws.send(JSON.stringify({
            type: 'join-request',
            requesterId: clientId,
            requesterName: clientInfo.user.name,
            requesterUser: {
                id: clientInfo.user.id,
                name: clientInfo.user.name,
                email: clientInfo.user.email,
                role: clientInfo.user.role,
                phone_no: clientInfo.user.phone_no
            },
            roomId: roomId,
            timestamp: new Date().toISOString()
        }));
    }
}

function handleApproveJoin(clientId: string, clientInfo: ClientInfo, data: any, ws: any): void {
    const { roomId, requesterId } = data;
    const room = rooms.get(roomId);

    if (!room || room.owner !== clientId) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Not authorized to approve join requests',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    const requesterClient = clients.get(requesterId);
    if (!requesterClient) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Requester not found',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    room.clients.set(requesterId, requesterClient);
    requesterClient.roomIds.add(roomId);

    requesterClient.ws.send(JSON.stringify({
        type: 'join-approved',
        roomId: roomId,
        timestamp: new Date().toISOString()
    }));

    broadcastToRoom(roomId, {
        type: 'user-joined',
        clientId: requesterId,
        user: {
            id: requesterClient.user.id,
            name: requesterClient.user.name,
            email: requesterClient.user.email,
            role: requesterClient.user.role,
            phone_no: requesterClient.user.phone_no
        },
        timestamp: new Date().toISOString()
    }, requesterId);
}

function handleRoomMessage(clientId: string, clientInfo: ClientInfo, data: any, ws: any): void {
    const { roomId, content } = data;

    if (!clientInfo.roomIds.has(roomId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Not a member of this room',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    broadcastToRoom(roomId, {
        type: 'room-message',
        roomId: roomId,
        content: content,
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
}

async function handleEmergencySOS(clientId: string, clientInfo: ClientInfo, ws: any): Promise<void> {
    try {
        const user = clientInfo.user;
        const ownedRooms: string[] = [];

        rooms.forEach((room) => {
            if (room.owner === clientId) {
                room.isActive = true;
                ownedRooms.push(room.id);
            }
        });

        if (ownedRooms.length === 0) {
            console.error(`[${new Date().toISOString()}] Emergency SOS failed for ${user?.name || "Unknown"} (${clientId}): no owned rooms found`);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'No owned rooms found',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        console.log(`[${new Date().toISOString()}] EMERGENCY SOS triggered by ${user?.name || "Unknown"} (${clientId}) for rooms: ${ownedRooms.join(', ')}`);

        for (const roomId of ownedRooms) {
            const room = rooms.get(roomId);
            if (!room) continue;

            let alertSentCount = 0;
            for (const emergencyPhone of room.emergencyContacts) {
                const emergencyClient = Array.from(clients.values()).find(
                    (client) => client.user.phone_no === emergencyPhone
                );

                if (emergencyClient) {
                    try {
                        emergencyClient.ws.send(JSON.stringify({
                            type: 'emergency-alert',
                            emergencyUserId: clientId,
                            emergencyUserName: user.name,
                            roomId: roomId,
                            message: 'Emergency activated - immediate access granted',
                            timestamp: new Date().toISOString()
                        }));
                        alertSentCount++;
                        console.log(`[${new Date().toISOString()}] Emergency alert sent to ${emergencyClient.user.name} for room ${roomId}`);
                    } catch (error) {
                        console.error(`[${new Date().toISOString()}] Error sending emergency alert to ${emergencyClient.user.name} (${emergencyClient.id}):`, error);
                    }
                }
            }

            console.log(`[${new Date().toISOString()}] Emergency alert sent to ${alertSentCount} contacts for room ${roomId}`);

            broadcastToRoom(roomId, {
                type: 'emergency-activated',
                roomId: roomId,
                clientId: clientId,
                userName: user.name,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone_no: user.phone_no
                },
                timestamp: new Date().toISOString()
            });
        }

        ws.send(JSON.stringify({
            type: 'emergency-confirmed',
            activatedRooms: ownedRooms,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error processing emergency SOS for ${clientInfo.user?.name || "Unknown"} (${clientId}):`, error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process emergency SOS',
            timestamp: new Date().toISOString()
        }));
    }
}

function handlePing(ws: any): void {
    ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
    }));
}

function handleGetUsers(clientId: string, clientInfo: ClientInfo, data: any, ws: any): void {
    const roomId = data.roomId;
    if (!roomId) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room ID required',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    const room = rooms.get(roomId);
    if (room && clientInfo.roomIds.has(roomId)) {
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
            type: 'room-users',
            roomId: roomId,
            users: roomUsers,
            timestamp: new Date().toISOString()
        }));
    } else {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found or access denied',
            timestamp: new Date().toISOString()
        }));
    }
}

const ws = new Hono<{ Bindings: AuthType; Variables: { user: User } }>({
    strict: false
});

ws.use("*", async (c, next) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) {
            console.log(`[${new Date().toISOString()}] Unauthorized access attempt to ${c.req.path}`);
            return c.json({ error: "Unauthorized" }, 401);
        }
        c.set("user", session.user);
        return next();
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Auth error for ${c.req.path}:`, error);
        return c.json({ error: "Authentication failed" }, 401);
    }
});

// TODO: Add room access control for security
// - The implementation of the room access control is to use a middleware that checks the current user's session to check if they are valid to access the room.
// If user1 is a mutual contact of user2, and they connect to a room like room1, and they are the first client.
// user2 is able to go inside of that room as long as that user is given permission by the first user (in this case it's user1) in that room.
// The current implementation of the websocket will change to become -> If a user connects to an endpoint ws/ then they are searching for a room to connect to.
// The server will then create a room code (implementation or algorithm to use still unknown) and add that user to that room. Let's say that room code is room1. They will be the "first" user in that room.
// If user2 is a valid emergency or dependent contact of user1 and they are trying to connect to room1 then they have a "chance" to enter the same room as user1. They can successfully enter room1 once user1 has accepted their "request" to join.
/*
{
  "rooms": [
    {
      "id": "1",
      "clientCount": 3,
      "clients": [
        {
          "id": "user_1_id",
          "name": "John Doe",
          "user": {
            "id": "user_1_id",
            "name": "John Doe",
            "email": "john@example.com",
            "role": "mutual",
            "phone_no": "09123456789"
          }
        }
      ]
    }
  ],
  "totalRooms": 1,
  "totalClients": 3
}
 * */
ws.get('/ws', upgradeWebSocket((c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "User not found" }, 401);
        const clientId = user.id; // Use user ID as client ID

    return {
        async onOpen(_event, ws) {
            const clientInfo: ClientInfo = {
                id: clientId,
                ws: ws,
                roomIds: new Set<string>(),
                user: user,
                name: user.name
            };

            clients.set(clientId, clientInfo);
            console.log(`[${new Date().toISOString()}] ${user?.name || "Unknown"} (${clientId}) connected to WebSocket`);

            await autoJoinEmergencyContacts(clientId, clientInfo);

            ws.send(JSON.stringify({
                type: 'connected',
                clientId: clientId,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone_no: user.phone_no
                },
                roomIds: Array.from(clientInfo.roomIds),
                timestamp: new Date().toISOString()
            }));
        },
        async onMessage(e, ws) {
            try {
                const messageStr = e.data.toString();
                // console.log(`Received message from ${user?.name || "Unknown"} (${clientId}):`, messageStr); // Debug log

                // Check if message looks like JSON before parsing
                if (!messageStr.trim() || !messageStr.trim().startsWith('{') || !messageStr.trim().endsWith('}')) {
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
                    case 'create-room':
                        await handleCreateRoom(clientId, clientInfo, data, ws);
                        break;

                    case 'join-room':
                        handleJoinRoom(clientId, clientInfo, data, ws);
                        break;

                    case 'request-join':
                        handleRequestJoin(clientId, clientInfo, data, ws);
                        break;

                    case 'approve-join':
                        handleApproveJoin(clientId, clientInfo, data, ws);
                        break;

                    case 'room-message':
                        handleRoomMessage(clientId, clientInfo, data, ws);
                        break;

                    case 'emergency-sos':
                        await handleEmergencySOS(clientId, clientInfo, ws);
                        break;

                    case 'ping':
                        handlePing(ws);
                        break;

                    case 'get_users':
                        handleGetUsers(clientId, clientInfo, data, ws);
                        break;
                }
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error parsing message from ${user?.name || "Unknown"} (${clientId}):`, error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format',
                    timestamp: new Date().toISOString()
                }));
            }
        },
        onClose(_event, _ws) {
            console.log(`[${new Date().toISOString()}] ${user?.name || "Unknown"} (${clientId}) disconnected from WebSocket`);
            removeClientFromAllRooms(clientId);
        },
        onError(error) {
            console.error(`[${new Date().toISOString()}] WebSocket error for ${user?.name || "Unknown"} (${clientId}):`, error);
            removeClientFromAllRooms(clientId);
        }
    };
}));

ws.get('/rooms-info', (c) => {
    try {
        const requestingUserPhone = c.get("user")?.phone_no || "";
        
        // Filter rooms to only those where requesting user is a member (by phone number)
        const userRooms = Array.from(rooms.values()).filter(room => {
            if (!requestingUserPhone) return false;
            return room.emergencyContacts.includes(requestingUserPhone);
        });
        
        const roomList = userRooms.map(room => ({
            id: room.id,
            clientCount: room.clients.size,
            clients: Array.from(room.clients.values()).map(client => ({
                id: client.id,
                name: client.name,
                user: {
                    id: client.user.id,
                    name: client.user.name,
                    // Redact sensitive fields: remove email and phone_no
                    role: client.user.role
                }
            }))
        }));

        // Recalculate totals based on filtered list
        const filteredRoomCount = userRooms.length;
        const filteredClientCount = userRooms.reduce((total, room) => total + room.clients.size, 0);

        return c.json({
            rooms: roomList,
            totalRooms: filteredRoomCount,
            totalClients: filteredClientCount
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching rooms info:`, error);
        return c.json({ error: 'Failed to fetch rooms info' }, 500);
    }
});

export default ws;
export { rooms, broadcastToRoom };
