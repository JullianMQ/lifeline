import { Hono } from "hono";
import { auth } from "../lib/auth";
import { z } from "zod";
import { dbPool } from "../lib/db";

type User = NonNullable<typeof auth.$Infer.Session.user>;

interface ContactResponse {
    id: number;
    user_id: string;
    emergency_contacts: string[] | null;
    dependent_contacts: string[] | null;
}

const phoneValidation = z.string().refine(val => /^09\d{9}$/.test(val) || /^\+639\d{9}$/.test(val), "Invalid Philippine phone number");

const contactSchema = z.object({
    emergency_contacts: z.array(phoneValidation).optional(),
    dependent_contacts: z.array(phoneValidation).optional(),
});

const router = new Hono<{ Variables: { user: User } }>({
    strict: false,
});

router.use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    // console.log(session);
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", session.user);
    return next();
});

router.get("/contacts/users", async (c) => {
    const user = c.get("user");
    const result = await dbPool.query(`
        SELECT 
            c.id, c.user_id, c.emergency_contacts, c.dependent_contacts
        FROM contacts c
        WHERE c.user_id = $1
    `, [user.id]);
    if (result.rows.length === 0) {
        return c.json({ error: "Contacts not found" }, 404);
    }

    const contact: ContactResponse = result.rows[0];

    return c.json(contact);
});

router.get("/contacts", async (c) => {
    const user = c.get("user");
    const result = await dbPool.query('SELECT * FROM contacts WHERE user_id = $1', [user.id]);
    if (result.rows.length === 0) {
        return c.json({ error: "Contacts not found" }, 404);
    }
    return c.json(result.rows[0]);
});

router.get("/contacts/:phone", async (c) => {
    const phone = c.req.param("phone");
    const result = await dbPool.query('SELECT * FROM "user" WHERE phone_no = $1', [phone]);
    if (result.rows.length === 0) {
        return c.json({ error: "Contacts not found" }, 404);
    }
    return c.json(result.rows[0]);
});

const updateContactsHandler = async (c: any): Promise<Response> => {
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: "Invalid Philippine phone numbers in contact arrays" }, 400);
    }

    const updateFields: string[] = [];
    const values: (string[] | string)[] = [];
    let index = 1;

    // Handle emergency contacts validation
    if (parsed.data.emergency_contacts !== undefined) {
        // Remove duplicates and empty strings
        const uniqueEmergencyContacts = Array.from(new Set(parsed.data.emergency_contacts.filter(contact => contact.trim() !== "")));

        // Validate each emergency contact
        for (const contact of uniqueEmergencyContacts) {
            if (contact === user.phone_no) {
                return c.json({ error: "You cannot add your own phone number as an emergency contact." }, 400);
            }
            const result = await dbPool.query('SELECT id FROM "user" WHERE phone_no = $1 AND role = $2', [contact, "mutual"]);
            if (result.rows.length === 0) {
                return c.json({ error: `Emergency contact ${contact} is not a registered user or is a dependent user.` }, 400);
            }
        }

        updateFields.push(`emergency_contacts = $${index++}`);
        values.push(uniqueEmergencyContacts);
    }

    // Handle dependent contacts validation
    if (parsed.data.dependent_contacts !== undefined) {
        // Remove duplicates and empty strings
        const uniqueDependentContacts = Array.from(new Set(parsed.data.dependent_contacts.filter(contact => contact.trim() !== "")));

        // Validate each dependent contact
        for (const contact of uniqueDependentContacts) {
            if (contact === user.phone_no) {
                return c.json({ error: "You cannot add your own phone number as a dependent contact." }, 400);
            }
            const result = await dbPool.query('SELECT id FROM "user" WHERE phone_no = $1 AND role = $2', [contact, "dependent"]);
            if (result.rows.length === 0) {
                return c.json({ error: `Dependent contact ${contact} is not a registered user or is a mutual user.` }, 400);
            }
        }

        updateFields.push(`dependent_contacts = $${index++}`);
        values.push(uniqueDependentContacts);
    }

    if (updateFields.length === 0) {
        return c.json({ error: "No fields to update" }, 400);
    }

    values.push(user.id);
    const query = `UPDATE contacts SET ${updateFields.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $${index}`;
    await dbPool.query(query, values);
    return c.json({ success: true });
};

router.post("/contacts", updateContactsHandler);

router.put("/contacts", updateContactsHandler);

router.delete("/contacts", async (c) => {
    const user = c.get("user");
    await dbPool.query('UPDATE contacts SET emergency_contacts = NULL, dependent_contacts = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $1', [user.id]);
    return c.json({ success: true });
});

router.delete("/contacts/:type/:index", async (c) => {
    const user = c.get("user");
    const type = c.req.param("type");
    const index = parseInt(c.req.param("index"));

    if (!["emergency", "dependent"].includes(type)) {
        return c.json({ error: "Invalid contact type. Must be 'emergency' or 'dependent'" }, 400);
    }

    if (isNaN(index) || index < 0) {
        return c.json({ error: "Invalid contact index. Must be 0 or greater" }, 400);
    }

    const fieldName = type === "emergency" ? "emergency_contacts" : "dependent_contacts";

    // Get current contacts array
    const result = await dbPool.query(`SELECT ${fieldName} FROM contacts WHERE user_id = $1`, [user.id]);
    if (result.rows.length === 0) {
        return c.json({ error: "Contacts not found" }, 404);
    }

    const contacts: string[] = (result.rows[0][fieldName] as string[]) || [];
    if (index >= contacts.length) {
        return c.json({ error: "Contact index out of bounds" }, 400);
    }

    // Remove contact at specified index
    const updatedContacts = [...contacts];
    updatedContacts.splice(index, 1);

    await dbPool.query(`UPDATE contacts SET ${fieldName} = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $2`, [updatedContacts, user.id]);
    return c.json({ success: true });
});

export default router;
