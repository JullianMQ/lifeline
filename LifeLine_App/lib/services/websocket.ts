import { WS_BASE_URL } from "@/lib/api/config";

const WS_URL = `${WS_BASE_URL.replace(/\/$/, "")}/ws`;

type WebSocketCloseEvent = any;

let socket: WebSocket | null = null;

// "current" = only valid for the current WS connection.
// "lastKnown" = survives disconnects so mobile clients can keep a roomId for
// REST fallback location uploads when WS is disconnected (see websocket-api.md).
let currentRoomIds: string[] = [];
let currentActiveRoomId: string | null = null;

let lastKnownRoomIds: string[] = [];
let lastKnownActiveRoomId: string | null = null;

// Queue/outbox (client-side only).
let pending: string[] = [];
const MAX_PENDING = 100;

let onMessageRef: ((msg: ServerMessage) => void) | null = null;
let onOpenRef: (() => void) | null = null;
let onCloseRef: ((e: WebSocketCloseEvent) => void) | null = null;
let onErrorRef: ((e: Event) => void) | null = null;

let openPromise: Promise<void> | null = null;
let openResolve: (() => void) | null = null;
let openReject: ((err: any) => void) | null = null;

function resetConnectionState() {
    socket = null;
    currentRoomIds = [];
    currentActiveRoomId = null;
    openPromise = null;
    openResolve = null;
    openReject = null;
}

function mergeRoomIds(into: string[], add: string[]) {
    const set = new Set(into);
    for (const id of add) {
        if (typeof id === "string" && id.trim()) set.add(id);
    }
    return Array.from(set);
}

function setRoomTruthFromConnected(roomIds: string[]) {
    const normalized = (Array.isArray(roomIds) ? roomIds : []).filter(
        (r) => typeof r === "string" && r.trim()
    );
    currentRoomIds = normalized;
    lastKnownRoomIds = normalized;

    const active = lastKnownActiveRoomId ?? currentActiveRoomId;
    if (active && normalized.includes(active)) {
        currentActiveRoomId = active;
        lastKnownActiveRoomId = active;
    } else {
        const next = normalized.length ? normalized[0] : null;
        currentActiveRoomId = next;
        lastKnownActiveRoomId = next;
    }
}

// ---- Message types (STRICTLY aligned to websocket-api.md) ----

export type ConnectedMsg = {
    type: "connected";
    clientId: string;
    user: any;
    roomIds: string[];
    timestamp: string;
};

export type AutoJoinedMsg = {
    type: "auto-joined";
    roomId: string;
    roomOwner: string;
    message: string;
    timestamp: string;
};

export type AutoJoinSummaryMsg = {
    type: "auto-join-summary";
    roomsJoined: { roomId: string; owner: string }[];
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
    message: string;
    timestamp: string;
};

export type JoinRequestMsg = {
    type: "join-request";
    requesterId: string;
    requesterName: string;
    requesterUser: any;
    roomId: string;
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
    content: any;
    clientId: string;
    userName: string;
    user: any;
    timestamp: string;
};

export type EmergencyConfirmedMsg = {
    type: "emergency-confirmed";
    activatedRooms: string[];
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

export type EmergencyActivatedMsg = {
    type: "emergency-activated";
    roomId: string;
    clientId: string;
    userName: string;
    user: any;
    timestamp: string;
};

export type LocationUpdateClientMsg = {
    type: "location-update";
    roomId?: string;
    latitude: number;
    longitude: number;
    timestamp?: string | number;
    accuracy?: number;
};

export type LocationUpdateConfirmedMsg = {
    type: "location-update-confirmed";
    rooms: string[];
    timestamp: string;
};

export type LocationUpdateBroadcastMsg = {
    type: "location-update";
    data: {
        visiblePhone: string;
        userName: string;
        latitude: number;
        longitude: number;
        timestamp: string;
        accuracy?: number;
    };
    timestamp: string;
};

export type UserJoinedMsg = {
    type: "user-joined";
    clientId: string;
    user: any;
    timestamp: string;
};

export type UserLeftMsg = {
    type: "user-left";
    clientId: string;
    userName: string;
    timestamp: string;
};

export type EmergencyContactJoinedMsg = {
    type: "emergency-contact-joined";
    contactId: string;
    contactName: string;
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
    | AutoJoinedMsg
    | AutoJoinSummaryMsg
    | RoomCreatedMsg
    | JoinApprovedMsg
    | JoinDeniedMsg
    | JoinRequestMsg
    | RoomUsersMsg
    | RoomMessageMsg
    | EmergencyConfirmedMsg
    | EmergencyAlertMsg
    | EmergencyActivatedMsg
    | LocationUpdateConfirmedMsg
    | LocationUpdateBroadcastMsg
    | UserJoinedMsg
    | UserLeftMsg
    | EmergencyContactJoinedMsg
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
    | { type: "ping" }
    | LocationUpdateClientMsg;

function isWSOpen() {
    const s = socket;
    return !!s && s.readyState === WebSocket.OPEN;
}

export function getJoinedRooms() {
    return lastKnownRoomIds;
}

export function getActiveRoom() {
    return lastKnownActiveRoomId;
}

export function setActiveRoom(roomId: string) {
    lastKnownActiveRoomId = roomId;
    if (socket) currentActiveRoomId = roomId;

    if (!lastKnownRoomIds.includes(roomId)) {
        lastKnownRoomIds = [roomId, ...lastKnownRoomIds];
    }
    if (socket && !currentRoomIds.includes(roomId)) {
        currentRoomIds = [roomId, ...currentRoomIds];
    }
}

function safeEmit(msg: ClientMessage) {
    const payload = JSON.stringify(msg);
    const s = socket;

    if (!s || s.readyState !== WebSocket.OPEN) {
        pending.push(payload);
        if (pending.length > MAX_PENDING) {
            pending = pending.slice(pending.length - MAX_PENDING);
        }
        return;
    }

    s.send(payload);
}

export function connectWS(args: {
    onMessage: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: (e: WebSocketCloseEvent) => void;
    onError?: (e: Event) => void;
    authToken?: string;
    headers?: Record<string, string>;
}) {
    onMessageRef = args.onMessage;
    onOpenRef = args.onOpen ?? null;
    onCloseRef = args.onClose ?? null;
    onErrorRef = args.onError ?? null;

    // already open or connecting
    if (
        socket &&
        (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }

    resetConnectionState();

    openPromise = new Promise<void>((resolve, reject) => {
        openResolve = resolve;
        openReject = reject;
    });

    const mergedHeaders: Record<string, string> = {
        ...(args.headers ?? {}),
        ...(args.authToken ? { Authorization: `Bearer ${args.authToken}` } : {}),
    };

    const WS: any = WebSocket;

    // ✅ Create a NON-NULL local socket, attach handlers to it, then store it globally.
    const ws: WebSocket =
        Object.keys(mergedHeaders).length > 0
            ? new WS(WS_URL, [], { headers: mergedHeaders })
            : new WS(WS_URL);

    ws.onopen = () => {
        onOpenRef?.();
        openResolve?.();

        // Flush queued messages (using ws, not global socket)
        if (pending.length) {
            const toSend = pending;
            pending = [];
            for (const p of toSend) {
                try {
                    ws.send(p);
                } catch {
                    pending.push(p);
                    break;
                }
            }
        }
    };

    ws.onmessage = (e) => {
        try {
            const parsed = JSON.parse(e.data);

            if (parsed?.type === "connected" && Array.isArray(parsed.roomIds)) {
                setRoomTruthFromConnected(parsed.roomIds);
            }

            if (parsed?.type === "auto-join-summary" && Array.isArray(parsed.roomsJoined)) {
                const joined = parsed.roomsJoined
                    .map((r: any) => r?.roomId)
                    .filter((r: any) => typeof r === "string" && r.trim());
                currentRoomIds = mergeRoomIds(currentRoomIds, joined);
                lastKnownRoomIds = mergeRoomIds(lastKnownRoomIds, joined);
                if (!lastKnownActiveRoomId && lastKnownRoomIds.length) {
                    lastKnownActiveRoomId = lastKnownRoomIds[0];
                    currentActiveRoomId = lastKnownActiveRoomId;
                }
            }

            if (
                (parsed?.type === "join-approved" ||
                    parsed?.type === "room-created" ||
                    parsed?.type === "auto-joined") &&
                typeof parsed.roomId === "string" &&
                parsed.roomId.trim()
            ) {
                const rid = parsed.roomId;
                currentRoomIds = mergeRoomIds(currentRoomIds, [rid]);
                lastKnownRoomIds = mergeRoomIds(lastKnownRoomIds, [rid]);
                if (!lastKnownActiveRoomId) {
                    lastKnownActiveRoomId = rid;
                    currentActiveRoomId = rid;
                }
            }

            onMessageRef?.(parsed);
        } catch {
            // ignore non-json
        }
    };

    ws.onerror = (e) => {
        onErrorRef?.(e);
        openReject?.(e);
    };

    ws.onclose = (e) => {
        onCloseRef?.(e);

        // Only clear the global socket if THIS ws is the one stored.
        if (socket === ws) resetConnectionState();
    };

    // store after handlers are attached
    socket = ws;
}

export function disconnectWS() {
    const s = socket;
    if (s) {
        try {
            s.close();
        } catch {
            // ignore
        }
    }
    resetConnectionState();
    pending = [];
}

export async function waitForOpen() {
    if (isWSOpen()) return;
    if (!openPromise) return;
    await openPromise;
}

export async function createRoom(roomId?: string) {
    await waitForOpen();
    safeEmit(roomId ? { type: "create-room", roomId } : { type: "create-room" });
}

export async function joinRoom(roomId: string) {
    await waitForOpen();
    safeEmit({ type: "join-room", roomId });
}

export async function requestJoin(roomId: string) {
    await waitForOpen();
    safeEmit({ type: "request-join", roomId });
}

export async function approveJoin(roomId: string, requesterId: string) {
    await waitForOpen();
    safeEmit({ type: "approve-join", roomId, requesterId });
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

export async function sendLocationUpdate(payload: Omit<LocationUpdateClientMsg, "type">) {
    await waitForOpen();
    safeEmit({ type: "location-update", ...payload });
}

export function isWSConnected() {
    return isWSOpen();
}
