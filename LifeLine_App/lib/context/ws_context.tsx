import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
    connectWS,
    disconnectWS,
    createRoom,
    joinRoom,
    sendRoomMessage,
    sendEmergencySOS,
    getRoomUsers,
    getJoinedRooms,
    getActiveRoom,
    setActiveRoom,
    isWSOpen,
    type ServerMessage,
} from "@/lib/services/websocket";

type RoomUsersMap = Record<string, any[]>;

export type AppNotification = {
    id: string;
    type: "emergency-alert" | "room-message" | "system";
    message: string;
    timestamp: string;
    read: boolean;
    roomId?: string;
    fromUser?: any;
};

type WSContextValue = {
    isConnected: boolean;
    clientId: string | null;
    user: any | null;

    rooms: string[];
    activeRoomId: string | null;

    serverTimestamp: string | null;
    lastMessage: ServerMessage | null;
    lastError: string | null;

    notifications: AppNotification[];
    markNotifRead: (id: string) => void;
    deleteNotif: (id: string) => void;
    clearNotifs: () => void;

    ensureMyRoom: () => void;
    joinRoomById: (roomId: string) => void;
    setActiveRoomId: (roomId: string) => void;

    sendToRoom: (content: any, roomId?: string) => void;
    sos: () => void;

    roomUsers: RoomUsersMap;
    refreshUsers: (roomId?: string) => void;
};

const WSContext = createContext<WSContextValue | null>(null);

export function WSProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [clientId, setClientId] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);

    const [rooms, setRooms] = useState<string[]>([]);
    const [activeRoomIdState, setActiveRoomIdState] = useState<string | null>(null);

    const [serverTimestamp, setServerTimestamp] = useState<string | null>(null);
    const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const [roomUsers, setRoomUsers] = useState<RoomUsersMap>({});

    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    // FIX (coderabbit): avoid stale activeRoomIdState in message handlers
    const activeRoomIdRef = useRef<string | null>(activeRoomIdState);
    const setActiveRoomIdStateSafe = (next: string | null) => {
        activeRoomIdRef.current = next;
        setActiveRoomIdState(next);
    };

    const hasHandshakeRef = useRef(false);
    const userRef = useRef<any>(null);
    const clientIdRef = useRef<string | null>(null);

    const ensureInFlightRef = useRef(false);
    const ensureRequestedBeforeHandshakeRef = useRef(false);
    const ownedRoomReadyRef = useRef(false);

    const ownerRecoveryRef = useRef<{ userId: string; roomId: string | null; mode: "join" | "create" } | null>(null);

    // FIX (coderabbit): safety timeout so ensureInFlight never sticks forever
    const ensureTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ENSURE_TIMEOUT_MS = 10_000;

    // suppress WS onError logging during logout / auth-switch teardown
    const suppressErrorLogsRef = useRef(false);

    const addNotif = (n: AppNotification) => {
        setNotifications((prev) => [n, ...prev].slice(0, 50));
    };

    const getCurrentUserId = () => {
        return (userRef.current?.id ?? clientIdRef.current ?? null) as string | null;
    };

    const clearEnsureTimeout = () => {
        if (ensureTimeoutIdRef.current) {
            clearTimeout(ensureTimeoutIdRef.current);
            ensureTimeoutIdRef.current = null;
        }
    };

    const clearEnsureInFlight = (opts?: { clearRecovery?: boolean; setError?: string | null }) => {
        clearEnsureTimeout();
        ensureInFlightRef.current = false;

        if (opts?.clearRecovery) {
            ownerRecoveryRef.current = null;
        }
        if (opts?.setError !== undefined) {
            setLastError(opts.setError);
        }
    };

    const beginEnsureAttempt = (opts?: { onTimeoutError?: string; clearRecoveryOnTimeout?: boolean }) => {
        clearEnsureTimeout();
        ensureInFlightRef.current = true;

        ensureTimeoutIdRef.current = setTimeout(() => {
            // If server never responds, unblock future attempts
            ensureInFlightRef.current = false;

            if (opts?.clearRecoveryOnTimeout) {
                ownerRecoveryRef.current = null;
            }

            setLastError(opts?.onTimeoutError ?? "Room recovery timed out. Please try again.");
            ensureTimeoutIdRef.current = null;
        }, ENSURE_TIMEOUT_MS);
    };

    const syncRooms = () => {
        const joined = getJoinedRooms();
        setRooms(joined);

        const active = getActiveRoom();
        if (active && joined.includes(active)) {
            setActiveRoomIdStateSafe(active);
        } else if (!activeRoomIdRef.current && joined.length) {
            setActiveRoom(joined[0]);
            setActiveRoomIdStateSafe(joined[0]);
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

        const saved = await getOwnerRoomId(userId).catch(() => null);

        // Spec: room IDs are cryptographically random (server-generated). Avoid deterministic IDs.
        // If we have a saved owner roomId, try to re-join it. Otherwise, create a new room.
        if (saved && isValidRoomId(saved)) {
            ownerRecoveryRef.current = { userId, roomId: saved, mode: "join" };

            // Start ensure attempt timeout; will be cleared on join-approved/join-denied/close
            beginEnsureAttempt({
                onTimeoutError: "Could not rejoin your room (timeout). Please try again.",
                clearRecoveryOnTimeout: true,
            });

            try {
                // joinRoom only sends; server response is handled in handleMessage
                await joinRoom(saved);
            } catch {
                // If sending fails immediately, clear and allow retry
                clearEnsureInFlight({ clearRecovery: true, setError: "Failed to send join request." });
            }
            return;
        }

        ownerRecoveryRef.current = { userId, roomId: null, mode: "create" };

        beginEnsureAttempt({
            onTimeoutError: "Could not create your room (timeout). Please try again.",
            clearRecoveryOnTimeout: true,
        });

        try {
            await createRoom();
        } catch (err: any) {
            clearEnsureInFlight({
                clearRecovery: true,
                setError: err?.message ?? "Failed to create room",
            });
        }
    };

    const ensureMyRoom = async () => {
        await ensureOwnerRoom();
    };

    const handleMessage = (msg: ServerMessage) => {
        setLastMessage(msg);
        if ("timestamp" in msg) setServerTimestamp((msg as any).timestamp);

        switch (msg.type) {
            case "connected": {
                setClientId((msg as any).clientId);
                setUser((msg as any).user);
                setLastError(null);

                hasHandshakeRef.current = true;
                ownedRoomReadyRef.current = false;

                // terminal reset for any in-flight recovery attempt
                clearEnsureInFlight({ clearRecovery: true, setError: null });

                // Server truth: connected.roomIds
                const serverRoomIds = (msg as any).roomIds;
                if (Array.isArray(serverRoomIds)) {
                    setRooms(serverRoomIds);

                    const active = getActiveRoom();
                    if (active && serverRoomIds.includes(active)) {
                        setActiveRoomIdStateSafe(active);
                    } else if (serverRoomIds.length) {
                        setActiveRoom(serverRoomIds[0]);
                        setActiveRoomIdStateSafe(serverRoomIds[0]);
                    } else {
                        setActiveRoomIdStateSafe(null);
                    }
                } else {
                    syncRooms();
                }

                if (ensureRequestedBeforeHandshakeRef.current) {
                    ensureRequestedBeforeHandshakeRef.current = false;
                }
                syncRooms();
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
                    setActiveRoomIdStateSafe(roomId);

                    setRooms((prev) => Array.from(new Set<string>([...prev, roomId])));
                }

                // terminal success: clear ensure + recovery
                clearEnsureInFlight({ clearRecovery: true });

                syncRooms();
                break;
            }

            case "join-approved": {
                const roomId = (msg as any).roomId as string | undefined;
                const userId = getCurrentUserId();

                if (roomId) setRooms((prev) => Array.from(new Set<string>([...prev, roomId])));

                const rec = ownerRecoveryRef.current;

                // If this approval corresponds to our owner-room recovery, mark ready and clear in-flight
                if (rec && userId && rec.userId === userId && rec.mode === "join" && roomId && rec.roomId && roomId === rec.roomId) {
                    setOwnerRoomId(userId, roomId).catch(() => { });
                    ownedRoomReadyRef.current = true;

                    setActiveRoom(roomId);
                    setActiveRoomIdStateSafe(roomId);

                    // terminal success: clear ensure + recovery
                    clearEnsureInFlight({ clearRecovery: true, setError: null });
                }

                syncRooms();
                break;
            }

            case "join-denied": {
                const message = ((msg as any).message ?? "Join denied") as string;
                setLastError(message);

                const userId = getCurrentUserId();
                const rec = ownerRecoveryRef.current;

                // If we tried to re-join a previously saved owner room and it no longer exists (or is not accessible),
                // clear the saved value and create a fresh server-generated room.
                const shouldRecreateOwnerRoom =
                    !!rec &&
                    !!userId &&
                    rec.userId === userId &&
                    rec.mode === "join" &&
                    /room not found|not authorized/i.test(message);

                if (shouldRecreateOwnerRoom) {
                    clearOwnerRoomId(userId).catch(() => { });

                    ownerRecoveryRef.current = { userId, roomId: null, mode: "create" };

                    // Keep ensure in-flight but restart timeout for the create attempt
                    beginEnsureAttempt({
                        onTimeoutError: "Could not create a new room (timeout). Please try again.",
                        clearRecoveryOnTimeout: true,
                    });

                    createRoom().catch((err: any) => {
                        clearEnsureInFlight({
                            clearRecovery: true,
                            setError: err?.message ?? "Failed to create owner room",
                        });
                    });

                    return;
                }

                // terminal failure: clear ensure + recovery (allow future attempts)
                clearEnsureInFlight({ clearRecovery: true });
                break;
            }

            case "room-users": {
                const m = msg as any;
                if (m.roomId) setRoomUsers((prev) => ({ ...prev, [m.roomId]: m.users ?? [] }));
                break;
            }

            case "join-denied": {
                // This can still happen when you explicitly join a room that doesn't exist.
                // But we should NOT loop creating/joining here anymore.
                setLastError((msg as any).message ?? "Join denied");
                creatingMyRoomRef.current = false;
                break;
            }

            case "emergency-alert": {
                const m = msg as any;

                // Don't notify myself if I'm the one who triggered SOS
                const ownerId = m.owner?.id ?? m.owner?.clientId ?? null;
                const myId = user?.id ?? clientId ?? null;
                if (ownerId && myId && ownerId === myId) break;

                addNotif({
                    type: "emergency-alert",
                    message: m.message ?? "Emergency alert received",
                    timestamp: m.timestamp,
                    roomId: m.roomId,
                    fromUser: m.owner,
                });
                break;
            }

            case "emergency-confirmed": {
                const m = msg as any;
                addNotif({
                    type: "emergency-confirmed",
                    message: `Emergency confirmed${Array.isArray(m.activatedRooms) ? ` (${m.activatedRooms.length} room(s))` : ""
                        }`,
                    timestamp: m.timestamp,
                });
                break;
            }

            case "emergency-activated": {
                const m = msg as any;
                addNotif({
                    type: "emergency-activated",
                    message: `Emergency activated in room ${m.roomId}`,
                    timestamp: m.timestamp,
                    roomId: m.roomId,
                    fromUser: { id: m.clientId, name: m.userName },
                });
                break;
            }

            case "user-joined": {
                const m = msg as any;
                addNotif({
                    type: "user-joined",
                    message: `${m.user?.name ?? "A user"} joined`,
                    timestamp: m.timestamp,
                    fromUser: { id: m.clientId, name: m.user?.name },
                });
                break;
            }

            case "user-left": {
                const m = msg as any;
                addNotif({
                    type: "user-left",
                    message: `${m.userName ?? "A user"} left`,
                    timestamp: m.timestamp,
                    fromUser: { id: m.clientId, name: m.userName },
                });
                break;
            }

            case "emergency-contact-joined": {
                const m = msg as any;
                addNotif({
                    type: "emergency-contact-joined",
                    message: `${m.contactName ?? "Emergency contact"} joined`,
                    timestamp: m.timestamp,
                    fromUser: { id: m.contactId, name: m.contactName },
                });
                break;
            }

            case "error": {
                setLastError((msg as any).message ?? "WS error");
                break;
            }

            default:
                break;
        }
    };

    const handleClose = () => {
        setIsConnected(false);
        hasHandshakeRef.current = false;
        ownedRoomReadyRef.current = false;

        // FIX (coderabbit): explicitly clear ensureInFlight and recovery on close
        clearEnsureInFlight({ clearRecovery: true });
    };

    const connectOnce = (token: string) => {
        connectWS({
            onMessage: handleMessage,
            onClose: handleClose,

            onError: (e) => {
                console.log("WS onError", e);
            },
        });
    };

    // Connect once when provider mounts
    useEffect(() => {
        connectOnce();
        return () => disconnectWS();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Optional: background/foreground handling (do NOT disconnect on "inactive" which happens during navigation)
    useEffect(() => {
        const prev = prevTokenRef.current;
        prevTokenRef.current = resolvedToken;

        if (prev === undefined) {
            if (resolvedToken) connectOnce(resolvedToken);
            return;
        }

        suppressErrorLogsRef.current = true;

        resetWSForAuthSwitch();

        setIsConnected(false);
        setRooms([]);
        setActiveRoomIdStateSafe(null);
        setServerTimestamp(null);
        setLastError(null);
        setRoomUsers({});
        setNotifications([]);

        hasHandshakeRef.current = false;
        ownedRoomReadyRef.current = false;
        ownerRecoveryRef.current = null;

        // ensure flags should always be cleared on auth changes
        clearEnsureInFlight({ clearRecovery: true });

        userRef.current = null;
        clientIdRef.current = null;

        setTimeout(() => {
            suppressErrorLogsRef.current = false;
        }, 750);

        if (resolvedToken) connectOnce(resolvedToken);
    }, [resolvedToken]);

    const lastStateRef = useRef<string>(AppState.currentState);
    // Foreground reconnect + (if token unmanaged) refresh token
    useEffect(() => {
        const sub = AppState.addEventListener("change", async (state) => {
            const prev = lastStateRef.current;
            lastStateRef.current = state;

            // IMPORTANT:
            // "inactive" often happens during permission dialogs.
            // Do NOT disconnect WS on inactive, or you will thrash connections.
            if (state === "background") {
                // disconnectWS({ wipeKnownRooms: false, wipePending: false });
                // setIsConnected(false);
                hasHandshakeRef.current = false;
                ownedRoomReadyRef.current = false;

                // clear in-flight ensure so it doesn't get stuck while backgrounded
                clearEnsureInFlight({ clearRecovery: true });

                return;
            }

            if (state !== "active") {
                return;
            }

            // state === "active"
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
            suppressErrorLogsRef.current = true;

            // clear ensure timers/refs to avoid setState after unmount
            clearEnsureInFlight({ clearRecovery: true });

            disconnectWS({ wipeKnownRooms: true, wipePending: true });
        };
    }, []);

    // ---- actions ----

    const setActiveRoomId = (roomId: string) => {
        setActiveRoom(roomId);
        setActiveRoomIdStateSafe(roomId);
        syncRooms();
    };

    const ensureMyRoom = () => {
        ensureMyRoomInternal();
    };

    const joinRoomById = (roomId: string) => {
        joinRoom(roomId);
    };

    const sendToRoom = (content: any, roomId?: string) => {
        const rid = roomId ?? activeRoomIdState ?? getActiveRoom() ?? undefined;
        sendRoomMessage(content, rid);
    };

    const sos = () => sendEmergencySOS();

    const refreshUsers = (roomId?: string) => getRoomUsers(roomId);

    const value = useMemo<WSContextValue>(
        () => ({
            isConnected,
            clientId,
            user,

            rooms,
            activeRoomId: activeRoomIdState ?? getActiveRoom(),

            serverTimestamp,
            lastMessage,
            lastError,

            notifications,
            markNotifRead,
            deleteNotif,
            clearNotifs,

            ensureMyRoom,
            joinRoomById,
            setActiveRoomId,

            sendToRoom,
            sos,

            roomUsers,
            refreshUsers,
        }),
        [
            isConnected,
            clientId,
            user,
            rooms,
            activeRoomIdState,
            serverTimestamp,
            lastMessage,
            lastError,
            notifications,
            roomUsers,
        ]
    );

    return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}

export function useWS() {
    const ctx = useContext(WSContext);
    if (!ctx) throw new Error("useWS must be used within WSProvider");
    return ctx;
}
