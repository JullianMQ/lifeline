import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { WebSocket } from "ws";
import { dbPool } from "../src/lib/db";
import {
  TEST_USERS,
  TEST_SERVER_URL,
  TEST_API_URL,
  authenticateUser,
  formatCookies,
  createAuthenticatedWebSocket,
  waitForMessage,
  sendMessage,
  sleep,
  type AuthCookies,
  type WebSocketMessage
} from "./test-utils";



describe("WebSocket Real Integration Tests", () => {
  let test1Cookies: ReturnType<typeof formatCookies>;
  let test2Cookies: ReturnType<typeof formatCookies>;
  let test3Cookies: ReturnType<typeof formatCookies>;

  beforeAll(async () => {
    console.log("\n=== Starting Real Integration Tests ===");
    console.log("Authenticating test users...");

    try {
      test1Cookies = await authenticateUser(TEST_USERS[0].email, TEST_USERS[0].password);
      test2Cookies = await authenticateUser(TEST_USERS[1].email, TEST_USERS[1].password);
      test3Cookies = await authenticateUser(TEST_USERS[2].email, TEST_USERS[2].password);
      console.log("✅ All test users authenticated");
    } catch (error) {
      console.error("❌ Authentication failed:", error);
      throw error;
    }
  });

  afterAll(async () => {
    console.log("\n=== Integration Tests Complete ===");
  });

  describe("Test 1: Multi-Room Creation & Emergency Contact Loading", () => {
    let ws1: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);
    });

    afterEach(() => ws1.close());

    it("should create multiple rooms with emergency contacts", async () => {
      let roomCreatedCount = 0;
      const roomIds: string[] = [];

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomCreatedCount++;
          roomIds.push(message.roomId);
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 200));
      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(roomCreatedCount).toBe(2);
      expect(roomIds).toHaveLength(2);
      expect(roomIds[0]).not.toBe(roomIds[1]);
      console.log("✅ Created 2 rooms with emergency contacts");
    });

    it("should load emergency contacts in each room", async () => {
      let roomCreatedMessage: WebSocketMessage | null = null;

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomCreatedMessage = message;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(roomCreatedMessage).not.toBeNull();
      expect(roomCreatedMessage?.emergencyContacts).toBeGreaterThan(0);
      console.log("✅ Emergency contacts loaded:", roomCreatedMessage?.emergencyContacts);
    });
  });

  describe("Test 2: Emergency Contact Multi-Room Immediate Access", () => {
    let ws1: WebSocket;
    let ws2: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);

      ws2 = await createAuthenticatedWebSocket(test2Cookies);
      await waitForMessage(ws2);
    });

    afterEach(() => {
      ws1.close();
      ws2.close();
    });

    it("should allow emergency contact to join room immediately", async () => {
      let roomId: string | null = null;

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(roomId).not.toBeNull();

      let joinApproved = false;
      ws2.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "join-approved") {
          joinApproved = true;
        }
      });

      await sendMessage(ws2, { type: "join-room", roomId });
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(joinApproved).toBe(true);
      console.log("✅ Emergency test2 joined test1's room immediately");
    });
  });

  describe("Test 3: Non-Contact Multi-Room Access Denied", () => {
    let ws1: WebSocket;
    let ws3: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);

      ws3 = await createAuthenticatedWebSocket(test3Cookies);
      await waitForMessage(ws3);
    });

    afterEach(() => {
      ws1.close();
      ws3.close();
    });

    it("should deny access to non-emergency contact", async () => {
      let roomId: string | null = null;

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(roomId).not.toBeNull();

      let joinDenied = false;
      ws3.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "join-denied") {
          joinDenied = true;
        }
      });

      await sendMessage(ws3, { type: "join-room", roomId });
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(joinDenied).toBe(true);
      console.log("✅ Non-contact test3 denied access to test1's room");
    });
  });

  describe("Test 4: Auto-Join on Connection", () => {
    let ws2: WebSocket;
    let ws1: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);

      let roomId: string | null = null;
      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 300));

      ws2 = await createAuthenticatedWebSocket(test2Cookies);
    });

    afterEach(() => {
      ws1.close();
      ws2.close();
    });

    it("should auto-join emergency contact to authorized room", async () => {
      const messages: WebSocketMessage[] = [];

      ws2.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        messages.push(message);
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      const autoJoined = messages.find(m => m.type === "auto-joined");
      const autoJoinSummary = messages.find(m => m.type === "auto-join-summary");

      expect(autoJoined).toBeDefined();
      expect(autoJoinSummary).toBeDefined();
      expect(autoJoinSummary?.roomsJoined?.length).toBeGreaterThan(0);
      console.log("✅ test2 auto-joined to", autoJoinSummary?.roomsJoined?.length, "room(s)");
    });
  });

  describe("Test 5: Room Messaging", () => {
    let ws1: WebSocket;
    let ws2: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);

      ws2 = await createAuthenticatedWebSocket(test2Cookies);
      await waitForMessage(ws2);

      let roomId: string | null = null;
      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 300));

      await sendMessage(ws2, { type: "join-room", roomId });
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    afterEach(() => {
      ws1.close();
      ws2.close();
    });

    it("should broadcast room message to all members", async () => {
      let roomId: string | null = null;

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      const messages: WebSocketMessage[] = [];
      ws2.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        messages.push(message);
      });

      await sendMessage(ws1, {
        type: "room-message",
        roomId,
        content: "Hello from test1!"
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      const roomMessage = messages.find(m => m.type === "room-message");
      expect(roomMessage).toBeDefined();
      expect(roomMessage?.content).toBe("Hello from test1!");
      expect(roomMessage?.userName).toBe("test 1");
      console.log("✅ Room message broadcast successfully");
    });
  });

  describe("Test 6: Location Broadcasting", () => {
    let ws1: WebSocket;
    let ws2: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);

      ws2 = await createAuthenticatedWebSocket(test2Cookies);
      await waitForMessage(ws2);

      let roomId: string | null = null;
      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 300));

      await sendMessage(ws2, { type: "join-room", roomId });
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    afterEach(() => {
      ws1.close();
      ws2.close();
    });

    it("should broadcast location update to room members", async () => {
      let roomId: string | null = null;

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      const messages: WebSocketMessage[] = [];
      ws2.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        messages.push(message);
      });

      const locationData = {
        latitude: 14.5995,
        longitude: 120.9842,
        timestamp: new Date().toISOString(),
        accuracy: 10
      };

      const response = await fetch(`${TEST_API_URL}/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": formatCookies(test1Cookies)
        },
        body: JSON.stringify(locationData)
      });

      expect(response.ok).toBe(true);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 300));

      const locationUpdate = messages.find(m => m.type === "location-update");
      expect(locationUpdate).toBeDefined();
      expect(locationUpdate?.data?.latitude).toBe(14.5995);
      expect(locationUpdate?.data?.longitude).toBe(120.9842);
      console.log("✅ Location update broadcast successfully");
    });
  });

  describe("Test 7: Emergency SOS Trigger", () => {
    let ws1: WebSocket;
    let ws2: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);

      ws2 = await createAuthenticatedWebSocket(test2Cookies);
      await waitForMessage(ws2);

      let roomId: string | null = null;
      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 300));

      await sendMessage(ws2, { type: "join-room", roomId });
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    afterEach(() => {
      ws1.close();
      ws2.close();
    });

    it("should trigger emergency SOS and notify emergency contacts", async () => {
      const ws1Messages: WebSocketMessage[] = [];
      const ws2Messages: WebSocketMessage[] = [];

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        ws1Messages.push(message);
      });

      ws2.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        ws2Messages.push(message);
      });

      await sendMessage(ws1, { type: "emergency-sos" });
      await new Promise(resolve => setTimeout(resolve, 300));

      const emergencyConfirmed = ws1Messages.find(m => m.type === "emergency-confirmed");
      const emergencyAlert = ws2Messages.find(m => m.type === "emergency-alert");
      const emergencyActivated = ws2Messages.find(m => m.type === "emergency-activated");

      expect(emergencyConfirmed).toBeDefined();
      expect(emergencyAlert).toBeDefined();
      expect(emergencyActivated).toBeDefined();
      expect(emergencyAlert?.emergencyUserId).toBe(TEST_USERS[0].id);
      console.log("✅ Emergency SOS triggered and contacts notified");
    });
  });

  describe("Test 8: Room Users List", () => {
    let ws1: WebSocket;
    let ws2: WebSocket;

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket(test1Cookies);
      await waitForMessage(ws1);

      ws2 = await createAuthenticatedWebSocket(test2Cookies);
      await waitForMessage(ws2);

      let roomId: string | null = null;
      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      await sendMessage(ws1, { type: "create-room" });
      await new Promise(resolve => setTimeout(resolve, 300));

      await sendMessage(ws2, { type: "join-room", roomId });
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    afterEach(() => {
      ws1.close();
      ws2.close();
    });

    it("should return list of users in room", async () => {
      let roomId: string | null = null;

      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-created") {
          roomId = message.roomId;
        }
      });

      let roomUsersMessage: WebSocketMessage | null = null;
      ws1.on("message", (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === "room-users") {
          roomUsersMessage = message;
        }
      });

      await sendMessage(ws1, { type: "get_users", roomId });
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(roomUsersMessage).not.toBeNull();
      expect(roomUsersMessage?.users).toBeDefined();
      expect(roomUsersMessage?.users?.length).toBeGreaterThan(0);
      console.log("✅ Room users list returned:", roomUsersMessage?.users?.length, "user(s)");
    });
  });
});
