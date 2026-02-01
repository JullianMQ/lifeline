import { WS_BASE_URL } from "@/lib/api/config";

const WS_URL = `${WS_BASE_URL.replace(/\/$/, "")}/ws`;

type WebSocketCloseEvent = any;

let socket: WebSocket | null = null;

let joinedRooms: string[] = [];
let activeRoomId: string | null = null;

// Queue/outbox (doc: handle reconnect + message queue)
let pending: string[] = [];
const MAX_PENDING = 100;

let onMessageRef: ((msg: ServerMessage) => void) | null = null;
let onOpenRef: (() => void) | null = null;
let onCloseRef: ((e: WebSocketCloseEvent) => void) | null = null;
let onErrorRef: ((e: Event) => void) | null = null;

let openPromise: Promise<void> | null = null;
let openResolve: (() => void) | null = null;
let openReject: ((err: any) => void) | null = null;

function resetState() {
    socket = null;
    joinedRooms = [];
    activeRoomId = null;
    openPromise = null;
    openResolve = null;
    openReject = null;
}

// ---- Message types (doc-aligned) ----

export type ConnectedMsg = {
    type: "connected";
    clientId: string;
    user: any;
    roomIds: string[];
    timestamp: string;
};

export type AutoJoinSummaryMsg = {
    type: "auto-join-summary";
    roomsJoined: { roomId: string; owner: string }[];
    message: string;
    timestamp: string;
};

export type AutoJoinedMsg = {
    type: "auto-joined";
    roomId: string;
    roomOwner: string;
    message: string;
    timestamp: string;
};

export type RoomCreatedMsg = {
    type: "room-created";
    roomId: string;
    owner: string;
    emergencyContacts: string[];
    timestamp: string;
};

export type JoinApprovedMsg = {
    type: "join-approved";
    roomId: string;
    timestamp: string;
};

export type JoinDeniedMsg = {
    type: "join-denied";
    roomId?: string;
    message: string;
    timestamp: string;
};

export type RoomUsersMsg = {
    type: "room-users";
    roomId: string;
    users: any[];
    timestamp: string;
};

export type RoomMessageMsg = {
    type: "room-message";
    roomId: string;
    user: any;
    content: any;
    timestamp: string;
};

export type EmergencyAlertMsg = {
    type: "emergency-alert";
    emergencyUserId: string;
    emergencyUserName: string;
    roomId: string;
    message: string;
    timestamp: string;
};

export type PongMsg = {
    type: "pong";
    timestamp: string;
};

export type ErrorMsg = {
    type: "error";
    message: string;
    timestamp?: string;
};

export type ServerMessage =
    | ConnectedMsg
    | AutoJoinSummaryMsg
    | AutoJoinedMsg
    | RoomCreatedMsg
    | JoinApprovedMsg
    | JoinDeniedMsg
    | RoomUsersMsg
    | RoomMessageMsg
    | EmergencyAlertMsg
    | PongMsg
    | ErrorMsg;

export type ClientMessage =
    | { type: "create-room"; roomId?: string }
    | { type: "join-room"; roomId: string }
    | { type: "request-join"; roomId: string }
    | { type: "approve-join"; roomId: string; requesterId: string }
    | { type: "room-message"; roomId: string; content: any }
    | { type: "emergency-sos" }
    | { type: "get_users"; roomId: string }
    | { type: "ping" };

function isWSOpen() {
    return !!socket && socket.readyState === WebSocket.OPEN;
}

export function getJoinedRooms() {
    return joinedRooms;
}

export function getActiveRoom() {
    return activeRoomId;
}

export function setActiveRoom(roomId: string) {
    activeRoomId = roomId;
}

function safeEmit(msg: ClientMessage) {
    const payload = JSON.stringify(msg);

    // Doc: queue/outbox while disconnected or reconnecting
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        pending.push(payload);
        if (pending.length > MAX_PENDING) {
            pending = pending.slice(pending.length - MAX_PENDING);
        }
        return;
    }

    socket.send(payload);
}

export function connectWS(args: {
    onMessage: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: (e: WebSocketCloseEvent) => void;
    onError?: (e: Event) => void;
}) {
    onMessageRef = args.onMessage;
    onOpenRef = args.onOpen ?? null;
    onCloseRef = args.onClose ?? null;
    onErrorRef = args.onError ?? null;

    // already open or connecting
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    resetState();

    openPromise = new Promise<void>((resolve, reject) => {
        openResolve = resolve;
        openReject = reject;
    });

    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        onOpenRef?.();
        openResolve?.();

        // Flush queued messages
        if (pending.length) {
            const toSend = pending;
            pending = [];
            for (const payload of toSend) {
                try {
                    socket?.send(payload);
                } catch {
                    // Re-queue remaining on failure
                    pending.push(payload);
                    break;
                }
            }
        }
    };

    socket.onmessage = (e) => {
        try {
            const parsed = JSON.parse(e.data);

            // Keep local caches in sync using doc shapes
            if (parsed?.type === "connected" && Array.isArray(parsed.roomIds)) {
                joinedRooms = parsed.roomIds;
                if (!activeRoomId && joinedRooms.length) activeRoomId = joinedRooms[0];
            }

            if (parsed?.type === "auto-join-summary" && Array.isArray(parsed.roomsJoined)) {
                joinedRooms = parsed.roomsJoined.map((r: any) => r.roomId).filter(Boolean);
                if (!activeRoomId && joinedRooms.length) activeRoomId = joinedRooms[0];
            }

            if (
                (parsed?.type === "join-approved" || parsed?.type === "room-created" || parsed?.type === "auto-joined") &&
                parsed.roomId
            ) {
                if (!joinedRooms.includes(parsed.roomId)) joinedRooms = [parsed.roomId, ...joinedRooms];
                if (!activeRoomId) activeRoomId = parsed.roomId;
            }

            onMessageRef?.(parsed);
        } catch {
            // ignore non-json
        }
    };

    socket.onerror = (e) => {
        onErrorRef?.(e);
        openReject?.(e);
    };

    socket.onclose = (e) => {
        onCloseRef?.(e);
        resetState();
    };
}

export function disconnectWS() {
    if (socket) {
        try {
            socket.close();
        } catch { }
    }
    resetState();
    pending = [];
}

export async function waitForOpen() {
    if (isWSOpen()) return;

    // If connectWS hasn't been called yet, don't throw.
    // Callers can still enqueue messages via safeEmit.
    if (!openPromise) return;

    await openPromise;
}

// ---- High-level actions ----

export async function createRoom(roomId?: string) {
    await waitForOpen();
    safeEmit(roomId ? { type: "create-room", roomId } : { type: "create-room" });
}

export async function joinRoom(roomId: string) {
    await waitForOpen();
    safeEmit({ type: "join-room", roomId });
}

export async function getRoomUsers(roomId: string) {
    await waitForOpen();
    safeEmit({ type: "get_users", roomId });
}

export async function sendRoomMessage(content: any, roomId: string) {
    await waitForOpen();
    safeEmit({ type: "room-message", roomId, content });
}

export async function sendEmergencySOS() {
    await waitForOpen();
    safeEmit({ type: "emergency-sos" });
}

export async function sendPing() {
    await waitForOpen();
    safeEmit({ type: "ping" });
}

export function isWSConnected() {
    return isWSOpen();
}
