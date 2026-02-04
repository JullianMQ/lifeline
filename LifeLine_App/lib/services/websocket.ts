import { WS_BASE_URL } from "@/lib/api/config";

/**
 * WebSocket client for the LifeLine backend.
 *
 * Includes:
 * - Safe auth switching: queued/outbox messages are wiped when auth changes.
 * - Room state scoped per authenticated user to prevent cross-account leakage.
 * - RN WebSocket header handling.
 * - sendLocationUpdate() export.
 * - Suppress noisy onError events on intentional close (logout/disconnect).
 */

const WS_URL = `${WS_BASE_URL.replace(/\/$/, "")}/ws`;

// React Native WebSocket event typings differ from DOM; keep these permissive.
type WebSocketCloseEvent = any;

let socket: WebSocket | null = null;

/** Rooms known for the CURRENT socket connection (server truth for this connection). */
let currentRoomIds: string[] = [];
let currentActiveRoomId: string | null = null;

/** Which authenticated user the CURRENT connection belongs to (from `connected`). */
let currentHandshakeUserId: string | null = null;

/**
 * Per-user room cache.
 * Critical for account switching: user A's roomIds shouldn't be wiped/overwritten
 * when user B logs in on the same device.
 */
type UserRoomState = {
    roomIds: string[];
    activeRoomId: string | null;
};
const roomStateByUser = new Map<string, UserRoomState>();

/**
 * Queue/outbox (client-side only).
 * MUST be cleared when switching authenticated users to prevent cross-session leakage.
 */
let pending: string[] = [];
const MAX_PENDING = 100;

/** Handlers */
let onMessageRef: ((msg: ServerMessage) => void) | null = null;
let onOpenRef: (() => void) | null = null;
let onCloseRef: ((e: WebSocketCloseEvent) => void) | null = null;
let onErrorRef: ((e: any) => void) | null = null;

/** Remember last connect params so waitForOpen() can initiate a connection automatically. */
export type ConnectWSArgs = {
    onMessage: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: (e: WebSocketCloseEvent) => void;
    onError?: (e: any) => void;

    /**
     * Mobile auth alternative from websocket-api.md:
     * Authorization: Bearer <token>
     */
    authToken?: string;

    /**
     * Extra headers if needed. If authToken is provided and Authorization isn't set,
     * Authorization will be auto-filled.
     */
    headers?: Record<string, string>;
};
let lastConnectArgs: ConnectWSArgs | null = null;

let openPromise: Promise<void> | null = null;
let openResolve: (() => void) | null = null;
let openReject: ((err: any) => void) | null = null;

/**
 * When we intentionally close (logout / disconnect / auth switch), RN may still emit
 * a WebSocket "error" event as part of teardown. We suppress that noise.
 */
let intentionalClose = false;

function isWSOpen() {
    return socket?.readyState === WebSocket.OPEN;
}

function wipePending() {
    pending = [];
}

function resetConnectionState() {
    socket = null;
    currentRoomIds = [];
    currentActiveRoomId = null;
    currentHandshakeUserId = null;

    openPromise = null;
    openResolve = null;
    openReject = null;

    // reset close intent marker after teardown is complete
    intentionalClose = false;
}

function getOrCreateUserState(userId: string): UserRoomState {
    const existing = roomStateByUser.get(userId);
    if (existing) return existing;

    const next: UserRoomState = { roomIds: [], activeRoomId: null };
    roomStateByUser.set(userId, next);
    return next;
}

function mergeRoomIds(a: string[], b: string[]) {
    const out = new Set<string>();
    for (const x of a) if (typeof x === "string" && x.trim()) out.add(x);
    for (const x of b) if (typeof x === "string" && x.trim()) out.add(x);
    return Array.from(out);
}

function setRoomTruthFromConnected(roomIds: string[]) {
    const incoming = Array.isArray(roomIds) ? roomIds : [];
    currentRoomIds = incoming;

    if (incoming.length) {
        if (!currentActiveRoomId || !incoming.includes(currentActiveRoomId)) {
            currentActiveRoomId = incoming[0];
        }
    } else {
        currentActiveRoomId = null;
    }

    if (currentHandshakeUserId) {
        const st = getOrCreateUserState(currentHandshakeUserId);
        st.roomIds = incoming;

        if (incoming.length) {
            if (!st.activeRoomId || !incoming.includes(st.activeRoomId)) st.activeRoomId = incoming[0];
        } else {
            st.activeRoomId = null;
        }
    }
}

function upsertKnownRoom(roomId: string | undefined | null) {
    if (!roomId || typeof roomId !== "string") return;
    const id = roomId.trim();
    if (!id) return;

    // Connection-scoped
    currentRoomIds = mergeRoomIds(currentRoomIds, [id]);
    if (!currentActiveRoomId) currentActiveRoomId = id;

    // Per-user
    if (currentHandshakeUserId) {
        const st = getOrCreateUserState(currentHandshakeUserId);
        st.roomIds = mergeRoomIds(st.roomIds, [id]);
        if (!st.activeRoomId) st.activeRoomId = id;
    }
}

export type ServerMessage =
    | {
        type: "connected";
        clientId: string;
        timestamp?: string;
        roomIds: string[];
        user?: any;
    }
    | { type: "auto-joined"; roomId: string; timestamp?: string }
    | {
        type: "auto-join-summary";
        timestamp?: string;
        roomsJoined: Array<{ roomId: string; status: "joined" | "requested" }>;
    }
    | { type: "room-created"; roomId: string; timestamp?: string }
    | { type: "room-users"; roomId: string; users: any[]; timestamp?: string }
    | { type: "join-request"; roomId: string; clientId: string; user?: any; timestamp?: string }
    | { type: "join-approved"; roomId: string; clientId?: string; timestamp?: string }
    | { type: "join-denied"; roomId: string; clientId?: string; message?: string; timestamp?: string }
    | { type: "user-joined"; roomId: string; clientId: string; user?: any; timestamp?: string }
    | { type: "user-left"; roomId: string; clientId: string; userName?: string; timestamp?: string }
    | { type: "room-message"; roomId: string; content: string; userId?: string; userName?: string; timestamp?: string }
    | {
        type: "location-update";
        roomId?: string;
        latitude?: number;
        longitude?: number;
        timestamp?: string;
        accuracy?: number;
        data?: any;
        userId?: string;
        userName?: string;
    }
    | {
        type: "emergency-alert";
        roomId?: string;
        emergencyUserId?: string;
        emergencyUserName?: string;
        message?: string;
        timestamp?: string;
    }
    | { type: "emergency-activated"; roomId?: string; message?: string; timestamp?: string }
    | { type: "emergency-confirmed"; activatedRooms?: string[]; message?: string; timestamp?: string }
    | { type: "error"; message: string; timestamp?: string }
    | { type: "pong"; timestamp?: string };

type ClientMessage =
    | { type: "create-room"; roomId?: string }
    | { type: "join-room"; roomId: string }
    | { type: "approve-join"; roomId: string; clientId: string }
    | { type: "deny-join"; roomId: string; clientId: string }
    | { type: "get-users"; roomId: string }
    | {
        type: "location-update";
        roomId?: string;
        latitude: number;
        longitude: number;
        timestamp?: string | number;
        accuracy?: number;
        userId?: string;
        userName?: string;
    }
    | { type: "emergency-sos" }
    | { type: "ping" };

export function getJoinedRooms() {
    if (!currentHandshakeUserId) return [];
    return getOrCreateUserState(currentHandshakeUserId).roomIds;
}

export function getActiveRoom() {
    if (!currentHandshakeUserId) return null;
    return getOrCreateUserState(currentHandshakeUserId).activeRoomId;
}

export function setActiveRoom(roomId: string) {
    const id = (roomId ?? "").trim();
    if (!id) return;

    currentActiveRoomId = id;

    if (currentHandshakeUserId) {
        const st = getOrCreateUserState(currentHandshakeUserId);
        st.activeRoomId = id;
        st.roomIds = mergeRoomIds(st.roomIds, [id]);
    }
}

export function getRoomUsers(roomId: string) {
    if (!roomId) return;
    safeEmit({ type: "get-users", roomId });
}

/**
 * Foreground location can be WS; background should prefer REST fallback.
 */
export async function sendLocationUpdate(payload: {
    roomId?: string;
    latitude: number;
    longitude: number;
    timestamp?: string | number;
    accuracy?: number;
    userId?: string;
    userName?: string;
}) {
    safeEmit({ type: "location-update", ...payload });
}

export function sendEmergencySOS() {
    safeEmit({ type: "emergency-sos" });
}

export function isWSConnected() {
    return isWSOpen();
}

/**
 * Logout/account switch helper:
 * - Disconnect socket
 * - Clear queued messages (prevents cross-account leakage)
 * - Reset only current connection state
 * - Keep per-user cache intact
 */
export function resetWSForAuthSwitch() {
    wipePending();
    intentionalClose = true;
    try {
        socket?.close();
    } catch {
        // ignore
    } finally {
        // resetConnectionState() will run on close too, but keep it safe.
        resetConnectionState();
    }
}

/** Optional debug: wipe ALL per-user cached room state. */
export function clearKnownRooms() {
    roomStateByUser.clear();
}

function safeQueue(msg: ClientMessage) {
    if (pending.length >= MAX_PENDING) pending.shift();
    pending.push(JSON.stringify(msg));
}

function safeEmit(msg: ClientMessage) {
    const ws = socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(msg));
        } catch {
            safeQueue(msg);
        }
    } else {
        safeQueue(msg);
    }
}

function buildHeaderArgs(args: ConnectWSArgs) {
    const headers: Record<string, string> = { ...(args.headers ?? {}) };
    if (args.authToken && !headers.Authorization) {
        headers.Authorization = `Bearer ${args.authToken}`;
    }
    return headers;
}

function getHandshakeUserId(msg: any): string | null {
    return msg?.user?.id ?? msg?.clientId ?? null;
}

function handleConnectedMessage(msg: any) {
    const nextUserId = getHandshakeUserId(msg);
    currentHandshakeUserId = nextUserId;
    setRoomTruthFromConnected(Array.isArray(msg.roomIds) ? msg.roomIds : []);
}

export function connectWS(args: ConnectWSArgs) {
    lastConnectArgs = args;

    onMessageRef = args.onMessage;
    onOpenRef = args.onOpen ?? null;
    onCloseRef = args.onClose ?? null;
    onErrorRef = args.onError ?? null;

    const desiredHeaders = buildHeaderArgs(args);
    const desiredAuthKey = JSON.stringify(desiredHeaders);

    // If already open/connecting BUT auth changed, force reconnect and wipe pending.
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        const currentKey = (socket as any).__authKey as string | undefined;
        if (currentKey && currentKey !== desiredAuthKey) {
            wipePending();
            intentionalClose = true;
            try {
                socket.close();
            } catch {
                // ignore
            } finally {
                resetConnectionState();
            }
        } else {
            return;
        }
    }

    // If we already have a socket object in CLOSING/CLOSED, reset.
    if (socket && (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED)) {
        resetConnectionState();
    }

    try {
        // New connection = not an intentional close.
        intentionalClose = false;

        let ws: WebSocket;

        if (Object.keys(desiredHeaders).length) {
            try {
                ws = new (WebSocket as any)(WS_URL, undefined, { headers: desiredHeaders });
            } catch {
                ws = new WebSocket(WS_URL);
            }
        } else {
            ws = new WebSocket(WS_URL);
        }

        (ws as any).__authKey = desiredAuthKey;
        socket = ws;

        socket.onopen = async () => {
            // Flush queued messages
            if (pending.length) {
                const copy = pending.slice();
                pending = [];
                for (const raw of copy) {
                    try {
                        socket?.send(raw);
                    } catch {
                        pending.unshift(raw);
                        break;
                    }
                }
            }

            onOpenRef?.();
            openResolve?.();
            openResolve = null;
            openReject = null;
        };

        socket.onmessage = (evt) => {
            try {
                const msg = JSON.parse((evt as any).data) as ServerMessage;

                if (msg.type === "connected") {
                    handleConnectedMessage(msg as any);
                } else {
                    const anyMsg = msg as any;
                    if (typeof anyMsg.roomId === "string") {
                        upsertKnownRoom(anyMsg.roomId);
                    }
                }

                onMessageRef?.(msg);
            } catch {
                // ignore malformed messages
            }
        };

        socket.onclose = (e) => {
            onCloseRef?.(e);
            resetConnectionState();
        };

        socket.onerror = (e) => {
            // Suppress teardown noise on logout/disconnect.
            if (intentionalClose) return;
            onErrorRef?.(e as any);
        };
    } catch (err) {
        if (!intentionalClose) onErrorRef?.(err as any);
        resetConnectionState();
    }
}

export function disconnectWS(opts?: { wipeKnownRooms?: boolean; wipePending?: boolean }) {
    try {
        if (opts?.wipePending) wipePending();
        intentionalClose = true;
        socket?.close();
    } catch {
        // ignore
    } finally {
        resetConnectionState();
        if (opts?.wipeKnownRooms) clearKnownRooms();
    }
}

async function waitForOpen() {
    if (isWSOpen()) return;

    if (!openPromise) {
        openPromise = new Promise<void>((resolve, reject) => {
            openResolve = resolve;
            openReject = reject;
        });

        if (!socket && lastConnectArgs) {
            connectWS(lastConnectArgs);
        }
    }

    if (!socket) {
        openReject?.(new Error("WS not initialized: call connectWS() first."));
        openReject = null;
    }

    return openPromise;
}

export async function createRoom(roomId?: string) {
    await waitForOpen();
    safeEmit({ type: "create-room", roomId });
}

export async function joinRoom(roomId: string) {
    if (!roomId) return;
    await waitForOpen();
    safeEmit({ type: "join-room", roomId });
}

export async function approveJoin(roomId: string, clientId: string) {
    if (!roomId || !clientId) return;
    await waitForOpen();
    safeEmit({ type: "approve-join", roomId, clientId });
}

export async function denyJoin(roomId: string, clientId: string) {
    if (!roomId || !clientId) return;
    await waitForOpen();
    safeEmit({ type: "deny-join", roomId, clientId });
}
