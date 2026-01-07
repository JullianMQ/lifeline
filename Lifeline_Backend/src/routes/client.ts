// client.ts
import { hc } from 'hono/client'
import type app from './websocket'

const client = hc<typeof app>('http://localhost:8787')
const ws = client.ws.$ws(0)

ws.addEventListener('open', () => {
    setInterval(() => {
        ws.send(new Date().toString())
    }, 1000)
})
