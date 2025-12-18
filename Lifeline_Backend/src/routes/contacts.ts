import { Hono } from "hono";
import { auth } from "../lib/auth";
import { z } from "zod";
import { Pool } from "pg";

type User = NonNullable<typeof auth.$Infer.Session.user>;

const contactSchema = z.object({
    emergency_contact_1: z.string().refine(val => val === "" || /^09\d{9}$/.test(val) || /^\+639\d{9}$/.test(val), "Invalid Philippine phone number or empty to clear").optional(),
    emergency_contact_2: z.string().refine(val => val === "" || /^09\d{9}$/.test(val) || /^\+639\d{9}$/.test(val), "Invalid Philippine phone number or empty to clear").optional(),
    emergency_contact_3: z.string().refine(val => val === "" || /^09\d{9}$/.test(val) || /^\+639\d{9}$/.test(val), "Invalid Philippine phone number or empty to clear").optional(),
    emergency_contact_4: z.string().refine(val => val === "" || /^09\d{9}$/.test(val) || /^\+639\d{9}$/.test(val), "Invalid Philippine phone number or empty to clear").optional(),
    emergency_contact_5: z.string().refine(val => val === "" || /^09\d{9}$/.test(val) || /^\+639\d{9}$/.test(val), "Invalid Philippine phone number or empty to clear").optional(),
});

const router = new Hono<{ Variables: { user: User } }>({
    strict: false,
});

router.use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    console.log(session);
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", session.user);
    return next();
});

router.get("/contacts", async (c) => {
    const user = c.get("user");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const result = await pool.query('SELECT * FROM contacts WHERE user_id = $1', [user.id]);
    await pool.end();
    if (result.rows.length === 0) {
        return c.json({ error: "Contacts not found" }, 404);
    }
    return c.json(result.rows[0]);
});

router.get("/contacts/:phone", async (c) => {
    const phone = c.req.param("phone");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const result = await pool.query('SELECT * FROM "user" WHERE phone_no = $1', [phone]);
    await pool.end();
    if (result.rows.length === 0) {
        return c.json({ error: "Contacts not found" }, 404);
    }
    return c.json(result.rows[0]);
});

const updateContactsHandler = async (c: any) => {
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: "Invalid Philippine phone number. Use 09XXXXXXXXX, +639XXXXXXXXX, or empty string to clear" }, 400);
    }
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    // Check if emergency contacts are registered users
    const contactsToCheck = [
        parsed.data.emergency_contact_1,
        parsed.data.emergency_contact_2,
        parsed.data.emergency_contact_3,
        parsed.data.emergency_contact_4,
        parsed.data.emergency_contact_5,
    ].filter(contact => contact && contact !== "");
    for (const contact of contactsToCheck) {
        if (contact === user.phone_no) {
            await pool.end();
            return c.json({ error: "You cannot add your own phone number as an emergency contact." }, 400);
        }
        const result = await pool.query('SELECT id FROM "user" WHERE phone_no = $1', [contact]);
        if (result.rows.length === 0) {
            await pool.end();
            return c.json({ error: `Emergency contact ${contact} is not a registered user.` }, 400);
        }
    }
    const updateFields = [];
    const values = [];
    let index = 1;
    if (parsed.data.emergency_contact_1 !== undefined) {
        updateFields.push(`emergency_contact_1 = $${index++}`);
        values.push(parsed.data.emergency_contact_1);
    }
    if (parsed.data.emergency_contact_2 !== undefined) {
        updateFields.push(`emergency_contact_2 = $${index++}`);
        values.push(parsed.data.emergency_contact_2);
    }
    if (parsed.data.emergency_contact_3 !== undefined) {
        updateFields.push(`emergency_contact_3 = $${index++}`);
        values.push(parsed.data.emergency_contact_3);
    }
    if (parsed.data.emergency_contact_4 !== undefined) {
        updateFields.push(`emergency_contact_4 = $${index++}`);
        values.push(parsed.data.emergency_contact_4);
    }
    if (parsed.data.emergency_contact_5 !== undefined) {
        updateFields.push(`emergency_contact_5 = $${index++}`);
        values.push(parsed.data.emergency_contact_5);
    }
    if (updateFields.length === 0) {
        await pool.end();
        return c.json({ error: "No fields to update" }, 400);
    }
    values.push(user.id);
    const query = `UPDATE contacts SET ${updateFields.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $${index}`;
    await pool.query(query, values);
    await pool.end();
    return c.json({ success: true });
};

router.post("/contacts", updateContactsHandler);

router.put("/contacts", updateContactsHandler);

router.delete("/contacts", async (c) => {
    const user = c.get("user");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    await pool.query('UPDATE contacts SET emergency_contact_1 = NULL, emergency_contact_2 = NULL, emergency_contact_3 = NULL, emergency_contact_4 = NULL, emergency_contact_5 = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $1', [user.id]);
    await pool.end();
    return c.json({ success: true });
});

router.delete("/contacts/:id", async (c) => {
    const user = c.get("user");
    const id = parseInt(c.req.param("id"));
    if (isNaN(id) || id < 1 || id > 5) {
        return c.json({ error: "Invalid contact ID. Must be 1-5" }, 400);
    }
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const field = `emergency_contact_${id}`;
    await pool.query(`UPDATE contacts SET "${field}" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $1`, [user.id]);
    await pool.end();
    return c.json({ success: true });
});

export default router;
