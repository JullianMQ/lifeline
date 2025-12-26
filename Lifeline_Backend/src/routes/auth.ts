import { Hono } from "hono";
import { auth } from "../lib/auth";
import type { AuthType } from "../lib/auth";

const router = new Hono<{ Bindings: AuthType }>({
    strict: false,
});

router.post("/auth/magic-link/qr", async (c) => {
    const reqBody = await c.req.json();
    console.log(reqBody)
    // const res = fetch("http://localhost:3000/api/auth/sign-in/magic-link", {
    //     method: "POST",
    //     body: {
    //         email: ""
    //     }
    // })

    // return c.json({
    //     token: token
    // })
})

router.on(["POST", "GET"], "/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

export default router;
