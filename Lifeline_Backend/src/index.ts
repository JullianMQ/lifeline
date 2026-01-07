import { Hono } from 'hono'
import { websocket } from 'hono/bun'
import { AuthType } from './lib/auth'
import auth from './routes/auth'
import contacts from './routes/contacts'
import webSocket from './routes/websocket'
import { magicLinkToken, magicLinkUrl } from './lib/auth'
import { cors } from 'hono/cors'
import { dbPool } from './lib/db'

const app = new Hono<{ Variables: AuthType }>({
    strict: false,
})

app.use( 
    cors({
        origin:['http://localhost:*', 'http://localhost:5173' ],
        allowHeaders: ['Content-Type','X-Custom-Header', 'Upgrade-Insecure-Request'],
        allowMethods: ['POST', 'GET', 'OPTIONS'],
        exposeHeaders: ['Content-length', 'X-Kuma-Revision'],
        maxAge: 600,
        credentials: true,
    })
)

const routes = [auth, contacts, webSocket] as const;

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
