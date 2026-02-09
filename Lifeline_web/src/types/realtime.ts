/**
 * Real-time WebSocket types for Lifeline dashboard
 * Shared between useWebSocket, useDashboard, and component layers
 */

// ============================================================================
// Backend Message Types (incoming from /api/ws)
// ============================================================================

export type BackendMessageType =
    | "connected"
    | "location-update"
    | "emergency-alert"
    | "emergency-activated"
    | "user-joined"
    | "user-left"
    | "auto-joined"
    | "auto-join-summary"
    | "room-created"
    | "join-approved"
    | "join-denied"
    | "room-message"
    | "room-users"
    | "emergency-contact-joined"
    | "emergency-confirmed"
    | "pong"
    | "error";

/** User info attached to most backend messages */
export interface BackendUser {
    id: string;
    name: string;
    email: string;
    role: string;
    phone_no: string;
}

/** Sent immediately after WebSocket connection established */
export interface ConnectedMessage {
    type: "connected";
    clientId: string;
    user: BackendUser;
    roomIds: string[];
    timestamp: string;
}

/** Location update broadcast from mobile clients */
export interface LocationUpdateMessage {
    type: "location-update";
    roomId: string;
    data: {
        userId: string;
        userName: string;
        latitude: number;
        longitude: number;
        timestamp: string;
        accuracy?: number;
    };
}

/** Emergency alert sent to emergency contacts */
export interface EmergencyAlertMessage {
    type: "emergency-alert";
    emergencyUserId: string;
    emergencyUserName: string;
    roomId: string;
    message: string;
    timestamp: string;
}

/** Broadcast when emergency is activated in a room */
export interface EmergencyActivatedMessage {
    type: "emergency-activated";
    roomId: string;
    clientId: string;
    userName: string;
    user: BackendUser;
    timestamp: string;
}

/** User joined a room */
export interface UserJoinedMessage {
    type: "user-joined";
    clientId: string;
    roomId?: string;
    user: BackendUser;
    timestamp: string;
}

/** User left a room */
export interface UserLeftMessage {
    type: "user-left";
    clientId: string;
    roomId?: string;
    userName: string;
    timestamp: string;
}

/** Auto-joined to a room as emergency contact */
export interface AutoJoinedMessage {
    type: "auto-joined";
    roomId: string;
    roomOwner: string;
    message: string;
    timestamp: string;
}

/** Summary of auto-joined rooms */
export interface AutoJoinSummaryMessage {
    type: "auto-join-summary";
    roomsJoined: Array<{ roomId: string; owner: string }>;
    message: string;
    timestamp: string;
}

/** Room created confirmation */
export interface RoomCreatedMessage {
    type: "room-created";
    roomId: string;
    owner: string;
    emergencyContacts: string[];
    timestamp: string;
}

/** Join request approved */
export interface JoinApprovedMessage {
    type: "join-approved";
    roomId: string;
    timestamp: string;
}

/** Join request denied */
export interface JoinDeniedMessage {
    type: "join-denied";
    message: string;
    timestamp: string;
}

/** Room message (chat) */
export interface RoomMessagePayload {
    type: "room-message";
    roomId: string;
    content: string;
    clientId: string;
    userName: string;
    user: BackendUser;
    timestamp: string;
}

/** Room users list */
export interface RoomUsersMessage {
    type: "room-users";
    roomId: string;
    users: Array<{
        id: string;
        name: string;
        user: BackendUser;
    }>;
    timestamp: string;
}

/** Emergency contact joined notification */
export interface EmergencyContactJoinedMessage {
    type: "emergency-contact-joined";
    contactId: string;
    contactName: string;
    timestamp: string;
}

/** Emergency SOS confirmed */
export interface EmergencyConfirmedMessage {
    type: "emergency-confirmed";
    activatedRooms: string[];
    timestamp: string;
}

/** Pong response to ping */
export interface PongMessage {
    type: "pong";
    timestamp: string;
}

/** Error message from backend */
export interface ErrorMessage {
    type: "error";
    message: string;
    timestamp: string;
}

/** Union of all possible backend messages */
export type BackendMessage =
    | ConnectedMessage
    | LocationUpdateMessage
    | EmergencyAlertMessage
    | EmergencyActivatedMessage
    | UserJoinedMessage
    | UserLeftMessage
    | AutoJoinedMessage
    | AutoJoinSummaryMessage
    | RoomCreatedMessage
    | JoinApprovedMessage
    | JoinDeniedMessage
    | RoomMessagePayload
    | RoomUsersMessage
    | EmergencyContactJoinedMessage
    | EmergencyConfirmedMessage
    | PongMessage
    | ErrorMessage;

// ============================================================================
// Frontend State Types
// ============================================================================

/** Connection status for WebSocket */
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

/** Location data stored in frontend state */
export interface LocationData {
    userId: string;
    userName: string;
    roomId: string;
    coords: {
        lat: number;
        lng: number;
    };
    formatted_location: string | null;
    accuracy?: number;
    timestamp: string;
}

/** Emergency alert stored in frontend state */
export interface EmergencyAlert {
    id: string;
    emergencyUserId: string;
    emergencyUserName: string;
    roomId: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
}

/** Presence status for users */
export type PresenceStatus = "online" | "offline";

/** Presence info for a user */
export interface PresenceInfo {
    userId: string;
    userName: string;
    status: PresenceStatus;
    lastSeen: string;
}

/** Room info tracked by frontend */
export interface RoomInfo {
    roomId: string;
    ownerId?: string;
    joinedAt: string;
}

/** Full WebSocket state managed by useWebSocket hook */
export interface WebSocketState {
    connectionStatus: ConnectionStatus;
    lastError: string | null;
    clientId: string | null;
    user: BackendUser | null;
    rooms: Map<string, RoomInfo>;
    locations: Map<string, LocationData>;
    presence: Map<string, PresenceInfo>;
    alerts: EmergencyAlert[];
    /** Version counter to help React detect Map changes */
    stateVersion: number;
}

// ============================================================================
// Actions for state reducer
// ============================================================================

export type WebSocketAction =
    | { type: "CONNECTING" }
    | { type: "CONNECTED"; payload: ConnectedMessage }
    | { type: "RECONNECTING" }
    | { type: "DISCONNECTED" }
    | { type: "ERROR"; payload: string }
    | { type: "CLEAR_ERROR" }
    | { type: "LOCATION_UPDATE"; payload: LocationUpdateMessage }
    | { type: "EMERGENCY_ALERT"; payload: EmergencyAlertMessage }
    | { type: "EMERGENCY_ACTIVATED"; payload: EmergencyActivatedMessage }
    | { type: "USER_JOINED"; payload: UserJoinedMessage; roomId: string }
    | { type: "USER_LEFT"; payload: UserLeftMessage; roomId: string }
    | { type: "AUTO_JOINED"; payload: AutoJoinedMessage }
    | { type: "ROOM_CREATED"; payload: RoomCreatedMessage }
    | { type: "JOIN_APPROVED"; payload: JoinApprovedMessage }
    | { type: "ACKNOWLEDGE_ALERT"; payload: string }
    | { type: "CLEAR_ALERTS" };

// ============================================================================
// Hook Return Types
// ============================================================================

/** Return type for useWebSocket hook */
export interface UseWebSocketReturn {
    // State
    connectionStatus: ConnectionStatus;
    lastError: string | null;
    clientId: string | null;
    user: BackendUser | null;
    rooms: Map<string, RoomInfo>;
    locations: Map<string, LocationData>;
    presence: Map<string, PresenceInfo>;
    alerts: EmergencyAlert[];
    /** Version counter to help React detect Map changes */
    stateVersion: number;

    // Actions
    connect: () => void;
    disconnect: () => void;
    manualReconnect: () => void;
    acknowledgeAlert: (alertId: string) => void;
    clearError: () => void;
    sendPing: () => void;
}

/** Contact card data for dashboard display */
export interface ContactCard {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    image?: string;
    role: "mutual" | "dependent";
    location: LocationData | null;
    presence: PresenceInfo | null;
    hasActiveAlert: boolean;
    activeAlert: EmergencyAlert | null;
    roomId: string | null;
}

/** Return type for useDashboard hook */
export interface UseDashboardReturn {
    // Connection info
    connectionStatus: ConnectionStatus;
    connectionError: string | null;

    // Contact data
    contactCards: ContactCard[];
    loading: boolean;
    error: string | null;

    // Location history from API - mapped by phone number with full history
    locationHistory: Record<string, {
        current: LocationData;
        history: LocationData[];
    }>;

    // Alerts
    activeAlerts: EmergencyAlert[];

    // User info
    user: {
        id: string;
        name: string;
        email: string;
        image?: string;
        role: string;
        phone_no: string;
        location?: { lat: number; lng: number };
    } | null;

    // Actions
    handleLogout: () => Promise<void>;
    acknowledgeAlert: (alertId: string) => void;
    manualReconnect: () => void;
    refreshContacts: () => Promise<void>;
    refreshLocations: () => Promise<void>;
}
