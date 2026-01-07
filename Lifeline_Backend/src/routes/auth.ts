import { Hono } from "hono";
import { auth } from "../lib/auth";
import type { AuthType } from "../lib/auth";
import { magicLinkToken, magicLinkUrl } from '../lib/auth'
import { dbPool } from "../lib/db";

const router = new Hono<{ Bindings: AuthType }>({
    strict: false,
});

router.post("/check/email", async (c) => {
    const { email } = await c.req.json();

    if (!email) {
        return c.json({ error: "Email is required" }, 400);
    }

    try {
        const result = await dbPool.query('SELECT id FROM "user" WHERE email = $1 LIMIT 1', [email]);

        if (result.rows.length > 0) {
            return c.json({ error: "Email already in use" }, 422);
        }

        return c.json({ message: "Email is available" }, 200);
    } catch (error) {
        return c.json({ error: "Failed to check email" }, 500);
    }
});

router.post("/check/phone", async (c) => {
    const { phone } = await c.req.json();

    if (!phone) {
        return c.json({ error: "Phone no is required" }, 400);
    }

    try {
        const result = await dbPool.query('SELECT id FROM "user" WHERE phone_no = $1 LIMIT 1', [phone]);

        if (result.rows.length > 0) {
            return c.json({ error: "Phone already in use" }, 422);
        }

        return c.json({ message: "Phone is available" }, 200);
    } catch (error) {
        return c.json({ error: "Failed to check phone" }, 500);
    }
});

// TODO: Change hardcoded url to env variable
router.post("/auth/magic-link/qr", async (c) => {
    const reqBody = await c.req.json();
    await fetch("http://localhost:3000/api/auth/sign-in/magic-link", {
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

router.on(["POST", "GET"], "/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

export default router;
