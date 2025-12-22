import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { AuthType } from './lib/auth'
import { auth as authInstance } from './lib/auth'
import auth from './routes/auth'
import contacts from './routes/contacts'
import webSocket from './routes/websocket'

const app = new Hono<{ Variables: AuthType }>({
    strict: false,
})

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
