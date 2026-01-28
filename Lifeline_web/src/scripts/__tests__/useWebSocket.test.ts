import { describe, it, expect, beforeEach } from "vitest";
import { webSocketReducer } from "../useWebSocket";
import type {
  WebSocketState,
  WebSocketAction,
  ConnectedMessage,
  LocationUpdateMessage,
  EmergencyAlertMessage,
  UserJoinedMessage,
  UserLeftMessage,
  AutoJoinedMessage,
  BackendUser,
} from "../../types/realtime";

// ============================================================================
// Test Fixtures
// ============================================================================

const createInitialState = (): WebSocketState => ({
  connectionStatus: "disconnected",
  lastError: null,
  clientId: null,
  user: null,
  rooms: new Map(),
  locations: new Map(),
  presence: new Map(),
  alerts: [],
});

const mockUser: BackendUser = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
  role: "user",
  phone_no: "+1234567890",
};

const mockTimestamp = "2026-01-25T12:00:00.000Z";

// ============================================================================
// Tests
// ============================================================================

describe("webSocketReducer", () => {
  let initialState: WebSocketState;

  beforeEach(() => {
    initialState = createInitialState();
  });

  // --------------------------------------------------------------------------
  // 1. CONNECTING
  // --------------------------------------------------------------------------
  describe("CONNECTING", () => {
    it("sets status to 'connecting' and clears error", () => {
      const stateWithError: WebSocketState = {
        ...initialState,
        connectionStatus: "error",
        lastError: "Previous connection failed",
      };

      const action: WebSocketAction = { type: "CONNECTING" };
      const newState = webSocketReducer(stateWithError, action);

      expect(newState.connectionStatus).toBe("connecting");
      expect(newState.lastError).toBeNull();
    });

    it("transitions from disconnected to connecting", () => {
      const action: WebSocketAction = { type: "CONNECTING" };
      const newState = webSocketReducer(initialState, action);

      expect(newState.connectionStatus).toBe("connecting");
    });
  });

  // --------------------------------------------------------------------------
  // 2. CONNECTED
  // --------------------------------------------------------------------------
  describe("CONNECTED", () => {
    it("sets clientId, user, rooms from payload and status to 'connected'", () => {
      const connectedPayload: ConnectedMessage = {
        type: "connected",
        clientId: "client-abc",
        user: mockUser,
        roomIds: ["room-1", "room-2"],
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "CONNECTED", payload: connectedPayload };
      const newState = webSocketReducer(initialState, action);

      expect(newState.connectionStatus).toBe("connected");
      expect(newState.clientId).toBe("client-abc");
      expect(newState.user).toEqual(mockUser);
      expect(newState.rooms.size).toBe(2);
      expect(newState.rooms.has("room-1")).toBe(true);
      expect(newState.rooms.has("room-2")).toBe(true);
      expect(newState.rooms.get("room-1")?.roomId).toBe("room-1");
      expect(newState.lastError).toBeNull();
    });

    it("clears previous error on connected", () => {
      const stateWithError: WebSocketState = {
        ...initialState,
        lastError: "Connection timeout",
      };

      const connectedPayload: ConnectedMessage = {
        type: "connected",
        clientId: "client-xyz",
        user: mockUser,
        roomIds: [],
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "CONNECTED", payload: connectedPayload };
      const newState = webSocketReducer(stateWithError, action);

      expect(newState.lastError).toBeNull();
    });

    it("handles empty roomIds array", () => {
      const connectedPayload: ConnectedMessage = {
        type: "connected",
        clientId: "client-solo",
        user: mockUser,
        roomIds: [],
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "CONNECTED", payload: connectedPayload };
      const newState = webSocketReducer(initialState, action);

      expect(newState.rooms.size).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. RECONNECTING
  // --------------------------------------------------------------------------
  describe("RECONNECTING", () => {
    it("sets status to 'reconnecting'", () => {
      const connectedState: WebSocketState = {
        ...initialState,
        connectionStatus: "connected",
        clientId: "client-123",
      };

      const action: WebSocketAction = { type: "RECONNECTING" };
      const newState = webSocketReducer(connectedState, action);

      expect(newState.connectionStatus).toBe("reconnecting");
      // Should preserve other state
      expect(newState.clientId).toBe("client-123");
    });
  });

  // --------------------------------------------------------------------------
  // 4. DISCONNECTED
  // --------------------------------------------------------------------------
  describe("DISCONNECTED", () => {
    it("sets status to 'disconnected' and clears clientId and user", () => {
      const connectedState: WebSocketState = {
        ...initialState,
        connectionStatus: "connected",
        clientId: "client-123",
        user: mockUser,
        rooms: new Map([["room-1", { roomId: "room-1", joinedAt: mockTimestamp }]]),
        locations: new Map([["user-1", { userId: "user-1", userName: "Test", roomId: "room-1", coords: { lat: 0, lng: 0 }, timestamp: mockTimestamp }]]),
      };

      const action: WebSocketAction = { type: "DISCONNECTED" };
      const newState = webSocketReducer(connectedState, action);

      expect(newState.connectionStatus).toBe("disconnected");
      expect(newState.clientId).toBeNull();
      expect(newState.user).toBeNull();
      // Should preserve rooms, locations etc
      expect(newState.rooms.size).toBe(1);
      expect(newState.locations.size).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 5. ERROR
  // --------------------------------------------------------------------------
  describe("ERROR", () => {
    it("sets status to 'error' and stores error message", () => {
      const action: WebSocketAction = { type: "ERROR", payload: "Connection refused" };
      const newState = webSocketReducer(initialState, action);

      expect(newState.connectionStatus).toBe("error");
      expect(newState.lastError).toBe("Connection refused");
    });

    it("updates error message on subsequent errors", () => {
      const stateWithError: WebSocketState = {
        ...initialState,
        connectionStatus: "error",
        lastError: "First error",
      };

      const action: WebSocketAction = { type: "ERROR", payload: "Second error" };
      const newState = webSocketReducer(stateWithError, action);

      expect(newState.lastError).toBe("Second error");
    });
  });

  // --------------------------------------------------------------------------
  // 6. CLEAR_ERROR
  // --------------------------------------------------------------------------
  describe("CLEAR_ERROR", () => {
    it("clears lastError", () => {
      const stateWithError: WebSocketState = {
        ...initialState,
        connectionStatus: "error",
        lastError: "Some error occurred",
      };

      const action: WebSocketAction = { type: "CLEAR_ERROR" };
      const newState = webSocketReducer(stateWithError, action);

      expect(newState.lastError).toBeNull();
      // Status remains unchanged
      expect(newState.connectionStatus).toBe("error");
    });

    it("does nothing if no error exists", () => {
      const action: WebSocketAction = { type: "CLEAR_ERROR" };
      const newState = webSocketReducer(initialState, action);

      expect(newState.lastError).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 7. LOCATION_UPDATE
  // --------------------------------------------------------------------------
  describe("LOCATION_UPDATE", () => {
    it("adds location to Map and updates presence to online", () => {
      const locationPayload: LocationUpdateMessage = {
        type: "location-update",
        roomId: "room-1",
        data: {
          userId: "user-456",
          userName: "Jane Doe",
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: mockTimestamp,
          accuracy: 10,
        },
      };

      const action: WebSocketAction = { type: "LOCATION_UPDATE", payload: locationPayload };
      const newState = webSocketReducer(initialState, action);

      // Check location was added
      expect(newState.locations.size).toBe(1);
      const location = newState.locations.get("user-456");
      expect(location).toBeDefined();
      expect(location?.userId).toBe("user-456");
      expect(location?.userName).toBe("Jane Doe");
      expect(location?.roomId).toBe("room-1");
      expect(location?.coords.lat).toBe(40.7128);
      expect(location?.coords.lng).toBe(-74.006);
      expect(location?.accuracy).toBe(10);

      // Check presence was updated
      expect(newState.presence.size).toBe(1);
      const presence = newState.presence.get("user-456");
      expect(presence).toBeDefined();
      expect(presence?.status).toBe("online");
      expect(presence?.userName).toBe("Jane Doe");
    });

    it("updates existing location for same user", () => {
      const existingState: WebSocketState = {
        ...initialState,
        locations: new Map([
          ["user-456", {
            userId: "user-456",
            userName: "Jane Doe",
            roomId: "room-1",
            coords: { lat: 40.0, lng: -74.0 },
            timestamp: "2026-01-25T11:00:00.000Z",
          }],
        ]),
      };

      const locationPayload: LocationUpdateMessage = {
        type: "location-update",
        roomId: "room-1",
        data: {
          userId: "user-456",
          userName: "Jane Doe",
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: mockTimestamp,
        },
      };

      const action: WebSocketAction = { type: "LOCATION_UPDATE", payload: locationPayload };
      const newState = webSocketReducer(existingState, action);

      expect(newState.locations.size).toBe(1);
      const location = newState.locations.get("user-456");
      expect(location?.coords.lat).toBe(40.7128);
      expect(location?.coords.lng).toBe(-74.006);
      expect(location?.timestamp).toBe(mockTimestamp);
    });
  });

  // --------------------------------------------------------------------------
  // 8. EMERGENCY_ALERT
  // --------------------------------------------------------------------------
  describe("EMERGENCY_ALERT", () => {
    it("adds new alert to alerts array with generated id", () => {
      const alertPayload: EmergencyAlertMessage = {
        type: "emergency-alert",
        emergencyUserId: "user-emergency",
        emergencyUserName: "Emergency User",
        roomId: "room-sos",
        message: "Help needed!",
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "EMERGENCY_ALERT", payload: alertPayload };
      const newState = webSocketReducer(initialState, action);

      expect(newState.alerts.length).toBe(1);
      const alert = newState.alerts[0];
      expect(alert.id).toMatch(/^alert_\d+_[a-z0-9]+$/);
      expect(alert.emergencyUserId).toBe("user-emergency");
      expect(alert.emergencyUserName).toBe("Emergency User");
      expect(alert.roomId).toBe("room-sos");
      expect(alert.message).toBe("Help needed!");
      expect(alert.acknowledged).toBe(false);
    });

    it("prepends new alerts to the beginning of the array", () => {
      const existingState: WebSocketState = {
        ...initialState,
        alerts: [{
          id: "alert_existing",
          emergencyUserId: "user-1",
          emergencyUserName: "First User",
          roomId: "room-1",
          message: "First alert",
          timestamp: "2026-01-25T10:00:00.000Z",
          acknowledged: false,
        }],
      };

      const alertPayload: EmergencyAlertMessage = {
        type: "emergency-alert",
        emergencyUserId: "user-2",
        emergencyUserName: "Second User",
        roomId: "room-2",
        message: "Second alert",
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "EMERGENCY_ALERT", payload: alertPayload };
      const newState = webSocketReducer(existingState, action);

      expect(newState.alerts.length).toBe(2);
      expect(newState.alerts[0].emergencyUserName).toBe("Second User");
      expect(newState.alerts[1].emergencyUserName).toBe("First User");
    });
  });

  // --------------------------------------------------------------------------
  // 9. USER_JOINED
  // --------------------------------------------------------------------------
  describe("USER_JOINED", () => {
    it("adds user to presence as online", () => {
      const userJoinedPayload: UserJoinedMessage = {
        type: "user-joined",
        clientId: "client-new",
        user: {
          id: "user-new",
          name: "New User",
          email: "new@example.com",
          role: "user",
          phone_no: "+9876543210",
        },
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "USER_JOINED", payload: userJoinedPayload, roomId: "room-1" };
      const newState = webSocketReducer(initialState, action);

      expect(newState.presence.size).toBe(1);
      const presence = newState.presence.get("user-new");
      expect(presence).toBeDefined();
      expect(presence?.userId).toBe("user-new");
      expect(presence?.userName).toBe("New User");
      expect(presence?.status).toBe("online");
      expect(presence?.lastSeen).toBe(mockTimestamp);
    });

    it("updates existing user presence to online", () => {
      const existingState: WebSocketState = {
        ...initialState,
        presence: new Map([
          ["user-existing", {
            userId: "user-existing",
            userName: "Existing User",
            status: "offline",
            lastSeen: "2026-01-25T10:00:00.000Z",
          }],
        ]),
      };

      const userJoinedPayload: UserJoinedMessage = {
        type: "user-joined",
        clientId: "client-existing",
        user: {
          id: "user-existing",
          name: "Existing User",
          email: "existing@example.com",
          role: "user",
          phone_no: "+1111111111",
        },
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "USER_JOINED", payload: userJoinedPayload, roomId: "room-1" };
      const newState = webSocketReducer(existingState, action);

      const presence = newState.presence.get("user-existing");
      expect(presence?.status).toBe("online");
      expect(presence?.lastSeen).toBe(mockTimestamp);
    });
  });

  // --------------------------------------------------------------------------
  // 10. USER_LEFT
  // --------------------------------------------------------------------------
  describe("USER_LEFT", () => {
    it("updates user presence to offline", () => {
      const existingState: WebSocketState = {
        ...initialState,
        presence: new Map([
          ["user-leaving", {
            userId: "user-leaving",
            userName: "Leaving User",
            status: "online",
            lastSeen: "2026-01-25T10:00:00.000Z",
          }],
        ]),
      };

      const userLeftPayload: UserLeftMessage = {
        type: "user-left",
        clientId: "user-leaving",
        userName: "Leaving User",
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "USER_LEFT", payload: userLeftPayload, roomId: "room-1" };
      const newState = webSocketReducer(existingState, action);

      const presence = newState.presence.get("user-leaving");
      expect(presence).toBeDefined();
      expect(presence?.status).toBe("offline");
      expect(presence?.lastSeen).toBe(mockTimestamp);
    });

    it("does nothing if user not in presence map", () => {
      const userLeftPayload: UserLeftMessage = {
        type: "user-left",
        clientId: "unknown-user",
        userName: "Unknown",
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "USER_LEFT", payload: userLeftPayload, roomId: "room-1" };
      const newState = webSocketReducer(initialState, action);

      expect(newState.presence.size).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 11. AUTO_JOINED
  // --------------------------------------------------------------------------
  describe("AUTO_JOINED", () => {
    it("adds room to rooms Map", () => {
      const autoJoinedPayload: AutoJoinedMessage = {
        type: "auto-joined",
        roomId: "room-auto",
        roomOwner: "owner-123",
        message: "Auto-joined as emergency contact",
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "AUTO_JOINED", payload: autoJoinedPayload };
      const newState = webSocketReducer(initialState, action);

      expect(newState.rooms.size).toBe(1);
      const room = newState.rooms.get("room-auto");
      expect(room).toBeDefined();
      expect(room?.roomId).toBe("room-auto");
      expect(room?.ownerId).toBe("owner-123");
      expect(room?.joinedAt).toBe(mockTimestamp);
    });

    it("does not duplicate existing rooms", () => {
      const existingState: WebSocketState = {
        ...initialState,
        rooms: new Map([
          ["room-auto", { roomId: "room-auto", ownerId: "owner-old", joinedAt: "2026-01-25T10:00:00.000Z" }],
        ]),
      };

      const autoJoinedPayload: AutoJoinedMessage = {
        type: "auto-joined",
        roomId: "room-auto",
        roomOwner: "owner-new",
        message: "Auto-joined again",
        timestamp: mockTimestamp,
      };

      const action: WebSocketAction = { type: "AUTO_JOINED", payload: autoJoinedPayload };
      const newState = webSocketReducer(existingState, action);

      expect(newState.rooms.size).toBe(1);
      // Should be updated with new data
      const room = newState.rooms.get("room-auto");
      expect(room?.ownerId).toBe("owner-new");
    });
  });

  // --------------------------------------------------------------------------
  // 12. ACKNOWLEDGE_ALERT
  // --------------------------------------------------------------------------
  describe("ACKNOWLEDGE_ALERT", () => {
    it("marks specific alert as acknowledged", () => {
      const existingState: WebSocketState = {
        ...initialState,
        alerts: [
          {
            id: "alert-1",
            emergencyUserId: "user-1",
            emergencyUserName: "User 1",
            roomId: "room-1",
            message: "Alert 1",
            timestamp: mockTimestamp,
            acknowledged: false,
          },
          {
            id: "alert-2",
            emergencyUserId: "user-2",
            emergencyUserName: "User 2",
            roomId: "room-2",
            message: "Alert 2",
            timestamp: mockTimestamp,
            acknowledged: false,
          },
        ],
      };

      const action: WebSocketAction = { type: "ACKNOWLEDGE_ALERT", payload: "alert-1" };
      const newState = webSocketReducer(existingState, action);

      expect(newState.alerts.length).toBe(2);
      expect(newState.alerts.find((a) => a.id === "alert-1")?.acknowledged).toBe(true);
      expect(newState.alerts.find((a) => a.id === "alert-2")?.acknowledged).toBe(false);
    });

    it("does nothing for non-existent alert id", () => {
      const existingState: WebSocketState = {
        ...initialState,
        alerts: [
          {
            id: "alert-1",
            emergencyUserId: "user-1",
            emergencyUserName: "User 1",
            roomId: "room-1",
            message: "Alert 1",
            timestamp: mockTimestamp,
            acknowledged: false,
          },
        ],
      };

      const action: WebSocketAction = { type: "ACKNOWLEDGE_ALERT", payload: "nonexistent-id" };
      const newState = webSocketReducer(existingState, action);

      expect(newState.alerts.length).toBe(1);
      expect(newState.alerts[0].acknowledged).toBe(false);
    });

    it("does not double-acknowledge already acknowledged alerts", () => {
      const existingState: WebSocketState = {
        ...initialState,
        alerts: [
          {
            id: "alert-1",
            emergencyUserId: "user-1",
            emergencyUserName: "User 1",
            roomId: "room-1",
            message: "Alert 1",
            timestamp: mockTimestamp,
            acknowledged: true,
          },
        ],
      };

      const action: WebSocketAction = { type: "ACKNOWLEDGE_ALERT", payload: "alert-1" };
      const newState = webSocketReducer(existingState, action);

      expect(newState.alerts[0].acknowledged).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Default case
  // --------------------------------------------------------------------------
  describe("default case", () => {
    it("returns unchanged state for unknown action", () => {
      const action = { type: "UNKNOWN_ACTION" } as unknown as WebSocketAction;
      const newState = webSocketReducer(initialState, action);

      expect(newState).toBe(initialState);
    });
  });
});
