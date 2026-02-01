// lib/services/websocket.ts
import { WS_BASE_URL } from "../api/config";

if (!WS_BASE_URL) console.error("No WS_BASE_URL");

// --- module state ---
let socket: WebSocket | null = null;

// rooms we are currently in (based on server events)
let joinedRooms = new Set<string>();
let activeRoomId: string | null = null;

// queue messages until OPEN
let pending: string[] = [];

// --- types ---
export type LocationPayload = {
    roomId: string;
    userId?: string;
    user?: any;
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
};

export type ServerMessage =
    | { type: "connected"; clientId: string; user: any; roomIds: string[]; timestamp: string }
    | { type: "room-created"; roomId: string; owner: string; emergencyContacts: string[]; timestamp: string }
    | { type: "join-approved"; roomId: string; timestamp: string }
    | { type: "join-denied"; message: string; timestamp: string; roomId?: string }
    | { type: "auto-joined"; roomId: string; ownerId: string; timestamp: string }
    | { type: "auto-join-summary"; joinedRooms: string[]; timestamp: string }
    | { type: "room-users"; roomId: string; users: any[]; timestamp: string }
    | { type: "user-joined"; roomId: string; clientId: string; user: any; timestamp: string }
    | { type: "user-left"; roomId: string; clientId: string; timestamp: string }
    | { type: "room-message"; roomId: string; from: string; user: any; content: any; timestamp: string }
    | ({ type: "location-update" } & LocationPayload)
    | { type: "emergency-alert"; ownerId: string; owner: any; roomId: string; message: string; timestamp: string }
    | { type: "emergency-activated"; ownerId: string; roomId: string; timestamp: string }
    | { type: "emergency-confirmed"; activatedRooms: string[]; timestamp: string }
    | { type: "pong" }
    | { type: "error"; message: string };

type ClientEmit =
    | { type: "create-room"; roomId?: string }
    | { type: "join-room"; roomId: string }
    | { type: "room-message"; roomId: string; content: any }
    | { type: "get_users"; roomId: string }
    | { type: "emergency-sos" }
    | { type: "ping" };

type Handlers = {
    onMessage: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: (e: { code?: number; reason?: string }) => void;
    onError?: (e: any) => void;
};

function endpoint() {
    // server upgrades on /ws
    return `${WS_BASE_URL}/ws`;
}

function flushPending() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    for (const msg of pending) socket.send(msg);
    pending = [];
}

export function connectWS(handlers: Handlers) {
    if (socket) return socket;

    socket = new WebSocket(endpoint());

    socket.onopen = () => {
        handlers.onOpen?.();
        flushPending();
    };

    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data) as ServerMessage;

            // Maintain local room state based on server truth
            switch (data.type) {
                case "connected":
                    if (Array.isArray(data.roomIds)) {
                        data.roomIds.forEach((r) => joinedRooms.add(r));
                        if (!activeRoomId && data.roomIds.length) activeRoomId = data.roomIds[0];
                    }
                    break;
                case "auto-joined":
                case "room-created":
                case "join-approved":
                    joinedRooms.add(data.roomId);
                    if (!activeRoomId) activeRoomId = data.roomId;
                    break;

                default:
                    break;
            }

            handlers.onMessage(data);
        } catch {
            console.warn("Non-JSON WS message:", e.data);
        }
    };

    socket.onerror = (e) => {
        console.log("WS error", { url: endpoint(), e });
        handlers.onError?.(e);
    };

    socket.onclose = (e: any) => {
        handlers.onClose?.({ code: e?.code, reason: e?.reason });
        socket = null;
        joinedRooms = new Set<string>();
        activeRoomId = null;
        pending = [];
    };

    return socket;
}

export function disconnectWS() {
    socket?.close();
    socket = null;
    joinedRooms = new Set<string>();
    activeRoomId = null;
    pending = [];
    console.log("🔌 disconnectWS() called");
}

export function isWSOpen() {
    return socket?.readyState === WebSocket.OPEN;
}

export function getJoinedRooms(): string[] {
    return Array.from(joinedRooms);
}

export function getActiveRoom(): string | null {
    return activeRoomId;
}

export function setActiveRoom(roomId: string | null) {
    activeRoomId = roomId;
    if (roomId) joinedRooms.add(roomId);
}

function emit(msg: ClientEmit) {
    if (!socket) {
        console.warn("WS not connected yet; call connectWS first");
        return;
    }

    const payload = JSON.stringify(msg);

    if (socket.readyState !== WebSocket.OPEN) {
        pending.push(payload);
        return;
    }

    socket.send(payload);
}

// ---- Client actions ----

export function createRoom(roomId?: string) {
    emit({ type: "create-room", roomId });
}

export function joinRoom(roomId: string) {
    emit({ type: "join-room", roomId });
}

export function sendRoomMessage(content: any, roomId?: string) {
    const rid = roomId ?? activeRoomId;
    if (!rid) {
        console.warn("No roomId available for room-message");
        return;
    }
    emit({ type: "room-message", roomId: rid, content });
}

export function getRoomUsers(roomId?: string) {
    const rid = roomId ?? activeRoomId;
    if (!rid) return;
    emit({ type: "get_users", roomId: rid });
}

export function sendEmergencySOS() {
    emit({ type: "emergency-sos" });
}

export function ping() {
    emit({ type: "ping" });
}
