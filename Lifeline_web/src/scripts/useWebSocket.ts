let timeWS: WebSocket | null = null;
let msgWS: WebSocket | null = null;

const WS_BASE_URL = "ws://localhost:3000/api/ws";

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


