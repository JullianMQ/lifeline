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
 *
 */

function normalizeToWsBase(input: string) {
    const base = (input ?? "").trim().replace(/\/$/, "");
    if (!base) return "";

    // If user provides http(s), convert to ws(s)
    if (base.startsWith("http://")) return "ws://" + base.slice("http://".length);
    if (base.startsWith("https://")) return "wss://" + base.slice("https://".length);

    // If already ws(s) or something else, keep as-is
    return base;
}

function resolveWsUrl() {
    const baseRaw = (WS_BASE_URL ?? "").trim();
    const base = normalizeToWsBase(baseRaw);

    // If WS_BASE_URL is provided, keep existing logic (but ensure absolute ws(s) scheme).
    if (base) {
        // Spec endpoint: ws(s)://<host>/api/ws
        // If WS_BASE_URL already includes /api, avoid /api/api.
        if (base.endsWith("/api")) return `${base}/ws`;
        return `${base}/api/ws`;
    }

    const hasWindow = typeof window !== "undefined";
    const loc = hasWindow ? (window as any).location : undefined;

    if (loc?.host) {
        const proto = loc.protocol === "https:" ? "wss:" : "ws:";
        return `${proto}//${loc.host}/api/ws`;
    }

    // React Native fallback
    const envUrl =
        (typeof process !== "undefined" && (process as any)?.env?.EXPO_PUBLIC_WS_URL) ||
        (typeof process !== "undefined" && (process as any)?.env?.WS_URL) ||
        "";

    if (typeof envUrl === "string" && envUrl.trim()) {
        const normalized = normalizeToWsBase(envUrl.trim()).replace(/\/$/, "");
        // If env already points to .../api/ws, keep it as-is. Otherwise append /api/ws.
        if (normalized.endsWith("/api/ws")) return normalized;
        if (normalized.endsWith("/api")) return `${normalized}/ws`;
        return `${normalized}/api/ws`;
    }

    // Sensible default for local dev (RN emulator/device will need host reachable)
    return "ws://localhost:3000/api/ws";
}

const WS_URL = resolveWsUrl();

// React Native WebSocket event typings differ from DOM; keep these permissive.
type WebSocketCloseEvent = any;

let socket: WebSocket | null = null;

/** Rooms known for the CURRENT socket connection (server truth for this connection). */
let currentRoomIds: string[] = [];
let currentActiveRoomId: string | null = null;

/** Server handshake identity (for per-user room state memory). */
let currentHandshakeUserId: string | null = null;

type UserState = {
    roomIds: string[];
    activeRoomId: string | null;
};

const userStateById = new Map<string, UserState>();

let onMessageRef: ((msg: ServerMessage) => void) | null = null;
let onOpenRef: (() => void) | null = null;
let onCloseRef: ((e: WebSocketCloseEvent) => void) | null = null;
let onErrorRef: ((e: any) => void) | null = null;

let openPromise: Promise<void> | null = null;
let openResolve: (() => void) | null = null;
let openReject: ((err: any) => void) | null = null;

let intentionalClose = false;

let pending: string[] = [];

export type ClientMessage =
    | { type: "ping" }
    | { type: "create-room"; roomId?: string }
    | { type: "join-room"; roomId: string }
    | { type: "request-join"; roomId: string }
    | { type: "approve-join"; roomId: string; requesterId: string }
    | { type: "room-message"; roomId: string; content: string }
    | { type: "emergency-sos" }
    | { type: "get_users"; roomId: string }
    | { type: "location-update"; roomId?: string; latitude: number; longitude: number; timestamp?: string | number; accuracy?: number };

export type ServerMessage =
    | { type: "connected"; clientId: string; user?: any; roomIds: string[]; timestamp?: string }
    | { type: "auto-joined"; roomId: string; roomOwner: string; message: string; timestamp?: string }
    | { type: "auto-join-summary"; roomsJoined: Array<{ roomId: string; owner: string }>; message: string; timestamp?: string }
    | { type: "room-created"; roomId: string; owner: string; emergencyContacts: string[]; timestamp?: string }
    | { type: "join-request"; roomId: string; requesterId?: string; requesterUser?: any; requesterName?: string; timestamp?: string }
    | { type: "join-approved"; roomId: string; timestamp?: string }
    | { type: "join-denied"; message: string; timestamp: string }
    | { type: "room-users"; roomId: string; users: any[]; timestamp?: string }
    | { type: "location-update-confirmed"; rooms: string[]; timestamp?: string }
    | { type: "location-update"; data: any; timestamp?: string }
    | { type: "pong"; timestamp?: string }
    | { type: "error"; message: string; timestamp?: string }
    | { type: string;[k: string]: any };

function wipePending() {
    pending = [];
}

function resetConnectionState() {
    openPromise = null;
    openResolve = null;
    openReject = null;
    socket = null;

    // IMPORTANT: do not force intentionalClose=false here, because onclose can fire after reset.
    // We'll clear it when starting a new connection instead.
    // intentionalClose = false;

    // connection-scoped truth
    currentRoomIds = [];
    currentActiveRoomId = null;

    // handshake-scoped identity
    currentHandshakeUserId = null;
}

function getOrCreateUserState(userId: string): UserState {
    const existing = userStateById.get(userId);
    if (existing) return existing;
    const st: UserState = { roomIds: [], activeRoomId: null };
    userStateById.set(userId, st);
    return st;
}

function getHandshakeUserId(msg: any): string | null {
    const u = msg?.user;
    const id = (u?.id ?? msg?.clientId ?? null) as string | null;
    return typeof id === "string" && id.trim() ? id.trim() : null;
}

function mergeRoomIds(prev: string[], next: string[]) {
    const s = new Set<string>(prev);
    for (const r of next) {
        const id = String(r ?? "").trim();
        if (id) s.add(id);
    }
    return Array.from(s);
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

    currentRoomIds = mergeRoomIds(currentRoomIds, [id]);
    if (!currentActiveRoomId) currentActiveRoomId = id;

    if (currentHandshakeUserId) {
        const st = getOrCreateUserState(currentHandshakeUserId);
        st.roomIds = mergeRoomIds(st.roomIds, [id]);
        if (!st.activeRoomId) st.activeRoomId = id;
    }
}

function safeQueue(msg: ClientMessage) {
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
    return Object.keys(headers).length ? ({ headers } as any) : undefined;
}

type ConnectWSArgs = {
    authToken?: string | null;
    headers?: Record<string, string>;
    onMessage?: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: (e: WebSocketCloseEvent) => void;
    onError?: (e: any) => void;
};

function isIntentionalCloseFor(ws: any) {
    // Per-socket marker prevents races with resetConnectionState()
    return !!ws?.__intentionalClose || intentionalClose;
}

/**
 * Connect to WS. Safe for repeated calls; if same auth key & socket open/connecting, it reuses.
 */
export async function connectWS(args: ConnectWSArgs) {
    const desiredAuthKey = args.authToken ?? JSON.stringify(args.headers ?? {});
    const existingKey = (socket as any)?.__authKey;

    onMessageRef = args.onMessage ?? null;
    onOpenRef = args.onOpen ?? null;
    onCloseRef = args.onClose ?? null;
    onErrorRef = args.onError ?? null;


    if (socket && existingKey === desiredAuthKey) {
        if (socket.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        if (socket.readyState === WebSocket.CONNECTING) {
            // Return the in-flight promise instead of undefined
            if (openPromise) return openPromise;
        }
    }


    if (socket && existingKey !== desiredAuthKey) {
        resetWSForAuthSwitch();
    }

    if (openPromise) return openPromise;

    intentionalClose = false;

    openPromise = new Promise<void>((resolve, reject) => {
        openResolve = resolve;
        openReject = reject;

        try {
            const options = buildHeaderArgs(args);
            const ws = new (WebSocket as any)(WS_URL, undefined, options);

            (ws as any).__authKey = desiredAuthKey;
            (ws as any).__intentionalClose = false;

            socket = ws;

            ws.onopen = async () => {
                // Flush queued messages (preserve order; no drops on partial failure)
                if (pending.length) {
                    const copy = pending.slice();
                    pending = [];

                    for (let i = 0; i < copy.length; i++) {
                        const raw = copy[i];
                        try {
                            ws.send(raw);
                        } catch {
                            // Re-queue the failed item AND everything after it (in order).
                            pending = copy.slice(i).concat(pending);
                            break;
                        }
                    }
                }

                onOpenRef?.();

                openResolve?.();
                openResolve = null;
                openReject = null;
            };

            ws.onmessage = (evt: any) => {
                try {
                    const msg = JSON.parse(evt.data) as ServerMessage;

                    if (msg.type === "connected") {
                        handleConnectedMessage(msg as any);
                    } else {
                        const anyMsg = msg as any;
                        if (typeof anyMsg.roomId === "string") upsertKnownRoom(anyMsg.roomId);
                    }

                    onMessageRef?.(msg);
                } catch {
                    // ignore invalid messages
                }
            };

            ws.onclose = (e: any) => {
                if (!isIntentionalCloseFor(ws) && openReject) {
                    const err = new Error(
                        `WebSocket closed before open (code=${String(e?.code ?? "unknown")}, reason=${String(e?.reason ?? "")})`
                    );
                    (err as any).event = e;
                    try {
                        openReject(err);
                    } catch {
                        // ignore
                    }
                }

                onCloseRef?.(e);

                // Reset after we reject (or after open already resolved)
                resetConnectionState();
            };

            ws.onerror = (e: any) => {
                if (isIntentionalCloseFor(ws)) return;
                onErrorRef?.(e);
            };
        } catch (err) {
            if (!intentionalClose) onErrorRef?.(err as any);
            resetConnectionState();
            reject(err);
        }
    });

    return openPromise;
}

export function disconnectWS(opts?: { wipeKnownRooms?: boolean; wipePending?: boolean }) {
    try {
        if (opts?.wipePending) wipePending();
        intentionalClose = true;
        if (socket) (socket as any).__intentionalClose = true;
        socket?.close();
    } catch {
        // ignore
    } finally {
        if (opts?.wipeKnownRooms) clearKnownRooms();
        resetConnectionState();
    }
}

function handleConnectedMessage(msg: any) {
    const nextUserId = getHandshakeUserId(msg);
    currentHandshakeUserId = nextUserId;
    setRoomTruthFromConnected(Array.isArray(msg.roomIds) ? msg.roomIds : []);
}

export function getJoinedRooms() {
    if (!currentHandshakeUserId) return [];
    return getOrCreateUserState(currentHandshakeUserId).roomIds;
}

export function getActiveRoom() {
    if (!currentHandshakeUserId) return null;
    return getOrCreateUserState(currentHandshakeUserId).activeRoomId;
}

export function setActiveRoom(roomId: string) {
    if (!currentHandshakeUserId) return;
    const st = getOrCreateUserState(currentHandshakeUserId);
    if (st.roomIds.includes(roomId)) st.activeRoomId = roomId;
}

export function getRoomUsers(roomId: string) {
    if (!roomId) return;
    safeEmit({ type: "get_users", roomId });
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
}) {
    safeEmit({ type: "location-update", ...payload });
}

export function sendRoomMessage(roomId: string, content: string) {
    if (!roomId || !content) return;
    safeEmit({ type: "room-message", roomId, content });
}

export function sendEmergencySOS() {
    safeEmit({ type: "emergency-sos" });
}

export function isWSConnected() {
    return !!socket && socket.readyState === WebSocket.OPEN;
}

export function resetWSForAuthSwitch() {
    wipePending();
    try {
        intentionalClose = true;
        if (socket) (socket as any).__intentionalClose = true;
        socket?.close();
    } catch {
        // ignore
    } finally {
        resetConnectionState();
    }
}

export function clearKnownRooms() {
    currentRoomIds = [];
    currentActiveRoomId = null;
    if (currentHandshakeUserId) {
        const st = getOrCreateUserState(currentHandshakeUserId);
        st.roomIds = [];
        st.activeRoomId = null;
    }
}

async function waitForOpen() {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    if (!openPromise) throw new Error("WebSocket not connected. Call connectWS first.");
    await openPromise;
}

export async function createRoom(roomId?: string) {
    await waitForOpen();
    safeEmit({ type: "create-room", roomId });
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

export async function ping() {
    await waitForOpen();
    safeEmit({ type: "ping" });
}
