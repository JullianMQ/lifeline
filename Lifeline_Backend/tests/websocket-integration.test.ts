import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { randomBytes } from "crypto";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: "mutual" | "dependent";
  phone_no: string;
};

type MockWebSocket = {
  id: string;
  messages: Array<any>;
  connected: boolean;
  sentMessages: Array<any>;
  user: MockUser;
  roomIds: Set<string>;
  send: (data: string) => void;
  close: () => void;
  on: (event: string, callback: (data: any) => void) => void;
};

type MockRoom = {
  id: string;
  clients: Map<string, MockWebSocket>;
  owner: string;
  emergencyContacts: string[];
  isActive: boolean;
};

const mockRooms = new Map<string, MockRoom>();
const mockClients = new Map<string, MockWebSocket>();

let userCounter = 0;

function generateRoomId(): string {
  return randomBytes(16).toString("hex");
}

function createMockUser(role: "mutual" | "dependent" = "mutual"): MockUser {
  userCounter++;
  return {
    id: `user_${userCounter}`,
    name: `User ${userCounter}`,
    email: `user${userCounter}@example.com`,
    role,
    phone_no: role === "mutual" ? `0912345678${userCounter.toString().padStart(2, "0")}` : `0998765432${userCounter.toString().padStart(2, "0")}`
  };
}

function createMockWebSocket(user: MockUser): MockWebSocket {
  const ws: MockWebSocket = {
    id: user.id,
    messages: [],
    connected: false,
    sentMessages: [],
    user,
    roomIds: new Set<string>(),
    send: function (data: string) {
      this.sentMessages.push(JSON.parse(data));
    },
    close: function () {
      this.connected = false;
    },
    on: function (event: string, callback: (data: any) => void) {}
  };
  mockClients.set(ws.id, ws);
  return ws;
}

function createRoom(owner: MockWebSocket, emergencyContacts: string[]): MockRoom {
  const roomId = generateRoomId();
  const room: MockRoom = {
    id: roomId,
    clients: new Map<string, MockWebSocket>(),
    owner: owner.id,
    emergencyContacts,
    isActive: true
  };
  room.clients.set(owner.id, owner);
  owner.roomIds.add(roomId);
  mockRooms.set(roomId, room);
  return room;
}

function broadcastToRoom(roomId: string, message: any, excludeClientId?: string): void {
  const room = mockRooms.get(roomId);
  if (!room) return;

  const messageStr = JSON.stringify(message);

  room.clients.forEach((client, clientId) => {
    if (clientId !== excludeClientId) {
      try {
        client.messages.push(message);
        client.send(messageStr);
      } catch (error) {
        console.error(`Error broadcasting to client ${clientId} in room ${roomId}:`, error);
      }
    }
  });
}

function removeClientFromAllRooms(clientId: string): void {
  const clientInfo = mockClients.get(clientId);
  if (!clientInfo) return;

  clientInfo.roomIds.forEach(roomId => {
    const room = mockRooms.get(roomId);
    if (room) {
      room.clients.delete(clientId);

      if (room.clients.size === 0) {
        mockRooms.delete(roomId);
      } else {
        broadcastToRoom(roomId, {
          type: "user-left",
          clientId: clientId,
          userName: clientInfo.user.name,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  mockClients.delete(clientInfo.id);
}

function connectWebSocket(user: MockUser): MockWebSocket {
  const ws = createMockWebSocket(user);
  ws.connected = true;

  ws.send(JSON.stringify({
    type: "connected",
    clientId: ws.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone_no: user.phone_no
    },
    roomIds: Array.from(ws.roomIds),
    timestamp: new Date().toISOString()
  }));

  return ws;
}

function autoJoinEmergencyContacts(clientId: string, clientInfo: MockWebSocket): void {
  try {
    const authorizedRooms: Array<{ roomId: string; owner: string }> = [];
    const userPhone = clientInfo.user.phone_no;

    mockRooms.forEach((room, roomId) => {
      const isOwner = room.owner === clientId;
      const isEmergencyContact = room.emergencyContacts.includes(userPhone);

      if (isEmergencyContact && !isOwner && !clientInfo.roomIds.has(roomId)) {
        try {
          room.clients.set(clientId, clientInfo);
          clientInfo.roomIds.add(roomId);
          authorizedRooms.push({ roomId, owner: room.owner });

          clientInfo.send(JSON.stringify({
            type: "auto-joined",
            roomId: roomId,
            roomOwner: room.owner,
            message: "Auto-joined as emergency contact",
            timestamp: new Date().toISOString()
          }));

          broadcastToRoom(roomId, {
            type: "emergency-contact-joined",
            contactId: clientId,
            contactName: clientInfo.user.name,
            timestamp: new Date().toISOString()
          }, clientId);
        } catch (error) {
          console.error(`Error auto-joining room ${roomId}:`, error);
        }
      }
    });

    if (authorizedRooms.length > 0) {
      clientInfo.send(JSON.stringify({
        type: "auto-join-summary",
        roomsJoined: authorizedRooms,
        message: `Auto-joined to ${authorizedRooms.length} room(s) as emergency contact`,
        timestamp: new Date().toISOString()
      }));
    }
  } catch (error) {
    console.error(`Error in autoJoinEmergencyContacts:`, error);
  }
}

function handleCreateRoom(ws: MockWebSocket, data: any): any {
  const roomId = data.roomId || generateRoomId();
  let room = mockRooms.get(roomId);

  if (room) {
    return {
      type: "error",
      message: "Room already exists",
      timestamp: new Date().toISOString()
    };
  }

  const emergencyContacts = data.emergencyContacts || [];

  room = {
    id: roomId,
    clients: new Map<string, MockWebSocket>(),
    owner: ws.id,
    emergencyContacts: emergencyContacts,
    isActive: true
  };
  mockRooms.set(roomId, room);
  room.clients.set(ws.id, ws);
  ws.roomIds.add(roomId);

  const response = {
    type: "room-created",
    roomId: roomId,
    owner: ws.id,
    emergencyContacts: emergencyContacts,
    timestamp: new Date().toISOString()
  };

  broadcastToRoom(roomId, {
    type: "user-joined",
    clientId: ws.id,
    user: {
      id: ws.user.id,
      name: ws.user.name,
      email: ws.user.email,
      role: ws.user.role,
      phone_no: ws.user.phone_no
    },
    timestamp: new Date().toISOString()
  }, ws.id);

  return response;
}

function handleJoinRoom(ws: MockWebSocket, data: any): any {
  const roomId = data.roomId;
  const room = mockRooms.get(roomId);

  if (!room) {
    return {
      type: "join-denied",
      message: "Room not found",
      timestamp: new Date().toISOString()
    };
  }

  if (!room.isActive) {
    return {
      type: "join-denied",
      message: "Room is not active",
      timestamp: new Date().toISOString()
    };
  }

  const isOwner = room.owner === ws.id;
  const isEmergencyContact = room.emergencyContacts.includes(ws.user.phone_no);

  if (!isOwner && !isEmergencyContact) {
    return {
      type: "join-denied",
      message: "Not authorized to join this room",
      timestamp: new Date().toISOString()
    };
  }

  if (ws.roomIds.has(roomId)) {
    return {
      type: "error",
      message: "Already in room",
      timestamp: new Date().toISOString()
    };
  }

  room.clients.set(ws.id, ws);
  ws.roomIds.add(roomId);

  broadcastToRoom(roomId, {
    type: "user-joined",
    clientId: ws.id,
    user: {
      id: ws.user.id,
      name: ws.user.name,
      email: ws.user.email,
      role: ws.user.role,
      phone_no: ws.user.phone_no
    },
    timestamp: new Date().toISOString()
  }, ws.id);

  return {
    type: "join-approved",
    roomId: roomId,
    timestamp: new Date().toISOString()
  };
}

function handleEmergencySOS(ws: MockWebSocket): any {
  const user = ws.user;
  const ownedRooms: string[] = [];

  mockRooms.forEach((room) => {
    if (room.owner === ws.id) {
      room.isActive = true;
      ownedRooms.push(room.id);
    }
  });

  if (ownedRooms.length === 0) {
    return {
      type: "error",
      message: "No owned rooms found",
      timestamp: new Date().toISOString()
    };
  }

  for (const roomId of ownedRooms) {
    const room = mockRooms.get(roomId);
    if (!room) continue;

    let alertSentCount = 0;
    for (const emergencyPhone of room.emergencyContacts) {
      const emergencyClient = Array.from(mockClients.values()).find(
        (client) => client.user.phone_no === emergencyPhone
      );

      if (emergencyClient) {
        try {
          emergencyClient.send(JSON.stringify({
            type: "emergency-alert",
            emergencyUserId: ws.id,
            emergencyUserName: user.name,
            roomId: roomId,
            message: "Emergency activated - immediate access granted",
            timestamp: new Date().toISOString()
          }));
          alertSentCount++;
        } catch (error) {
          console.error(`Error sending emergency alert:`, error);
        }
      }
    }

    broadcastToRoom(roomId, {
      type: "emergency-activated",
      roomId: roomId,
      clientId: ws.id,
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

  return {
    type: "emergency-confirmed",
    activatedRooms: ownedRooms,
    timestamp: new Date().toISOString()
  };
}

function handleLocationUpload(user: MockUser, locationData: any): any {
  const userRoomIds: string[] = [];
  mockRooms.forEach((room, roomId) => {
    if (room.clients.has(user.id)) {
      userRoomIds.push(roomId);
    }
  });

  if (userRoomIds.length === 0) {
    return {
      error: "User is not in any active room"
    };
  }

  const locationMessage = {
    type: "location-update",
    data: {
      userId: user.id,
      userName: user.name,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timestamp: locationData.timestamp,
      accuracy: locationData.accuracy
    },
    timestamp: new Date().toISOString()
  };

  userRoomIds.forEach(roomId => {
    broadcastToRoom(roomId, locationMessage);
  });

  return {
    success: true,
    timestamp: locationData.timestamp,
    rooms: userRoomIds
  };
}

function handleGetUsers(ws: MockWebSocket, roomId: string): any {
  if (!roomId) {
    return {
      type: "error",
      message: "Room ID required",
      timestamp: new Date().toISOString()
    };
  }

  const room = mockRooms.get(roomId);
  if (room && ws.roomIds.has(roomId)) {
    const roomUsers = Array.from(room.clients.values()).map(client => ({
      id: client.id,
      name: client.user.name,
      user: {
        id: client.user.id,
        name: client.user.name,
        email: client.user.email,
        role: client.user.role,
        phone_no: client.user.phone_no
      }
    }));

    return {
      type: "room-users",
      roomId: roomId,
      users: roomUsers,
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      type: "error",
      message: "Room not found or access denied",
      timestamp: new Date().toISOString()
    };
  }
}

function cleanup() {
  mockRooms.clear();
  mockClients.clear();
}

beforeEach(() => {
  cleanup();
  userCounter = 0;
});

describe("Multi-Room WebSocket Integration Tests", () => {
  describe("Test 1: Multi-Room Creation & Emergency Contact Loading", () => {
    it("should create multiple rooms with same emergency contact", () => {
      const user1 = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const ws1 = connectWebSocket(user1);

      const room1 = handleCreateRoom(ws1, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const room2 = handleCreateRoom(ws1, {
        roomId: "room2",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const room3 = handleCreateRoom(ws1, {
        roomId: "room3",
        emergencyContacts: [emergencyContact.phone_no]
      });

      expect(room1.type).toBe("room-created");
      expect(room2.type).toBe("room-created");
      expect(room3.type).toBe("room-created");
      expect(mockRooms.size).toBe(3);

      const room1Data = mockRooms.get("room1");
      const room2Data = mockRooms.get("room2");
      const room3Data = mockRooms.get("room3");

      expect(room1Data?.emergencyContacts).toContain(emergencyContact.phone_no);
      expect(room2Data?.emergencyContacts).toContain(emergencyContact.phone_no);
      expect(room3Data?.emergencyContacts).toContain(emergencyContact.phone_no);
    });

    it("should verify all rooms created successfully", () => {
      const user = createMockUser("mutual");
      const contact1 = createMockUser("mutual");
      const contact2 = createMockUser("mutual");

      const ws = connectWebSocket(user);

      const room1Response = handleCreateRoom(ws, {
        roomId: "room1",
        emergencyContacts: [contact1.phone_no, contact2.phone_no]
      });

      const room2Response = handleCreateRoom(ws, {
        roomId: "room2",
        emergencyContacts: [contact1.phone_no]
      });

      expect(room1Response.type).toBe("room-created");
      expect(room1Response.emergencyContacts).toHaveLength(2);
      expect(room2Response.type).toBe("room-created");
      expect(room2Response.emergencyContacts).toHaveLength(1);

      expect(mockRooms.has("room1")).toBe(true);
      expect(mockRooms.has("room2")).toBe(true);
      expect(mockRooms.size).toBe(2);
    });

    it("should verify emergency contacts are loaded in each room", () => {
      const user = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const ws = connectWebSocket(user);

      const emergencyContacts = [emergencyContact.phone_no, "09999999999"];

      const room1 = handleCreateRoom(ws, {
        roomId: "room1",
        emergencyContacts: emergencyContacts
      });

      const room2 = handleCreateRoom(ws, {
        roomId: "room2",
        emergencyContacts: emergencyContacts
      });

      const room1Data = mockRooms.get("room1");
      const room2Data = mockRooms.get("room2");

      expect(room1Data?.emergencyContacts).toEqual(emergencyContacts);
      expect(room2Data?.emergencyContacts).toEqual(emergencyContacts);
    });
  });

  describe("Test 2: Emergency Contact Multi-Room Immediate Access", () => {
    it("should allow emergency contact to join multiple rooms immediately", () => {
      const user1 = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleCreateRoom(user1Ws, {
        roomId: "room2",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const contactWs = connectWebSocket(emergencyContact);

      const join1Response = handleJoinRoom(contactWs, { roomId: "room1" });
      const join2Response = handleJoinRoom(contactWs, { roomId: "room2" });

      expect(join1Response.type).toBe("join-approved");
      expect(join2Response.type).toBe("join-approved");
      expect(contactWs.roomIds.has("room1")).toBe(true);
      expect(contactWs.roomIds.has("room2")).toBe(true);
    });

    it("should verify immediate access without approval", () => {
      const user1 = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const contactWs = connectWebSocket(emergencyContact);

      const joinResponse = handleJoinRoom(contactWs, { roomId: "room1" });

      expect(joinResponse.type).toBe("join-approved");
      expect(joinResponse).not.toHaveProperty("requiresApproval");
    });

    it("should check join-approved and user-joined notifications", () => {
      const user1 = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);
      const contactWs = connectWebSocket(emergencyContact);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const joinResponse = handleJoinRoom(contactWs, { roomId: "room1" });

      expect(joinResponse.type).toBe("join-approved");

      const user1Messages = user1Ws.messages.filter(m => m.type === "user-joined");
      expect(user1Messages.length).toBeGreaterThan(0);
      expect(user1Messages[0].clientId).toBe(contactWs.id);
    });
  });

  describe("Test 3: Multi-Room Location Broadcasting", () => {
    it("should send location update via REST API simulation", () => {
      const user = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(emergencyContact);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleCreateRoom(userWs, {
        roomId: "room2",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleJoinRoom(contactWs, { roomId: "room1" });
      handleJoinRoom(contactWs, { roomId: "room2" });

      const locationData = {
        latitude: 14.5995,
        longitude: 120.9842,
        timestamp: "2026-01-18T10:00:00.000Z",
        accuracy: 12
      };

      const response = handleLocationUpload(user, locationData);

      expect(response.success).toBe(true);
      expect(response.rooms).toEqual(["room1", "room2"]);
    });

    it("should monitor WebSocket messages in all rooms", () => {
      const user = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(emergencyContact);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleCreateRoom(userWs, {
        roomId: "room2",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleJoinRoom(contactWs, { roomId: "room1" });
      handleJoinRoom(contactWs, { roomId: "room2" });

      handleLocationUpload(user, {
        latitude: 14.5995,
        longitude: 120.9842,
        timestamp: "2026-01-18T10:00:00.000Z",
        accuracy: 12
      });

      const contactLocationMessages = contactWs.messages.filter(m => m.type === "location-update");
      expect(contactLocationMessages.length).toBe(2);
    });

    it("should verify all room members receive location-update", () => {
      const user = createMockUser("mutual");
      const contact1 = createMockUser("mutual");
      const contact2 = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contact1Ws = connectWebSocket(contact1);
      const contact2Ws = connectWebSocket(contact2);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact1.phone_no, contact2.phone_no]
      });

      handleCreateRoom(userWs, {
        roomId: "room2",
        emergencyContacts: [contact1.phone_no]
      });

      handleJoinRoom(contact1Ws, { roomId: "room1" });
      handleJoinRoom(contact1Ws, { roomId: "room2" });
      handleJoinRoom(contact2Ws, { roomId: "room1" });

      handleLocationUpload(user, {
        latitude: 14.5995,
        longitude: 120.9842,
        timestamp: "2026-01-18T10:00:00.000Z",
        accuracy: 12
      });

      const contact1LocationMessages = contact1Ws.messages.filter(m => m.type === "location-update");
      const contact2LocationMessages = contact2Ws.messages.filter(m => m.type === "location-update");

      expect(contact1LocationMessages.length).toBe(2);
      expect(contact2LocationMessages.length).toBe(1);
    });
  });

  describe("Test 4: Cross-Room Emergency SOS Trigger", () => {
    it("should trigger SOS for user with multiple rooms", () => {
      const user = createMockUser("mutual");
      const contact1 = createMockUser("mutual");
      const contact2 = createMockUser("mutual");

      const userWs = connectWebSocket(user);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact1.phone_no]
      });

      handleCreateRoom(userWs, {
        roomId: "room2",
        emergencyContacts: [contact2.phone_no]
      });

      const sosResponse = handleEmergencySOS(userWs);

      expect(sosResponse.type).toBe("emergency-confirmed");
      expect(sosResponse.activatedRooms).toContain("room1");
      expect(sosResponse.activatedRooms).toContain("room2");
    });

    it("should monitor emergency contact notifications across all rooms", () => {
      const user = createMockUser("mutual");
      const contact1 = createMockUser("mutual");
      const contact2 = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contact1Ws = connectWebSocket(contact1);
      const contact2Ws = connectWebSocket(contact2);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact1.phone_no]
      });

      handleCreateRoom(userWs, {
        roomId: "room2",
        emergencyContacts: [contact2.phone_no]
      });

      handleJoinRoom(contact1Ws, { roomId: "room1" });
      handleJoinRoom(contact2Ws, { roomId: "room2" });

      handleEmergencySOS(userWs);

      const contact1Alerts = contact1Ws.sentMessages.filter(m => m.type === "emergency-alert");
      const contact2Alerts = contact2Ws.sentMessages.filter(m => m.type === "emergency-alert");

      expect(contact1Alerts.length).toBeGreaterThan(0);
      expect(contact2Alerts.length).toBeGreaterThan(0);
      expect(contact1Alerts[0].roomId).toBe("room1");
      expect(contact2Alerts[0].roomId).toBe("room2");
    });

    it("should verify emergency mode activated in all user's rooms", () => {
      const user = createMockUser("mutual");
      const contact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(contact);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact.phone_no]
      });

      handleCreateRoom(userWs, {
        roomId: "room2",
        emergencyContacts: [contact.phone_no]
      });

      handleJoinRoom(contactWs, { roomId: "room1" });
      handleJoinRoom(contactWs, { roomId: "room2" });

      handleEmergencySOS(userWs);

      const room1 = mockRooms.get("room1");
      const room2 = mockRooms.get("room2");

      expect(room1?.isActive).toBe(true);
      expect(room2?.isActive).toBe(true);

      const activatedMessages = contactWs.messages.filter(m => m.type === "emergency-activated");
      expect(activatedMessages.length).toBe(2);
    });
  });

  describe("Test 5: Non-Contact Multi-Room Access Denied", () => {
    it("should deny non-contact user from joining multiple rooms", () => {
      const user1 = createMockUser("mutual");
      const nonContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: ["09123456789"]
      });

      handleCreateRoom(user1Ws, {
        roomId: "room2",
        emergencyContacts: ["09123456789"]
      });

      const nonContactWs = connectWebSocket(nonContact);

      const join1Response = handleJoinRoom(nonContactWs, { roomId: "room1" });
      const join2Response = handleJoinRoom(nonContactWs, { roomId: "room2" });

      expect(join1Response.type).toBe("join-denied");
      expect(join2Response.type).toBe("join-denied");
      expect(nonContactWs.roomIds.has("room1")).toBe(false);
      expect(nonContactWs.roomIds.has("room2")).toBe(false);
    });

    it("should verify join-denied response for all rooms", () => {
      const user1 = createMockUser("mutual");
      const nonContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);
      const nonContactWs = connectWebSocket(nonContact);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: ["09999999999"]
      });

      handleCreateRoom(user1Ws, {
        roomId: "room2",
        emergencyContacts: ["09999999999"]
      });

      const join1Response = handleJoinRoom(nonContactWs, { roomId: "room1" });
      const join2Response = handleJoinRoom(nonContactWs, { roomId: "room2" });

      expect(join1Response.type).toBe("join-denied");
      expect(join1Response.message).toContain("Not authorized");
      expect(join2Response.type).toBe("join-denied");
      expect(join2Response.message).toContain("Not authorized");
    });

    it("should verify non-contact receives no room access", () => {
      const user1 = createMockUser("mutual");
      const nonContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);
      const nonContactWs = connectWebSocket(nonContact);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: ["09999999999"]
      });

      handleJoinRoom(nonContactWs, { roomId: "room1" });

      expect(nonContactWs.roomIds.size).toBe(0);
      expect(nonContactWs.messages.some(m => m.type === "join-approved")).toBe(false);
    });
  });

  describe("Test 6: Auto-Join on Connection", () => {
    it("should auto-join emergency contact to authorized rooms", () => {
      const user1 = createMockUser("mutual");
      const user2 = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);
      const user2Ws = connectWebSocket(user2);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleCreateRoom(user2Ws, {
        roomId: "room2",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const contactWs = connectWebSocket(emergencyContact);

      autoJoinEmergencyContacts(contactWs.id, contactWs);

      expect(contactWs.roomIds.has("room1")).toBe(true);
      expect(contactWs.roomIds.has("room2")).toBe(true);
    });

    it("should verify auto-joined to all authorized rooms", () => {
      const user1 = createMockUser("mutual");
      const user2 = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);
      const user2Ws = connectWebSocket(user2);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleCreateRoom(user2Ws, {
        roomId: "room2",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleCreateRoom(user1Ws, {
        roomId: "room3",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const contactWs = connectWebSocket(emergencyContact);

      autoJoinEmergencyContacts(contactWs.id, contactWs);

      expect(contactWs.roomIds.size).toBe(3);
      expect(contactWs.roomIds.has("room1")).toBe(true);
      expect(contactWs.roomIds.has("room2")).toBe(true);
      expect(contactWs.roomIds.has("room3")).toBe(true);
    });

    it("should check auto-joined and auto-join-summary messages", () => {
      const user1 = createMockUser("mutual");
      const emergencyContact = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [emergencyContact.phone_no]
      });

      handleCreateRoom(user1Ws, {
        roomId: "room2",
        emergencyContacts: [emergencyContact.phone_no]
      });

      const contactWs = connectWebSocket(emergencyContact);

      autoJoinEmergencyContacts(contactWs.id, contactWs);

      const autoJoinedMessages = contactWs.sentMessages.filter(m => m.type === "auto-joined");
      const summaryMessages = contactWs.sentMessages.filter(m => m.type === "auto-join-summary");

      expect(autoJoinedMessages.length).toBe(2);
      expect(summaryMessages.length).toBe(1);
      expect(summaryMessages[0].roomsJoined).toHaveLength(2);
    });
  });

  describe("Additional Multi-Room Scenarios", () => {
    it("should handle room cleanup when all clients disconnect", () => {
      const user1 = createMockUser("mutual");
      const user2 = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);
      const user2Ws = connectWebSocket(user2);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [user2.phone_no]
      });

      handleJoinRoom(user2Ws, { roomId: "room1" });

      expect(mockRooms.size).toBe(1);

      removeClientFromAllRooms(user1Ws.id);
      removeClientFromAllRooms(user2Ws.id);

      expect(mockRooms.size).toBe(0);
    });

    it("should handle get_users request for specific room", () => {
      const user1 = createMockUser("mutual");
      const user2 = createMockUser("mutual");

      const user1Ws = connectWebSocket(user1);
      const user2Ws = connectWebSocket(user2);

      handleCreateRoom(user1Ws, {
        roomId: "room1",
        emergencyContacts: [user2.phone_no]
      });

      handleJoinRoom(user2Ws, { roomId: "room1" });

      const response = handleGetUsers(user1Ws, "room1");

      expect(response.type).toBe("room-users");
      expect(response.users).toHaveLength(2);
      expect(response.users[0].id).toBe(user1.id);
      expect(response.users[1].id).toBe(user2.id);
    });

    it("should handle multiple emergency contacts in same room", () => {
      const user = createMockUser("mutual");
      const contact1 = createMockUser("mutual");
      const contact2 = createMockUser("mutual");
      const contact3 = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contact1Ws = connectWebSocket(contact1);
      const contact2Ws = connectWebSocket(contact2);
      const contact3Ws = connectWebSocket(contact3);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact1.phone_no, contact2.phone_no, contact3.phone_no]
      });

      handleJoinRoom(contact1Ws, { roomId: "room1" });
      handleJoinRoom(contact2Ws, { roomId: "room1" });
      handleJoinRoom(contact3Ws, { roomId: "room1" });

      const room = mockRooms.get("room1");
      expect(room?.clients.size).toBe(4);

      const response = handleGetUsers(userWs, "room1");
      expect(response.users).toHaveLength(4);
    });

    it("should handle room-message broadcasting to all room members", () => {
      const user = createMockUser("mutual");
      const contact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(contact);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact.phone_no]
      });

      handleJoinRoom(contactWs, { roomId: "room1" });

      const roomMessage = {
        type: "room-message",
        roomId: "room1",
        content: "Hello everyone!",
        clientId: userWs.id,
        userName: user.name,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone_no: user.phone_no
        },
        timestamp: new Date().toISOString()
      };

      broadcastToRoom("room1", roomMessage, userWs.id);

      const contactMessages = contactWs.messages.filter(m => m.type === "room-message");
      expect(contactMessages.length).toBe(1);
      expect(contactMessages[0].content).toBe("Hello everyone!");
    });

    it("should handle user leaving room with notifications", () => {
      const user = createMockUser("mutual");
      const contact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(contact);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact.phone_no]
      });

      handleJoinRoom(contactWs, { roomId: "room1" });

      removeClientFromAllRooms(userWs.id);

      const contactLeftMessages = contactWs.messages.filter(m => m.type === "user-left");
      expect(contactLeftMessages.length).toBe(1);
      expect(contactLeftMessages[0].clientId).toBe(userWs.id);
    });

    it("should prevent duplicate room joins", () => {
      const user = createMockUser("mutual");
      const contact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(contact);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact.phone_no]
      });

      const join1Response = handleJoinRoom(contactWs, { roomId: "room1" });
      const join2Response = handleJoinRoom(contactWs, { roomId: "room1" });

      expect(join1Response.type).toBe("join-approved");
      expect(join2Response.type).toBe("error");
      expect(join2Response.message).toBe("Already in room");
    });

    it("should handle inactive room join attempts", () => {
      const user = createMockUser("mutual");
      const contact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(contact);

      handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact.phone_no]
      });

      const room = mockRooms.get("room1");
      if (room) {
        room.isActive = false;
      }

      const joinResponse = handleJoinRoom(contactWs, { roomId: "room1" });

      expect(joinResponse.type).toBe("join-denied");
      expect(joinResponse.message).toBe("Room is not active");
    });

    it("should handle SOS trigger for user with no owned rooms", () => {
      const user = createMockUser("mutual");
      const contact = createMockUser("mutual");

      const userWs = connectWebSocket(user);
      const contactWs = connectWebSocket(contact);

      const room = handleCreateRoom(userWs, {
        roomId: "room1",
        emergencyContacts: [contact.phone_no]
      });

      const ownerWs = connectWebSocket(createMockUser("mutual"));

      const sosResponse = handleEmergencySOS(ownerWs);

      expect(sosResponse.type).toBe("error");
      expect(sosResponse.message).toBe("No owned rooms found");
    });

    it("should handle ping/pong for connection health", () => {
      const user = createMockUser("mutual");
      const ws = connectWebSocket(user);

      const pingResponse = {
        type: "pong",
        timestamp: new Date().toISOString()
      };

      ws.send(JSON.stringify(pingResponse));

      expect(ws.sentMessages[ws.sentMessages.length - 1].type).toBe("pong");
    });
  });
});

describe("Edge Cases and Error Handling", () => {
  it("should handle joining non-existent room", () => {
    const user = createMockUser("mutual");
    const ws = connectWebSocket(user);

    const joinResponse = handleJoinRoom(ws, { roomId: "non-existent-room" });

    expect(joinResponse.type).toBe("join-denied");
    expect(joinResponse.message).toBe("Room not found");
  });

  it("should handle get_users for non-existent room", () => {
    const user = createMockUser("mutual");
    const ws = connectWebSocket(user);

    const response = handleGetUsers(ws, "non-existent-room");

    expect(response.type).toBe("error");
    expect(response.message).toContain("Room not found or access denied");
  });

  it("should handle creating room with duplicate ID", () => {
    const user = createMockUser("mutual");
    const ws = connectWebSocket(user);

    const contact = createMockUser("mutual");

    handleCreateRoom(ws, {
      roomId: "room1",
      emergencyContacts: [contact.phone_no]
    });

    const duplicateRoomResponse = handleCreateRoom(ws, {
      roomId: "room1",
      emergencyContacts: [contact.phone_no]
    });

    expect(duplicateRoomResponse.type).toBe("error");
    expect(duplicateRoomResponse.message).toBe("Room already exists");
  });

  it("should handle location upload for user not in any room", () => {
    const user = createMockUser("mutual");
    const ws = connectWebSocket(user);

    const response = handleLocationUpload(user, {
      latitude: 14.5995,
      longitude: 120.9842,
      timestamp: "2026-01-18T10:00:00.000Z",
      accuracy: 12
    });

    expect(response.error).toBe("User is not in any active room");
  });

  it("should handle emergency contact with no authorized rooms", () => {
    const user1 = createMockUser("mutual");
    const user2 = createMockUser("mutual");
    const emergencyContact = createMockUser("mutual");

    const user1Ws = connectWebSocket(user1);
    const user2Ws = connectWebSocket(user2);

    handleCreateRoom(user1Ws, {
      roomId: "room1",
      emergencyContacts: ["09999999999"]
    });

    handleCreateRoom(user2Ws, {
      roomId: "room2",
      emergencyContacts: ["09999999999"]
    });

    const contactWs = connectWebSocket(emergencyContact);

    autoJoinEmergencyContacts(contactWs.id, contactWs);

    expect(contactWs.roomIds.size).toBe(0);
  });

  it("should handle room with empty emergency contacts", () => {
    const user = createMockUser("mutual");
    const ws = connectWebSocket(user);

    const roomResponse = handleCreateRoom(ws, {
      roomId: "room1",
      emergencyContacts: []
    });

    expect(roomResponse.type).toBe("room-created");
    expect(roomResponse.emergencyContacts).toEqual([]);

    const room = mockRooms.get("room1");
    expect(room?.emergencyContacts).toEqual([]);
  });

  it("should handle multiple users in multiple rooms simultaneously", () => {
    const user1 = createMockUser("mutual");
    const user2 = createMockUser("mutual");
    const user3 = createMockUser("mutual");

    const user1Ws = connectWebSocket(user1);
    const user2Ws = connectWebSocket(user2);
    const user3Ws = connectWebSocket(user3);

    handleCreateRoom(user1Ws, {
      roomId: "room1",
      emergencyContacts: [user2.phone_no, user3.phone_no]
    });

    handleCreateRoom(user2Ws, {
      roomId: "room2",
      emergencyContacts: [user1.phone_no, user3.phone_no]
    });

    handleCreateRoom(user3Ws, {
      roomId: "room3",
      emergencyContacts: [user1.phone_no, user2.phone_no]
    });

    handleJoinRoom(user2Ws, { roomId: "room1" });
    handleJoinRoom(user3Ws, { roomId: "room1" });
    handleJoinRoom(user1Ws, { roomId: "room2" });
    handleJoinRoom(user3Ws, { roomId: "room2" });
    handleJoinRoom(user1Ws, { roomId: "room3" });
    handleJoinRoom(user2Ws, { roomId: "room3" });

    expect(user1Ws.roomIds.size).toBe(3);
    expect(user2Ws.roomIds.size).toBe(3);
    expect(user3Ws.roomIds.size).toBe(3);
  });
});
