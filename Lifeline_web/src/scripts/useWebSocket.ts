/**
 * WebSocket hook for real-time Lifeline dashboard monitoring
 * Connects to /api/ws with BetterAuth session cookies
 */

import { useReducer, useCallback, useRef, useEffect } from "react";
import { API_BASE_URL } from "../config/api";
import { saveLocation } from "./locationStorage";
import type {
  WebSocketState,
  WebSocketAction,
  UseWebSocketReturn,
  BackendMessage,
  LocationUpdateMessage,
  EmergencyAlertMessage,
  EmergencyActivatedMessage,
  UserJoinedMessage,
  UserLeftMessage,
  AutoJoinedMessage,
  RoomCreatedMessage,
  JoinApprovedMessage,
  ConnectedMessage,
  LocationData,
  EmergencyAlert,
  PresenceInfo,
  RoomInfo,
} from "../types/realtime";

// ============================================================================
// Constants
// ============================================================================

const WS_BASE_URL = API_BASE_URL
  .replace("https://", "wss://")
  .replace("http://", "ws://");

const SOCKET_URL = `${WS_BASE_URL}/api/ws`;

/** Retry delays in ms: 1s, 3s, 5s */
const RETRY_DELAYS = [1000, 3000, 5000];

/** Ping interval to keep connection alive (30s) */
const PING_INTERVAL = 30000;

// ============================================================================
// Initial State
// ============================================================================

const initialState: WebSocketState = {
  connectionStatus: "disconnected",
  lastError: null,
  clientId: null,
  user: null,
  rooms: new Map(),
  locations: new Map(),
  presence: new Map(),
  alerts: [],
  stateVersion: 0,
};

// ============================================================================
// Reducer
// ============================================================================

function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function webSocketReducer(
  state: WebSocketState,
  action: WebSocketAction
): WebSocketState {
  console.log("[WebSocket Reducer] Action:", action.type, action);
  
  let newState: WebSocketState;
  
  switch (action.type) {
    case "CONNECTING":
      newState = {
        ...state,
        connectionStatus: "connecting",
        lastError: null,
      };
      console.log("[WebSocket Reducer] State after CONNECTING:", newState);
      return newState;

    case "CONNECTED": {
      const { clientId, user, roomIds } = action.payload;
      const rooms = new Map<string, RoomInfo>();
      const now = new Date().toISOString();
      
      console.log("[WebSocket Reducer] CONNECTED - processing roomIds:", roomIds);
      
      roomIds.forEach((roomId) => {
        rooms.set(roomId, { roomId, joinedAt: now });
        console.log("[WebSocket Reducer] Added room to state:", roomId);
      });

      newState = {
        ...state,
        connectionStatus: "connected",
        lastError: null,
        clientId,
        user,
        rooms,
        stateVersion: state.stateVersion + 1,
      };
      console.log("[WebSocket Reducer] State after CONNECTED:", {
        connectionStatus: newState.connectionStatus,
        clientId: newState.clientId,
        user: newState.user,
        roomCount: newState.rooms.size,
        rooms: Array.from(newState.rooms.keys()),
        stateVersion: newState.stateVersion,
      });
      return newState;
    }

    case "RECONNECTING":
      return {
        ...state,
        connectionStatus: "reconnecting",
      };

    case "DISCONNECTED":
      return {
        ...state,
        connectionStatus: "disconnected",
        clientId: null,
        user: null,
      };

    case "ERROR":
      return {
        ...state,
        connectionStatus: "error",
        lastError: action.payload,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        lastError: null,
      };

    case "LOCATION_UPDATE": {
      const { roomId, data } = action.payload;
      const newLocations = new Map(state.locations);
      
      console.log("[WebSocket Reducer] LOCATION_UPDATE - processing for roomId:", roomId);
      console.log("[WebSocket Reducer] LOCATION_UPDATE - data:", data);
      
      const locationData: LocationData = {
        userId: data.userId,
        userName: data.userName,
        roomId,
        coords: {
          lat: data.latitude,
          lng: data.longitude,
        },
        accuracy: data.accuracy,
        timestamp: data.timestamp,
      };
      
      console.log("[WebSocket Reducer] LOCATION_UPDATE - created locationData:", locationData);
      
      newLocations.set(data.userId, locationData);

      // Also update presence to online when we get location
      const newPresence = new Map(state.presence);
      newPresence.set(data.userId, {
        userId: data.userId,
        userName: data.userName,
        status: "online",
        lastSeen: data.timestamp,
      });

      newState = {
        ...state,
        locations: newLocations,
        presence: newPresence,
        stateVersion: state.stateVersion + 1,
      };
      
      console.log("[WebSocket Reducer] State after LOCATION_UPDATE:", {
        locationsCount: newState.locations.size,
        locationKeys: Array.from(newState.locations.keys()),
        presenceCount: newState.presence.size,
        latestLocation: locationData,
        stateVersion: newState.stateVersion,
      });
      
      return newState;
    }

    case "EMERGENCY_ALERT": {
      const alert: EmergencyAlert = {
        id: generateAlertId(),
        emergencyUserId: action.payload.emergencyUserId,
        emergencyUserName: action.payload.emergencyUserName,
        roomId: action.payload.roomId,
        message: action.payload.message,
        timestamp: action.payload.timestamp,
        acknowledged: false,
      };

      return {
        ...state,
        alerts: [alert, ...state.alerts],
      };
    }

    case "EMERGENCY_ACTIVATED": {
      // Similar to emergency alert but from room broadcast
      const existingAlert = state.alerts.find(
        (a) => a.roomId === action.payload.roomId && !a.acknowledged
      );
      
      if (existingAlert) {
        return state; // Already have an active alert for this room
      }

      const alert: EmergencyAlert = {
        id: generateAlertId(),
        emergencyUserId: action.payload.clientId,
        emergencyUserName: action.payload.userName,
        roomId: action.payload.roomId,
        message: "Emergency activated",
        timestamp: action.payload.timestamp,
        acknowledged: false,
      };

      return {
        ...state,
        alerts: [alert, ...state.alerts],
      };
    }

    case "USER_JOINED": {
      const { user } = action.payload;
      const newPresence = new Map(state.presence);
      
      newPresence.set(user.id, {
        userId: user.id,
        userName: user.name,
        status: "online",
        lastSeen: action.payload.timestamp,
      });

      return {
        ...state,
        presence: newPresence,
      };
    }

    case "USER_LEFT": {
      const { clientId, timestamp } = action.payload;
      const newPresence = new Map(state.presence);
      
      const existing = newPresence.get(clientId);
      if (existing) {
        newPresence.set(clientId, {
          ...existing,
          status: "offline",
          lastSeen: timestamp,
        });
      }

      return {
        ...state,
        presence: newPresence,
      };
    }

    case "AUTO_JOINED": {
      const { roomId, roomOwner, timestamp } = action.payload;
      const newRooms = new Map(state.rooms);
      
      console.log("[WebSocket Reducer] AUTO_JOINED - adding room:", roomId, "owner:", roomOwner);
      
      newRooms.set(roomId, {
        roomId,
        ownerId: roomOwner,
        joinedAt: timestamp,
      });

      newState = {
        ...state,
        rooms: newRooms,
        stateVersion: state.stateVersion + 1,
      };
      
      console.log("[WebSocket Reducer] State after AUTO_JOINED:", {
        roomsCount: newState.rooms.size,
        roomKeys: Array.from(newState.rooms.keys()),
        stateVersion: newState.stateVersion,
      });
      
      return newState;
    }

    case "ROOM_CREATED": {
      const { roomId, owner, timestamp } = action.payload;
      const newRooms = new Map(state.rooms);
      
      newRooms.set(roomId, {
        roomId,
        ownerId: owner,
        joinedAt: timestamp,
      });

      return {
        ...state,
        rooms: newRooms,
      };
    }

    case "JOIN_APPROVED": {
      const { roomId, timestamp } = action.payload;
      const newRooms = new Map(state.rooms);
      
      if (!newRooms.has(roomId)) {
        newRooms.set(roomId, {
          roomId,
          joinedAt: timestamp,
        });
      }

      return {
        ...state,
        rooms: newRooms,
      };
    }

    case "ACKNOWLEDGE_ALERT": {
      const alertId = action.payload;
      const newAlerts = state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      );

      return {
        ...state,
        alerts: newAlerts,
      };
    }

    case "CLEAR_ALERTS":
      return {
        ...state,
        alerts: [],
      };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useWebSocket(): UseWebSocketReturn {
  const [state, dispatch] = useReducer(webSocketReducer, initialState);
  
  const socketRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isManualDisconnectRef = useRef(false);

  // Clear any pending timers
  const clearTimers = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = event.data;
      
      // Ignore non-JSON messages
      if (typeof data !== "string" || !data.trim().startsWith("{")) {
        return;
      }

      const message: BackendMessage = JSON.parse(data);
      
      // Debug: Log all incoming messages
      console.log("[WebSocket] Received message:", message.type, message);

      switch (message.type) {
        case "connected": {
          const connectedMsg = message as ConnectedMessage;
          console.log("[WebSocket] CONNECTED - clientId:", connectedMsg.clientId);
          console.log("[WebSocket] CONNECTED - user:", connectedMsg.user);
          console.log("[WebSocket] CONNECTED - roomIds:", connectedMsg.roomIds);
          dispatch({ type: "CONNECTED", payload: connectedMsg });
          break;
        }

        case "location-update": {
          // Backend sends visiblePhone (phone number), not userId
          const locationMsg = message as any; // Use any since backend format differs from our types
          const data = locationMsg.data;
          
          console.log("[WebSocket] LOCATION UPDATE received:");
          console.log("  - roomId:", locationMsg.roomId);
          console.log("  - visiblePhone:", data?.visiblePhone);
          console.log("  - userName:", data?.userName);
          console.log("  - latitude:", data?.latitude);
          console.log("  - longitude:", data?.longitude);
          console.log("  - timestamp:", data?.timestamp);
          console.log("  - full data:", data);
          
          // Save to localStorage for persistence and cross-component reactivity
          // Use visiblePhone as the key since that's what the backend sends
          if (data && data.visiblePhone) {
            saveLocation({
              userId: data.visiblePhone, // Use phone as userId for consistency
              visiblePhone: data.visiblePhone,
              userName: data.userName,
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: data.accuracy,
              timestamp: data.timestamp,
            });
          } else {
            console.warn("[WebSocket] Location update missing visiblePhone:", data);
          }
          
          // Also dispatch to reducer (adapting the format)
          dispatch({ 
            type: "LOCATION_UPDATE", 
            payload: {
              type: "location-update",
              roomId: locationMsg.roomId || "",
              data: {
                userId: data?.visiblePhone || "", // Use phone as ID for consistency
                userName: data?.userName || "",
                latitude: data?.latitude || 0,
                longitude: data?.longitude || 0,
                timestamp: data?.timestamp || "",
                accuracy: data?.accuracy,
              }
            } as LocationUpdateMessage
          });
          break;
        }

        case "emergency-alert": {
          const alertMsg = message as EmergencyAlertMessage;
          console.log("[WebSocket] EMERGENCY ALERT received:");
          console.log("  - roomId:", alertMsg.roomId);
          console.log("  - emergencyUserId:", alertMsg.emergencyUserId);
          console.log("  - emergencyUserName:", alertMsg.emergencyUserName);
          console.log("  - message:", alertMsg.message);
          dispatch({ type: "EMERGENCY_ALERT", payload: alertMsg });
          break;
        }

        case "emergency-activated": {
          const activatedMsg = message as EmergencyActivatedMessage;
          console.log("[WebSocket] EMERGENCY ACTIVATED received:");
          console.log("  - roomId:", activatedMsg.roomId);
          console.log("  - clientId:", activatedMsg.clientId);
          console.log("  - userName:", activatedMsg.userName);
          dispatch({ type: "EMERGENCY_ACTIVATED", payload: activatedMsg });
          break;
        }

        case "user-joined": {
          const joinedMsg = message as UserJoinedMessage;
          console.log("[WebSocket] USER JOINED:");
          console.log("  - user:", joinedMsg.user);
          console.log("  - roomId:", joinedMsg.roomId);
          dispatch({ 
            type: "USER_JOINED", 
            payload: joinedMsg,
            roomId: joinedMsg.roomId || ""
          });
          break;
        }

        case "user-left": {
          const leftMsg = message as UserLeftMessage;
          console.log("[WebSocket] USER LEFT:");
          console.log("  - clientId:", leftMsg.clientId);
          console.log("  - roomId:", leftMsg.roomId);
          dispatch({ 
            type: "USER_LEFT", 
            payload: leftMsg,
            roomId: leftMsg.roomId || ""
          });
          break;
        }

        case "auto-joined": {
          const autoJoinedMsg = message as AutoJoinedMessage;
          console.log("[WebSocket] AUTO-JOINED room:");
          console.log("  - roomId:", autoJoinedMsg.roomId);
          console.log("  - roomOwner:", autoJoinedMsg.roomOwner);
          console.log("  - message:", autoJoinedMsg.message);
          dispatch({ type: "AUTO_JOINED", payload: autoJoinedMsg });
          break;
        }

        case "auto-join-summary": {
          // Handle multiple rooms joined
          const summary = message as { roomsJoined: Array<{ roomId: string; owner: string }>; timestamp: string };
          console.log("[WebSocket] AUTO-JOIN SUMMARY:");
          console.log("  - roomsJoined:", summary.roomsJoined);
          summary.roomsJoined.forEach(({ roomId, owner }) => {
            console.log(`  - Joining room: ${roomId}, owner: ${owner}`);
            dispatch({
              type: "AUTO_JOINED",
              payload: {
                type: "auto-joined",
                roomId,
                roomOwner: owner,
                message: "Auto-joined as emergency contact",
                timestamp: summary.timestamp,
              },
            });
          });
          break;
        }

        case "room-created": {
          const roomCreatedMsg = message as RoomCreatedMessage;
          console.log("[WebSocket] ROOM CREATED:");
          console.log("  - roomId:", roomCreatedMsg.roomId);
          console.log("  - owner:", roomCreatedMsg.owner);
          dispatch({ type: "ROOM_CREATED", payload: roomCreatedMsg });
          break;
        }

        case "join-approved": {
          const joinApprovedMsg = message as JoinApprovedMessage;
          console.log("[WebSocket] JOIN APPROVED:");
          console.log("  - roomId:", joinApprovedMsg.roomId);
          dispatch({ type: "JOIN_APPROVED", payload: joinApprovedMsg });
          break;
        }

        case "error":
          console.error("[WebSocket] Server error:", message.message);
          dispatch({ type: "ERROR", payload: message.message });
          break;

        case "pong":
          // Heartbeat response - connection is alive
          console.log("[WebSocket] Pong received (heartbeat OK)");
          break;

        default:
          // Log unknown message types for debugging
          console.warn("[WebSocket] Unknown message type:", message.type, message);
      }
    } catch (err) {
      console.error("[WebSocket] Error parsing message:", err);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (
      socketRef.current?.readyState === WebSocket.OPEN ||
      socketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    isManualDisconnectRef.current = false;
    dispatch({ type: "CONNECTING" });

    try {
      const socket = new WebSocket(SOCKET_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("[WebSocket] Connected to", SOCKET_URL);
        retryCountRef.current = 0;

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL);
      };

      socket.onmessage = handleMessage;

      socket.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      socket.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        clearTimers();
        socketRef.current = null;

        // Don't retry if manually disconnected
        if (isManualDisconnectRef.current) {
          dispatch({ type: "DISCONNECTED" });
          return;
        }

        // Retry with backoff
        if (retryCountRef.current < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[retryCountRef.current];
          console.log(`[WebSocket] Retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/${RETRY_DELAYS.length})`);
          
          dispatch({ type: "RECONNECTING" });
          retryCountRef.current++;
          
          retryTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          // Max retries reached
          dispatch({ type: "ERROR", payload: "Connection failed after multiple attempts. Click to retry." });
        }
      };
    } catch (err) {
      console.error("[WebSocket] Failed to create connection:", err);
      dispatch({ type: "ERROR", payload: "Failed to establish WebSocket connection" });
    }
  }, [handleMessage, clearTimers]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearTimers();
    
    if (socketRef.current) {
      socketRef.current.close(1000, "Manual disconnect");
      socketRef.current = null;
    }
    
    dispatch({ type: "DISCONNECTED" });
  }, [clearTimers]);

  // Manual reconnect (resets retry counter)
  const manualReconnect = useCallback(() => {
    disconnect();
    retryCountRef.current = 0;
    
    // Small delay to ensure clean disconnect
    setTimeout(() => {
      connect();
    }, 100);
  }, [connect, disconnect]);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    dispatch({ type: "ACKNOWLEDGE_ALERT", payload: alertId });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  // Send ping manually
  const sendPing = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "ping" }));
    }
  }, []);

  // Auto-connect on mount, cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      isManualDisconnectRef.current = true;
      clearTimers();
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmount");
      }
    };
  }, [connect, clearTimers]);

  return {
    // State
    connectionStatus: state.connectionStatus,
    lastError: state.lastError,
    clientId: state.clientId,
    user: state.user,
    rooms: state.rooms,
    locations: state.locations,
    presence: state.presence,
    alerts: state.alerts,
    stateVersion: state.stateVersion,

    // Actions
    connect,
    disconnect,
    manualReconnect,
    acknowledgeAlert,
    clearError,
    sendPing,
  };
}

// ============================================================================
// Legacy exports for backward compatibility (can be removed later)
// ============================================================================

/** @deprecated Use useWebSocket hook instead */
export function disconnectAllSockets() {
  console.warn("[WebSocket] disconnectAllSockets is deprecated. Use useWebSocket hook instead.");
}
