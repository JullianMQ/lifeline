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

router.put("/update-user", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const { name, phone_no, role } = await c.req.json();
        const currentUser = session.user;
        console.log('Current user role:', currentUser.role);
        console.log('Requested role change to:', role);
        const updateData: any = {};

        // Update name if provided
        if (name !== undefined) {
            if (typeof name !== "string" || name.trim() === "") {
                return c.json({ error: "Name must be a non-empty string" }, 400);
            }
            updateData.name = name.trim();
        }

        // Update phone number if provided
        if (phone_no !== undefined) {
            const phoneRegex = /^09\d{9}$|^\+639\d{9}$|^$/;
            if (!phoneRegex.test(phone_no)) {
                return c.json({ error: "Phone number must be valid (09XXXXXXXXX or +639XXXXXXXXX) or empty" }, 400);
            }

            // Check if new phone number is already taken by another user
            if (phone_no && phone_no !== currentUser.phone_no) {
                const existingUser = await dbPool.query(
                    'SELECT id FROM "user" WHERE phone_no = $1 AND id != $2',
                    [phone_no, currentUser.id]
                );
                if (existingUser.rows.length > 0) {
                    return c.json({ error: "Phone number already in use" }, 422);
                }
            }
            updateData.phone_no = phone_no || null;
        }

        // Update role if provided
        if (role) {
            if (!["mutual", "dependent"].includes(role)) {
                return c.json({ error: "Role must be either 'mutual' or 'dependent'" }, 400);
            }

            // Only dependents can change their role to protect database integrity
            if (currentUser.role === "mutual") {
                return c.json({ error: "Mutual users cannot change their role to maintain database integrity" }, 403);
            }

            updateData.role = role;
        }

        // If no valid fields to update
        if (Object.keys(updateData).length === 0) {
            return c.json({ error: "No valid fields to update" }, 400);
        }

        // Start transaction for updating user and related contacts
        await dbPool.query('BEGIN');

        try {
            // Update user using better-auth's updateUser method
            await auth.api.updateUser({
                headers: c.req.raw.headers,
                body: updateData
            });

            // If phone number was changed, update contacts where this user is an emergency contact
            if (updateData.phone_no !== undefined && updateData.phone_no !== currentUser.phone_no) {
                // Update all emergency contact fields that reference the old phone number
                const updateContactFields = [
                    'emergency_contact_1',
                    'emergency_contact_2',
                    'emergency_contact_3',
                    'emergency_contact_4',
                    'emergency_contact_5'
                ];

                for (const field of updateContactFields) {
                    await dbPool.query(
                        `UPDATE contacts SET "${field}" = $1 WHERE "${field}" = $2`,
                        [updateData.phone_no || null, currentUser.phone_no]
                    );
                }
            }

            await dbPool.query('COMMIT');

            // Get updated user data directly from database
            const updatedUserResult = await dbPool.query(
                'SELECT id, email, name, role, phone_no, "createdAt", "updatedAt" FROM "user" WHERE id = $1',
                [currentUser.id]
            );

            return c.json({
                success: true,
                user: updatedUserResult.rows[0]
            });
        } catch (error) {
            await dbPool.query('ROLLBACK');
            console.error('Database update error:', error);
            throw error;
        }
    } catch (error: any) {
        console.error('Update user error:', error);
        return c.json({ error: "Failed to update user" }, 500);
    }
});

router.on(["POST", "GET"], "/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

export default router;
