let timeSocket: WebSocket | null = null;
let messageSocket: WebSocket | null = null;

const WS_BASE_URL = "ws://192.168.100.185:3000";

export function connectTimeSocket(onTime: (time: string) => void) {
    if (timeSocket) return timeSocket;

    timeSocket = new WebSocket(`${WS_BASE_URL}/api/ws/time`);

    timeSocket.onopen = () => console.log("Time WS connected");
    timeSocket.onmessage = (e) => onTime(e.data);
    timeSocket.onerror = (e) => console.log("Time WS error", e);
    timeSocket.onclose = () => {
        console.log("Time WS closed");
        timeSocket = null;
    };

    return timeSocket;
};

export function disconnectTimeSocket() {
    timeSocket?.close();
    timeSocket = null;
}

export function connectMessageSocket(onMessage: (data: string) => void) {
    if (messageSocket) return messageSocket;

    messageSocket = new WebSocket(`${WS_BASE_URL}/api/ws/message`);

    messageSocket.onopen = () => console.log("Message WS connected");
    messageSocket.onmessage = (e) => onMessage(e.data);
    messageSocket.onerror = (e) => console.log("Message WS error", e);
    messageSocket.onclose = () => {
        console.log("Message WS closed");
        messageSocket = null;
    };

    return messageSocket;
};

export function disconnectMessageSocket() {
    messageSocket?.close();
    messageSocket = null;
}

export function disconnectAllSockets() {
    disconnectTimeSocket();
    disconnectMessageSocket();
}
