let socket: WebSocket | null = null;

const WS_BASE_URL = "ws://192.168.100.185:3000";

export function connectMessageSocket(
    onMessage: (data: string) => void
) {
    socket = new WebSocket(`${WS_BASE_URL}/ws/message`);

    socket.onopen = () => {
        console.log("Message WS connected");
    };

    socket.onmessage = (event) => {
        onMessage(event.data);
    };

    socket.onerror = (e) => {
        console.log("WS error", e);
    };

    socket.onclose = () => {
        console.log("Message WS closed");
    };

    return socket;
}

export function connectTimeSocket(
    onTime: (time: string) => void
) {
    socket = new WebSocket(`${WS_BASE_URL}/ws/time`);

    socket.onopen = () => {
        console.log("Time WS connected");
    };

    socket.onmessage = (event) => {
        onTime(event.data);
    };

    socket.onclose = () => {
        console.log("Time WS closed");
    };

    return socket;
}

export function disconnectSocket() {
    socket?.close();
    socket = null;
}