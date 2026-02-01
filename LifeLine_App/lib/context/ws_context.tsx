// lib/context/ws_context.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */

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

    // We only treat the server room list as truth after we receive "connected".
    const hasHandshakeRef = useRef(false);

    // de-dupe notifications
    const seenNotifRef = useRef<Set<string>>(new Set());

    function syncRooms() {
        const r = getJoinedRooms();
        setRooms(r);

        const active = activeRoomIdState ?? getActiveRoom();
        if (!active && r.length) {
            setActiveRoom(r[0]);
            setActiveRoomIdState(r[0]);
        }
    }

    const addNotif = (n: Omit<AppNotification, "id" | "read">) => {
        const signature = `${n.type}|${n.timestamp}|${n.roomId ?? ""}|${n.message}`;
        if (seenNotifRef.current.has(signature)) return;
        seenNotifRef.current.add(signature);

        setNotifications((prev) => [
            { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, read: false, ...n },
            ...prev,
        ]);
    };

    const markNotifRead = (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const deleteNotif = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const clearNotifs = () => {
        setNotifications([]);
        seenNotifRef.current.clear();
    };

    const ensureMyRoomInternal = async () => {
        // Spec: roomIds in the "connected" handshake is server-truth.
        // Do NOT create a room until we have received that handshake.
        if (!hasHandshakeRef.current) return;

        // Doc: only create a room when we truly have none.
        // Let the server generate the roomId to avoid "Room already exists".
        if (getJoinedRooms().length > 0) return;
        if (creatingMyRoomRef.current) return;

        creatingMyRoomRef.current = true;
        try {
            await createRoom();
        } finally {
            // keep "creating" true until server confirms via "room-created"
        }
    };

    const handleMessage = (msg: ServerMessage) => {
        if ("timestamp" in msg) setServerTimestamp((msg as any).timestamp);

        switch (msg.type) {
            case "connected": {
                setClientId((msg as any).clientId);
                setUser((msg as any).user);
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
                const myId = user?.id ?? clientId ?? null;
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
            }
        });

        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- actions ----

    const setActiveRoomId = (roomId: string) => {
        setActiveRoom(roomId);
        setActiveRoomIdState(roomId);
    };

    const ensureMyRoom = () => {
        ensureMyRoomInternal();
    };

    const sos = () => sendEmergencySOS();

    const refreshUsers = (roomId?: string) => {
        const rid = roomId ?? activeRoomIdState ?? getActiveRoom();
        if (!rid) {
            setLastError("No active room selected.");
            return;
        }
        getRoomUsers(rid);
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
    if (!ctx) throw new Error("useWS must be used inside WSProvider");
    return ctx;
}
