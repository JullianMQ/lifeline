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

// Remember the last successful connect parameters so waitForOpen() can
// initiate a connection when callers emit messages before a socket exists.
type ConnectWSArgs = {
    onMessage: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: (e: WebSocketCloseEvent) => void;
    onError?: (e: Event) => void;
    authToken?: string;
    headers?: Record<string, string>;
};

let lastConnectArgs: ConnectWSArgs | null = null;

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

function isWSOpen() {
    return socket?.readyState === WebSocket.OPEN;
}

function mergeRoomIds(a: string[], b: string[]) {
    const out = new Set<string>();
    for (const x of a) if (typeof x === "string" && x.trim()) out.add(x);
    for (const x of b) if (typeof x === "string" && x.trim()) out.add(x);
    return Array.from(out);
}

function setRoomTruthFromConnected(roomIds: string[]) {
    currentRoomIds = Array.isArray(roomIds) ? roomIds : [];
    lastKnownRoomIds = Array.isArray(roomIds) ? roomIds : [];

    if (!currentActiveRoomId && currentRoomIds.length) currentActiveRoomId = currentRoomIds[0];
    if (!lastKnownActiveRoomId && lastKnownRoomIds.length) lastKnownActiveRoomId = lastKnownRoomIds[0];
}

export type ServerMessage =
    | {
        type: "connected";
        clientId: string;
        timestamp?: string;
        roomIds: string[];
        user?: any;
    }
    | {
        type: "auto-join-summary";
        timestamp?: string;
        roomsJoined: Array<{
            roomId: string;
            status: "joined" | "requested";
        }>;
    }
    | {
        type: "room-created";
        roomId: string;
        timestamp?: string;
    }
    | {
        type: "join-approved";
        roomId: string;
        timestamp?: string;
    }
    | {
        type: "join-denied";
        roomId: string;
        message: string;
        timestamp?: string;
    }
    | {
        type: "room-users";
        roomId: string;
        users: any[];
        timestamp?: string;
    }
    | {
        type: "location-update";
        userId?: string;
        userName?: string;
        clientId?: string;
        latitude: number;
        longitude: number;
        timestamp: string;
        accuracy?: number;
        roomId?: string;
    }
    | {
        type: "emergency-alert";
        emergencyUserId: string;
        emergencyUserName?: string;
        message?: string;
        timestamp?: string;
        roomId?: string;
    }
    | {
        type: "emergency-confirmed";
        activatedRooms?: string[];
        timestamp?: string;
    }
    | {
        type: "emergency-activated";
        roomId: string;
        clientId: string;
        userName?: string;
        timestamp?: string;
    }
    | {
        type: "room-message";
        roomId: string;
        clientId: string;
        userName?: string;
        content: string;
        timestamp?: string;
    }
    | {
        type: "user-left";
        roomId: string;
        clientId: string;
        userName?: string;
        timestamp?: string;
    }
    | {
        type: "user-joined";
        roomId: string;
        clientId: string;
        user?: any;
        timestamp?: string;
    }
    | {
        type: "pong";
        timestamp?: string;
    }
    | {
        type: "error";
        message: string;
        timestamp?: string;
    }
    | any;

function queue(msg: any) {
    const payload = JSON.stringify(msg);
    if (pending.length >= MAX_PENDING) {
        pending = pending.slice(pending.length - (MAX_PENDING - 1));
    }
    pending.push(payload);
}

function safeEmit(msg: any) {
    if (!isWSOpen()) {
        queue(msg);
        return;
    }

    try {
        socket!.send(JSON.stringify(msg));
    } catch {
        queue(msg);
    }
}

export function getJoinedRooms() {
    return lastKnownRoomIds;
}

export function getActiveRoom() {
    return lastKnownActiveRoomId;
}

export function setActiveRoom(roomId: string) {
    if (!roomId) return;
    lastKnownActiveRoomId = roomId;
    currentActiveRoomId = roomId;
}

export function getRoomUsers(roomId: string) {
    if (!roomId) return;
    safeEmit({ type: "get-users", roomId });
}

export async function sendLocationUpdate(payload: {
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy?: number;
    roomId?: string;
}) {
    safeEmit({ type: "location-update", ...payload });
}

export async function sendEmergencySOS() {
    safeEmit({ type: "emergency-sos" });
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

    // Save connect params so waitForOpen() can reconnect if needed.
    lastConnectArgs = args;

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

            // IMPORTANT: if a send fails, re-queue the failed message AND all remaining
            // messages in original order to avoid dropping anything.
            for (let i = 0; i < toSend.length; i++) {
                const p = toSend[i];
                try {
                    ws.send(p);
                } catch (err) {
                    pending = toSend.slice(i).concat(pending);
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
                typeof parsed.roomId === "string"
            ) {
                currentRoomIds = mergeRoomIds(currentRoomIds, [parsed.roomId]);
                lastKnownRoomIds = mergeRoomIds(lastKnownRoomIds, [parsed.roomId]);
                if (!lastKnownActiveRoomId) {
                    lastKnownActiveRoomId = parsed.roomId;
                    currentActiveRoomId = parsed.roomId;
                }
            }

            onMessageRef?.(parsed);
        } catch {
            // ignore parse errors
        }
    };

    ws.onclose = (e) => {
        onCloseRef?.(e);

        // Keep lastKnown* for REST fallback.
        resetConnectionState();
    };

    ws.onerror = (e) => {
        onErrorRef?.(e);
        openReject?.(e);
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

    // If we already have an in-flight open promise, await it.
    if (openPromise) {
        await openPromise;
        return;
    }

    // No socket + no openPromise: attempt to initiate a connection using the last known args.
    if (lastConnectArgs) {
        try {
            connectWS(lastConnectArgs);
        } catch (err: any) {
            throw new Error(
                `WebSocket connect attempt failed: ${err?.message ?? String(err)}`
            );
        }

        if (!openPromise) {
            throw new Error("WebSocket connection could not be initiated (no openPromise created).");
        }

        await openPromise;
        return;
    }

    // No connect parameters available: fail fast so callers can surface/fallback instead of queueing forever.
    throw new Error("WebSocket not connected and cannot auto-connect: call connectWS() first.");
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

export async function leaveRoom(roomId: string) {
    await waitForOpen();
    safeEmit({ type: "leave-room", roomId });
}

export function isWSConnected() {
    return isWSOpen();
}
