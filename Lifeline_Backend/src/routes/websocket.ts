import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import type { AuthType } from "../lib/auth";

const ws = new Hono<{ Bindings: AuthType }>({
    strict: false
})

ws.get('/ws/message', upgradeWebSocket((c) => {
    return {
        onMessage(e, ws) {
            console.log(`Message from client: ${e.data}`)
            ws.send('Hello bading')
        },
        onClose: () => {
            console.log('Connection closed')
        },
    }
}))

ws.get('/ws/time', upgradeWebSocket((c) => {
    let intervalId: NodeJS.Timeout;
    return {
        onOpen(_event, ws) {
            intervalId = setInterval(() => {
                ws.send(new Date().toString())
            }, 1000)
        },
        onClose() {
            clearInterval(intervalId)
        }
    }
}))

export default ws
