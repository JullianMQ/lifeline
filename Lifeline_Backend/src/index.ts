import { Hono } from 'hono'
import { websocket } from 'hono/bun'
import { AuthType } from './lib/auth'
import auth from './routes/auth'
import contacts from './routes/contacts'
import webSocket from './routes/websocket'
import locationRouter from './routes/location'
import mediaRouter from './routes/media'
import { cors } from 'hono/cors'

const app = new Hono<{ Variables: AuthType }>({
    strict: false,
})

app.use(
    cors({
        origin: process.env.ALLOWED_ORIGINS!.split(','),
        allowHeaders: ['Content-Type', 'X-Custom-Header', 'Upgrade-Insecure-Request'],
        allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT'],
        exposeHeaders: ['Content-length', 'X-Kuma-Revision'],
        maxAge: 600,
        credentials: true,
    })
)

const routes = [auth, contacts, webSocket, locationRouter, mediaRouter] as const;

routes.forEach((route) => {
    app.basePath("/api").route("/", route);
});

app.get("/api/auth/google/callback/success", (c) => {
    return c.text("Success");
})

app.get("/api/auth/google/callback/error", (c) => {
    return c.text("Error, logging in please try again");
});

export default {
    fetch: app.fetch,
    port: 3000,
    websocket
}
