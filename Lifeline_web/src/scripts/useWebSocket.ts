let timeWS: WebSocket | null = null;
let msgWS: WebSocket | null = null;

const development = import.meta.env.VITE_LOCAL_BETTER_AUTH_URL!.replace('http://', 'ws://');
const production = import.meta.env.VITE_HOSTED_BETTER_AUTH_URL!.replace('https://', 'wss://');

const WS_BASE_URL = import.meta.env.VITE_NODE_ENV === "production" ? production : development;

export function connectTime(onTime: (time: string) => void) {
    if (timeWS) return timeWS;

    timeWS = new WebSocket(`${WS_BASE_URL}/time`);
    timeWS.onopen = () => console.log("Time WS connected");
    timeWS.onmessage = (event) => onTime(event.data);
    timeWS.onerror = (err) => console.error("Time WS error:", err);
    timeWS.onclose = () => {
        console.log("Time WS disconnected");
        timeWS = null;
    };
    return timeWS;
};

export function connectMessage(onMessage: (data: string) => void){
    if (msgWS) return msgWS;

    msgWS = new WebSocket(`${WS_BASE_URL}/message`);
    msgWS.onmessage = (event) => onMessage(event.data);
    msgWS.onopen = () => console.log("Message WS connected");
    msgWS.onerror = (err) => console.error("Message WS error:", err);
    msgWS.onclose = () => {
        console.log("Message WS disconnected");
        msgWS = null;
    }
    return msgWS;
};

export function connectWS(onMessage: (data: string) => void) {
    const ws = new WebSocket(`${WS_BASE_URL}/ws`)
}

export function disconnectTWS() {
    timeWS?.close();
    timeWS = null;
}

export function disconnectMWS() {
    msgWS?.close();
    msgWS = null;
}

export function disconnectAllSockets() {
    disconnectTWS();
    disconnectMWS();
}
