import { Hono } from 'hono'
import { websocket } from 'hono/bun'
import { AuthType } from './lib/auth'
import auth from './routes/auth'
import contacts from './routes/contacts'
import webSocket from './routes/websocket'
import { magicLinkToken, magicLinkUrl } from './lib/auth'
import { cors } from 'hono/cors'

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

app.post("/api/check/email", async (c) => {
    const { email } = await c.req.json();

    if (!email) {
        return c.json({ error: "Email is required" }, 400);
    }

    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });

        const result = await pool.query('SELECT id FROM "user" WHERE email = $1 LIMIT 1', [email]);
        await pool.end();

        if (result.rows.length > 0) {
            return c.json({ error: "Email already in use" }, 422);
        }

        return c.json({ message: "Email is available" }, 200);
    } catch (error) {
        return c.json({ error: "Failed to check email" }, 500);
    }
});

app.post("/api/auth/magic-link/qr", async (c) => {
    const reqBody = await c.req.json();
    const res = await fetch("http://localhost:3000/api/auth/sign-in/magic-link", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
            email: reqBody.email,
            "name": reqBody.name || "",
            "callbackURL": reqBody.callbackURL || "http://localhost:3000",
            "newUserCallbackURL": reqBody.newUserCallbackURL || "",
            "errorCallbackURL": reqBody.errorCallbackURL || "",
        })
    })

    return c.json({
        url: magicLinkUrl,
        token: magicLinkToken
    })
})

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
    websocket
}
