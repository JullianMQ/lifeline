import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import {
    connectWS,
    disconnectWS,
    resetWSForAuthSwitch,
    createRoom,
    joinRoom,
    getJoinedRooms,
    getActiveRoom,
    setActiveRoom,
    getRoomUsers,
    isWSConnected,
    sendEmergencySOS,
    type ServerMessage,
} from "@/lib/services/websocket";

import { getToken } from "@/lib/api/storage/user";
import { getOwnerRoomId, setOwnerRoomId, clearOwnerRoomId } from "@/lib/api/storage/ws_rooms";

export type AppNotification = {
    type: "info" | "error" | "join-request" | "emergency-alert" | "emergency-confirmed";
    message: string;
    timestamp?: string;
    roomId?: string;
    fromUser?: { id: string; name?: string };
    clientId?: string;
};

type WSContextValue = {
    isConnected: boolean;
    activeRoomId: string | null;
    rooms: string[];
    serverTimestamp: string | null;
    lastError: string | null;

    roomUsers: Record<string, any[]>;
    notifications: AppNotification[];

    ensureMyRoom: () => Promise<void>;
    setActiveRoomId: (roomId: string) => void;
    requestUsers: (roomId: string) => void;

    sos: () => Promise<void> | void;
};

const WSContext = createContext<WSContextValue | null>(null);

type WSProviderProps = {
    children: React.ReactNode;
    authToken?: string | null;
    headers?: Record<string, string>;
};

// ---- deterministic room id helper (32 hex) ----
function fnv1a32(input: string, seed = 0x811c9dc5) {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
}
function hex32(x: number) {
    return (x >>> 0).toString(16).padStart(8, "0");
}
function deterministicRoomIdForUser(userId: string) {
    const h1 = fnv1a32(userId, 0x811c9dc5);
    const h2 = fnv1a32(`lifeline:${userId}`, 0x811c9dc5);
    const h3 = fnv1a32(`owner:${userId}`, 0x811c9dc5);
    const h4 = fnv1a32(`room:${userId}`, 0x811c9dc5);
    return `${hex32(h1)}${hex32(h2)}${hex32(h3)}${hex32(h4)}`;
}
function isValidRoomId(roomId: string) {
    return /^[a-f0-9]{32}$/i.test(roomId);
}

export function WSProvider({ children, authToken, headers }: WSProviderProps) {
    const [resolvedToken, setResolvedToken] = useState<string | null>(authToken ?? null);

    const [isConnected, setIsConnected] = useState(false);
    const [rooms, setRooms] = useState<string[]>([]);
    const [activeRoomIdState, setActiveRoomIdState] = useState<string | null>(null);
    const [serverTimestamp, setServerTimestamp] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const [roomUsers, setRoomUsers] = useState<Record<string, any[]>>({});
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    const hasHandshakeRef = useRef(false);
    const userRef = useRef<any>(null);
    const clientIdRef = useRef<string | null>(null);

    const ensureInFlightRef = useRef(false);
    const ensureRequestedBeforeHandshakeRef = useRef(false);
    const ownedRoomReadyRef = useRef(false);

    const ownerRecoveryRef = useRef<{ userId: string; roomId: string } | null>(null);

    // NEW: suppress WS onError logging during logout / auth-switch teardown
    const suppressErrorLogsRef = useRef(false);

    const addNotif = (n: AppNotification) => {
        setNotifications((prev) => [n, ...prev].slice(0, 50));
    };

    const getCurrentUserId = () => {
        return (userRef.current?.id ?? clientIdRef.current ?? null) as string | null;
    };

    const syncRooms = () => {
        const joined = getJoinedRooms();
        setRooms(joined);

        const active = getActiveRoom();
        if (active && joined.includes(active)) {
            setActiveRoomIdState(active);
        } else if (!activeRoomIdState && joined.length) {
            setActiveRoom(joined[0]);
            setActiveRoomIdState(joined[0]);
        }
    };

    const ensureOwnerRoom = async () => {
        if (!hasHandshakeRef.current) {
            ensureRequestedBeforeHandshakeRef.current = true;
            return;
        }
        if (ensureInFlightRef.current || ownedRoomReadyRef.current) return;

        const userId = getCurrentUserId();
        if (!userId) return;

        ensureInFlightRef.current = true;

        const saved = await getOwnerRoomId(userId).catch(() => null);
        const desired = saved && isValidRoomId(saved) ? saved : deterministicRoomIdForUser(userId);

        ownerRecoveryRef.current = { userId, roomId: desired };

        try {
            await joinRoom(desired);
        } catch {
            // join result handled via messages
        }
    };

    const ensureMyRoom = async () => {
        await ensureOwnerRoom();
    };

    const handleMessage = (msg: ServerMessage) => {
        if ("timestamp" in msg) setServerTimestamp((msg as any).timestamp ?? null);

        switch (msg.type) {
            case "connected": {
                clientIdRef.current = (msg as any).clientId ?? null;
                userRef.current = (msg as any).user ?? null;

                hasHandshakeRef.current = true;
                ownedRoomReadyRef.current = false;
                ensureInFlightRef.current = false;
                ownerRecoveryRef.current = null;

                setLastError(null);
                syncRooms();

                if (ensureRequestedBeforeHandshakeRef.current) {
                    ensureRequestedBeforeHandshakeRef.current = false;
                }

                ensureOwnerRoom().catch(() => { });
                break;
            }

            case "auto-joined":
            case "auto-join-summary": {
                syncRooms();
                break;
            }

            case "room-created": {
                const roomId = (msg as any).roomId as string | undefined;
                const userId = getCurrentUserId();

                if (roomId && userId) {
                    setOwnerRoomId(userId, roomId).catch(() => { });
                    ownedRoomReadyRef.current = true;

                    setActiveRoom(roomId);
                    setActiveRoomIdState(roomId);

                    setRooms((prev) => Array.from(new Set<string>([...prev, roomId])));
                }

                ensureInFlightRef.current = false;
                ownerRecoveryRef.current = null;
                syncRooms();
                break;
            }

            case "join-approved": {
                const roomId = (msg as any).roomId as string | undefined;
                const userId = getCurrentUserId();

                if (roomId) setRooms((prev) => Array.from(new Set<string>([...prev, roomId])));

                const rec = ownerRecoveryRef.current;
                if (rec && userId && rec.userId === userId && roomId === rec.roomId) {
                    setOwnerRoomId(userId, roomId!).catch(() => { });
                    ownedRoomReadyRef.current = true;
                    ensureInFlightRef.current = false;
                    ownerRecoveryRef.current = null;

                    setActiveRoom(roomId!);
                    setActiveRoomIdState(roomId!);
                }

                syncRooms();
                break;
            }

            case "join-denied": {
                const message = ((msg as any).message ?? "Join denied") as string;
                const deniedRoomId = ((msg as any).roomId ?? null) as string | null;

                setLastError(message);

                const userId = getCurrentUserId();
                const rec = ownerRecoveryRef.current;

                const matchesRecovery =
                    !!rec &&
                    !!userId &&
                    rec.userId === userId &&
                    (!deniedRoomId || deniedRoomId === rec.roomId);

                if (matchesRecovery) {
                    clearOwnerRoomId(userId).catch(() => { });
                    createRoom(rec.roomId)
                        .catch((err: any) => setLastError(err?.message ?? "Failed to create owner room"))
                        .finally(() => {
                            ensureInFlightRef.current = false;
                        });
                    return;
                }

                ensureInFlightRef.current = false;
                break;
            }

            case "room-users": {
                const m = msg as any;
                if (m.roomId) setRoomUsers((prev) => ({ ...prev, [m.roomId]: m.users ?? [] }));
                break;
            }

            case "emergency-alert": {
                const m = msg as any;
                const myId = getCurrentUserId();
                if (myId && m.emergencyUserId === myId) break;

                addNotif({
                    type: "emergency-alert",
                    message: m.message ?? "Emergency alert",
                    timestamp: m.timestamp,
                    roomId: m.roomId,
                    fromUser: { id: m.emergencyUserId, name: m.emergencyUserName },
                });
                break;
            }

            case "emergency-confirmed": {
                const m = msg as any;
                addNotif({
                    type: "emergency-confirmed",
                    message: m.message ?? "Emergency confirmed",
                    timestamp: m.timestamp,
                });
                break;
            }

            case "join-request": {
                const m = msg as any;
                addNotif({
                    type: "join-request",
                    message: `${m.user?.name ?? "A user"} wants to join`,
                    timestamp: m.timestamp,
                    roomId: m.roomId,
                    fromUser: { id: m.clientId, name: m.user?.name },
                    clientId: m.clientId,
                });
                break;
            }

            case "user-joined": {
                const m = msg as any;
                addNotif({
                    type: "info",
                    message: `${m.user?.name ?? "A user"} joined`,
                    timestamp: m.timestamp,
                    roomId: m.roomId,
                    fromUser: { id: m.clientId, name: m.user?.name },
                });
                break;
            }

            case "error": {
                setLastError((msg as any).message ?? "WebSocket error");
                break;
            }

            default:
                break;
        }
    };

    const connectOnce = (token: string) => {
        connectWS({
            authToken: token,
            headers,
            onOpen: () => setIsConnected(true),
            onMessage: handleMessage,
            onClose: () => {
                setIsConnected(false);
                hasHandshakeRef.current = false;
                ensureInFlightRef.current = false;
                ownedRoomReadyRef.current = false;
            },

            // ✅ FIX: don’t log teardown errors during logout/auth switch
            onError: (e) => {
                if (suppressErrorLogsRef.current) return;

                // RN WebSocket error can fire after a normal close; ignore if not connected.
                if (!isWSConnected()) return;

                // Optional: keep a small dev log instead of dumping the whole event
                if (__DEV__) {
                    const rs =
                        (e as any)?.currentTarget?.readyState ??
                        (e as any)?.target?.readyState ??
                        "unknown";
                    console.log("[WS] onError", { readyState: rs });
                }
            },
        });
    };

    // Resolve token if parent didn't pass it
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (authToken !== undefined) {
                setResolvedToken(authToken ?? null);
                return;
            }
            const t = await getToken().catch(() => null);
            if (!cancelled) setResolvedToken(t ?? null);
        })();

        return () => {
            cancelled = true;
        };
    }, [authToken]);

    // Reconnect/reset whenever token changes
    const prevTokenRef = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        const prev = prevTokenRef.current;
        prevTokenRef.current = resolvedToken;

        // first render
        if (prev === undefined) {
            if (resolvedToken) connectOnce(resolvedToken);
            return;
        }

        // Any auth transition -> hard reset
        suppressErrorLogsRef.current = true;

        resetWSForAuthSwitch();

        setIsConnected(false);
        setRooms([]);
        setActiveRoomIdState(null);
        setServerTimestamp(null);
        setLastError(null);
        setRoomUsers({});
        setNotifications([]);

        hasHandshakeRef.current = false;
        ensureInFlightRef.current = false;
        ownedRoomReadyRef.current = false;
        ownerRecoveryRef.current = null;

        userRef.current = null;
        clientIdRef.current = null;

        // allow errors again after teardown settles
        setTimeout(() => {
            suppressErrorLogsRef.current = false;
        }, 750);

        if (resolvedToken) connectOnce(resolvedToken);
    }, [resolvedToken]);

    // Foreground reconnect + (if token unmanaged) refresh token
    useEffect(() => {
        const sub = AppState.addEventListener("change", async (state) => {
            if (state !== "active") return;

            if (authToken === undefined) {
                const latest = await getToken().catch(() => null);
                if (latest !== resolvedToken) {
                    setResolvedToken(latest ?? null);
                    return;
                }
            }

            if (resolvedToken && !isWSConnected()) {
                connectOnce(resolvedToken);
            }

            if (resolvedToken) {
                ensureOwnerRoom().catch(() => { });
            }
        });

        return () => sub.remove();
    }, [authToken, resolvedToken]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // also suppress logs during unmount teardown
            suppressErrorLogsRef.current = true;
            disconnectWS({ wipeKnownRooms: true, wipePending: true });
        };
    }, []);

    const setActiveRoomId = (roomId: string) => {
        setActiveRoom(roomId);
        setActiveRoomIdState(roomId);
        syncRooms();
    };

    const requestUsers = (roomId: string) => {
        getRoomUsers(roomId);
    };

    const sos = async () => {
        await ensureOwnerRoom();
        sendEmergencySOS();
    };

    const value = useMemo<WSContextValue>(
        () => ({
            isConnected,
            activeRoomId: activeRoomIdState ?? getActiveRoom(),
            rooms,
            serverTimestamp,
            lastError,
            roomUsers,
            notifications,
            ensureMyRoom,
            setActiveRoomId,
            requestUsers,
            sos,
        }),
        [isConnected, activeRoomIdState, rooms, serverTimestamp, lastError, roomUsers, notifications]
    );

    return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}

export function useWS() {
    const ctx = useContext(WSContext);
    if (!ctx) throw new Error("useWS must be used within WSProvider");
    return ctx;
}
