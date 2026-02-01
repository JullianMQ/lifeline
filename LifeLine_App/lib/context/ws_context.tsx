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

    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    // create-my-room is a one-shot per connection
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

        // IMPORTANT: Create first.
        // If backend replies "room already exists", you can then join (optional).
        // But most backends auto-join the creator on "room-created".
        try {
            await createRoom(myRoomId);
        } finally {
            // keep "creating" true until server confirms via "room-created" or "join-approved"
            // We'll clear it in handleMessage.
        }
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

                myRoomIdRef.current = `user:${(msg as any).clientId}`;

                syncRooms();

                // ensure I have an owned room so SOS works for this user
                ensureMyRoomInternal();
                break;
            }

            // room success signals
            case "room-created":
            case "join-approved": {
                if ((msg as any).roomId && (msg as any).roomId === myRoomIdRef.current) {
                    myRoomCreatedRef.current = true;
                    creatingMyRoomRef.current = false;
                }
                syncRooms();
                break;
            }

            case "auto-joined":
            case "auto-join-summary": {
                syncRooms();
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

    const connectOnce = () => {
        connectWS({
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

    // Optional: background/foreground handling (do NOT disconnect on "inactive" which happens during navigation)
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