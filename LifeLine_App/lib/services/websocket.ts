let socket: WebSocket | null = null;

const WS_BASE_URL = "wss://api.lifeline-help.me/api/ws"
// const WS_BASE_URL = "ws://192.168.100.185:3000/api/ws";

export type WSMessage =
    | { type: "connected"; roomId: string; user: any }
    | { type: "user_joined"; user: any }
    | { type: "user_left"; clientId: string }
    | { type: "chat"; message: string; user: any; timestamp: string }
    | { type: "direct_message"; message: string; fromUser: any }
    | { type: "room_users"; users: any[] }
    | { type: "pong" }
    | { type: "error"; message: string };

export function connectRoomSocket(
    roomId: string,
    onMessage: (data: WSMessage) => void
) {
    if (socket) return socket;
    socket = new WebSocket(`${WS_BASE_URL}/${roomId}`);
    socket.onopen = () => {
        console.log("WS connected to room:", roomId);
    };

    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            onMessage(data);
        } catch (err) {
            console.warn("Non-JSON WS message:", e.data);
        }
    };

    socket.onerror = (e) => {
        console.log("WS error", e);
    };

    socket.onclose = () => {
        console.log("WS closed");
        socket = null;
    };

    return socket;
}

export function disconnectRoomSocket() {
    socket?.close();
    socket = null;
}

export function sendChatMessage(message: string) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("Cannot send message: socket not ready");
        return;
    }

    socket.send(
        JSON.stringify({
            type: "chat",
            message,
        })
    );
}

export function sendPing() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("Cannot send ping: socket not ready");
        return;
    }
    socket.send(
        JSON.stringify({
            type: "ping",
        })
    );
}
