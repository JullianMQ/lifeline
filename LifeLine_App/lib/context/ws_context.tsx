import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import {
    connectWS,
    disconnectWS,
    createRoom,
    getJoinedRooms,
    getActiveRoom,
    setActiveRoom,
    getRoomUsers,
    isWSConnected,
    sendEmergencySOS,
    type ServerMessage,
} from "@/lib/services/websocket";

export type AppNotification = {
    id: string;
    type: string;
    message: string;
    timestamp?: string;
    roomId?: string;
    read: boolean;
    fromUser?: { id: string; name?: string };
};

type WSContextValue = {
    isConnected: boolean;
    clientId: string | null;
    user: any | null;
    rooms: string[];
    activeRoomId: string | null;
    serverTimestamp: string | null;
    lastError: string | null;

    roomUsers: Record<string, any[]>;
    notifications: AppNotification[];

    ensureMyRoom: () => void;
    sos: () => void;
    refreshUsers: (roomId?: string) => void;

    markNotifRead: (id: string) => void;
    deleteNotif: (id: string) => void;
    clearNotifs: () => void;

    setActiveRoomId: (roomId: string) => void;
};

const WSContext = createContext<WSContextValue | null>(null);

export function WSProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [clientId, setClientId] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);

    // Keep latest identity values for WS message handlers that may outlive a render.
    const userRef = useRef<any | null>(null);
    const clientIdRef = useRef<string | null>(null);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        clientIdRef.current = clientId;
    }, [clientId]);

    const [rooms, setRooms] = useState<string[]>([]);
    const [activeRoomIdState, setActiveRoomIdState] = useState<string | null>(null);

    const [serverTimestamp, setServerTimestamp] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const [roomUsers, setRoomUsers] = useState<Record<string, any[]>>({});
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    // legacy refs kept, but we no longer invent custom room IDs
    const myRoomIdRef = useRef<string | null>(null);
    const myRoomCreatedRef = useRef(false);
    const creatingMyRoomRef = useRef(false);

    // WS handshake + lifecycle
    const hasHandshakeRef = useRef(false);

    const addNotif = (partial: Omit<AppNotification, "id" | "read">) => {
        setNotifications((prev) => [
            {
                id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                read: false,
                ...partial,
            },
            ...prev,
        ]);
    };

    const markNotifRead = (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const deleteNotif = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const clearNotifs = () => setNotifications([]);

    const syncRooms = () => {
        const joined = getJoinedRooms();
        if (Array.isArray(joined)) setRooms(joined);

        const active = getActiveRoom();
        setActiveRoomIdState(active ?? null);
    };

    const refreshUsers = (roomId?: string) => {
        const target = roomId ?? activeRoomIdState ?? getActiveRoom();
        if (!target) return;
        getRoomUsers(target);
    };

    const ensureMyRoom = async () => {
        // Prevent loops: only request once until server confirms via "room-created"
        if (creatingMyRoomRef.current) return;
        if (myRoomCreatedRef.current) return;

        creatingMyRoomRef.current = true;
        setLastError(null);

        try {
            await createRoom();
        } catch (err: any) {
            // If WS is down and cannot be opened, createRoom() can now throw (via waitForOpen).
            // Reset the guard so the user can retry once connectivity is back.
            creatingMyRoomRef.current = false;
            setLastError(err?.message ?? "Failed to create room (WebSocket not ready)");
        } finally {
            // keep "creating" true until server confirms via "room-created"
        }
    };

    const handleMessage = (msg: ServerMessage) => {
        if ("timestamp" in msg) setServerTimestamp((msg as any).timestamp);

        switch (msg.type) {
            case "connected": {
                const nextClientId = (msg as any).clientId ?? null;
                const nextUser = (msg as any).user ?? null;

                // Update refs first so the rest of this handler reads fresh values.
                clientIdRef.current = nextClientId;
                userRef.current = nextUser;

                setClientId(nextClientId);
                setUser(nextUser);
                setLastError(null);

                hasHandshakeRef.current = true;

                // server truth (doc)
                const roomIds: string[] = Array.isArray((msg as any).roomIds) ? (msg as any).roomIds : [];
                setRooms(roomIds);

                // pick an active room if we don't have one
                const active = activeRoomIdState ?? getActiveRoom();
                if (!active && roomIds.length) {
                    setActiveRoom(roomIds[0]);
                    setActiveRoomIdState(roomIds[0]);
                }

                // reset per-connection flags
                myRoomCreatedRef.current = false;
                creatingMyRoomRef.current = false;
                myRoomIdRef.current = null;

                break;
            }

            case "auto-joined":
            case "auto-join-summary": {
                syncRooms();
                break;
            }

            case "room-created":
            case "join-approved": {
                creatingMyRoomRef.current = false;
                myRoomCreatedRef.current = true;
                syncRooms();
                break;
            }

            case "join-denied": {
                setLastError((msg as any).message ?? "Join denied");
                creatingMyRoomRef.current = false;
                break;
            }

            case "room-users": {
                const m = msg as any;
                if (m.roomId) setRoomUsers((prev) => ({ ...prev, [m.roomId]: m.users ?? [] }));
                break;
            }

            case "emergency-alert": {
                const m = msg as any;

                // IMPORTANT: use refs to avoid stale closure values.
                const myId = userRef.current?.id ?? clientIdRef.current ?? null;
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

            case "room-message": {
                const m = msg as any;
                addNotif({
                    type: "room-message",
                    message: m.content ?? "",
                    timestamp: m.timestamp,
                    roomId: m.roomId,
                    fromUser: { id: m.clientId, name: m.userName },
                });
                break;
            }

            case "user-left": {
                const m = msg as any;
                addNotif({
                    type: "user-left",
                    message: `${m.userName ?? "A user"} left`,
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
                    roomId: m.roomId,
                    fromUser: { id: m.clientId, name: m.user?.name },
                });
                break;
            }

            case "location-update": {
                // your app likely handles this elsewhere; keep as-is if present
                break;
            }

            case "pong": {
                // optional: could update a last-seen timestamp if you want
                break;
            }

            case "error": {
                setLastError((msg as any).message ?? "WS error");
                creatingMyRoomRef.current = false;
                break;
            }

            default:
                break;
        }
    };

    const connectOnce = () => {
        connectWS({
            onOpen: () => setIsConnected(true),
            onMessage: handleMessage,
            onClose: () => {
                setIsConnected(false);

                // Keep last-known rooms/active room for mobile REST fallback.
                // The next "connected" handshake will rehydrate server-truth anyway.
                myRoomIdRef.current = null;
                myRoomCreatedRef.current = false;
                creatingMyRoomRef.current = false;

                hasHandshakeRef.current = false;
            },
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

    // Background/foreground handling (doc-friendly)
    useEffect(() => {
        const sub = AppState.addEventListener("change", (nextState) => {
            if (nextState === "active") {
                if (!isWSConnected()) connectOnce();
            } else {
                // we keep it connected unless you explicitly want to disconnect here
            }
        });

        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sos = () => {
        sendEmergencySOS();
    };

    const setActiveRoomId = (roomId: string) => {
        setActiveRoom(roomId);
        setActiveRoomIdState(roomId);
    };

    const value = useMemo<WSContextValue>(
        () => ({
            isConnected,
            clientId,
            user,
            rooms,
            activeRoomId: activeRoomIdState ?? getActiveRoom(),
            serverTimestamp,
            lastError,
            roomUsers,
            notifications,

            ensureMyRoom,
            sos,
            refreshUsers,

            markNotifRead,
            deleteNotif,
            clearNotifs,

            setActiveRoomId,
        }),
        [
            isConnected,
            clientId,
            user,
            rooms,
            activeRoomIdState,
            serverTimestamp,
            lastError,
            roomUsers,
            notifications,
        ]
    );

    return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}

export function useWS() {
    const ctx = useContext(WSContext);
    if (!ctx) throw new Error("useWS must be used within WSProvider");
    return ctx;
}
