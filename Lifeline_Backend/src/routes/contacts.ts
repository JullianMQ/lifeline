import { Hono } from "hono";
import { auth } from "../lib/auth";
import { z } from "zod";
import { dbPool } from "../lib/db";

type User = NonNullable<typeof auth.$Infer.Session.user>;

interface ContactResponse {
    id: number;
    user_id: string;
    emergency_contacts: ContactUser[];
    dependent_contacts: ContactUser[];
}

interface ContactUser {
    phone_no: string;
    name: string | null;
    email: string | null;
    role: string | null;
    image: string | null;
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

    const contactRow = result.rows[0];

    // Get emergency contact details
    const emergencyDetails: ContactUser[] = [];
    if (contactRow.emergency_contacts && contactRow.emergency_contacts.length > 0) {
        const emergencyResult = await dbPool.query(`
            SELECT name, email, phone_no, image, role
            FROM "user" 
            WHERE phone_no = ANY($1)
        `, [contactRow.emergency_contacts]);

        // Create mapping for quick lookup
        const userMap: { [key: string]: ContactUser } = {};
        emergencyResult.rows.forEach(row => {
            userMap[row.phone_no] = {
                phone_no: row.phone_no,
                name: row.name,
                email: row.email,
                role: row.role,
                image: row.image
            };
        });

        // Maintain order from the array and include unknown contacts
        contactRow.emergency_contacts.forEach((phone: string) => {
            if (userMap[phone]) {
                emergencyDetails.push(userMap[phone]);
            } else {
                emergencyDetails.push({
                    phone_no: phone,
                    name: null,
                    email: null,
                    role: null,
                    image: null
                });
            }
        });
    }

    // Get dependent contact details
    const dependentDetails: ContactUser[] = [];
    if (contactRow.dependent_contacts && contactRow.dependent_contacts.length > 0) {
        const dependentResult = await dbPool.query(`
            SELECT name, email, phone_no, image, role
            FROM "user" 
            WHERE phone_no = ANY($1)
        `, [contactRow.dependent_contacts]);

        // Create mapping for quick lookup
        const userMap: { [key: string]: ContactUser } = {};
        dependentResult.rows.forEach(row => {
            userMap[row.phone_no] = {
                phone_no: row.phone_no,
                name: row.name,
                email: row.email,
                role: row.role,
                image: row.image
            };
        });

        // Maintain order from the array and include unknown contacts
        contactRow.dependent_contacts.forEach((phone: string) => {
            if (userMap[phone]) {
                dependentDetails.push(userMap[phone]);
            } else {
                dependentDetails.push({
                    phone_no: phone,
                    name: null,
                    email: null,
                    role: null,
                    image: null
                });
            }
        });
    }

    const contact: ContactResponse = {
        id: contactRow.id,
        user_id: contactRow.user_id,
        emergency_contacts: emergencyDetails,
        dependent_contacts: dependentDetails
    };

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



router.post("/contacts", async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: "Invalid Philippine phone numbers in contact arrays" }, 400);
    }

    // Guard: Dependent users cannot add dependent contacts
    if (user.role === "dependent" && parsed.data.dependent_contacts && parsed.data.dependent_contacts.length > 0) {
        return c.json({ error: "Dependent users cannot add dependent contacts." }, 400);
    }

    // Get current contacts first
    const currentContactsResult = await dbPool.query('SELECT emergency_contacts, dependent_contacts FROM contacts WHERE user_id = $1', [user.id]);
    let currentEmergency: string[] = [];
    let currentDependent: string[] = [];

    if (currentContactsResult.rows.length > 0) {
        currentEmergency = currentContactsResult.rows[0].emergency_contacts || [];
        currentDependent = currentContactsResult.rows[0].dependent_contacts || [];
    }

    const updateFields: string[] = [];
    const values: (string[] | string)[] = [];
    let index = 1;
    let newEmergencyContacts: string[] = [];
    let newDependentContacts: string[] = [];

    // Handle emergency contacts (APPEND logic)
    if (parsed.data.emergency_contacts !== undefined) {
        // Remove duplicates and empty strings from new contacts
        const uniqueNewContacts = Array.from(new Set(parsed.data.emergency_contacts.filter(contact => contact.trim() !== "")));

        // Validate each new emergency contact
        for (const contact of uniqueNewContacts) {
            if (contact === user.phone_no) {
                return c.json({ error: "You cannot add your own phone number as an emergency contact." }, 400);
            }
            const result = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contact]);
            if (result.rows.length === 0) {
                return c.json({ error: `Emergency contact ${contact} is not a registered user.` }, 400);
            }

            const contactUser = result.rows[0];

            // Emergency contacts can only be mutual users
            if (contactUser.role !== "mutual") {
                return c.json({ error: `Emergency contact ${contact} must be a mutual user, not ${contactUser.role}.` }, 400);
            }
        }

        // APPEND: Combine existing + new, then remove duplicates
        const combinedEmergency = [...currentEmergency, ...uniqueNewContacts];
        newEmergencyContacts = Array.from(new Set(combinedEmergency));

        updateFields.push(`emergency_contacts = $${index++}`);
        values.push(newEmergencyContacts);
    }

    // Handle dependent contacts (APPEND logic)
    if (parsed.data.dependent_contacts !== undefined) {
        // Remove duplicates and empty strings from new contacts
        const uniqueNewContacts = Array.from(new Set(parsed.data.dependent_contacts.filter(contact => contact.trim() !== "")));

        // Validate each new dependent contact
        for (const contact of uniqueNewContacts) {
            if (contact === user.phone_no) {
                return c.json({ error: "You cannot add your own phone number as a dependent contact." }, 400);
            }
            const result = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contact]);
            if (result.rows.length === 0) {
                return c.json({ error: `Dependent contact ${contact} is not a registered user.` }, 400);
            }

            const contactUser = result.rows[0];

            // Dependent contacts can only be dependent users
            if (contactUser.role !== "dependent") {
                return c.json({ error: `Dependent contact ${contact} must be a dependent user, not ${contactUser.role}.` }, 400);
            }
        }

        // APPEND: Combine existing + new, then remove duplicates
        const combinedDependent = [...currentDependent, ...uniqueNewContacts];
        newDependentContacts = Array.from(new Set(combinedDependent));

        updateFields.push(`dependent_contacts = $${index++}`);
        values.push(newDependentContacts);
    }

    if (updateFields.length === 0) {
        return c.json({ error: "No fields to update" }, 400);
    }

    values.push(user.id);
    const query = `UPDATE contacts SET ${updateFields.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $${index}`;
    await dbPool.query(query, values);

    // Create bidirectional relationships for newly added contacts only
    const newlyAddedEmergency = newEmergencyContacts.filter(contact => !currentEmergency.includes(contact));
    const newlyAddedDependent = newDependentContacts.filter(contact => !currentDependent.includes(contact));

    // Handle emergency contacts (mutual ↔ mutual)
    if (newlyAddedEmergency.length > 0) {
        for (const contactPhone of newlyAddedEmergency) {
            const contactUserResult = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contactPhone]);
            if (contactUserResult.rows.length > 0) {
                const contactUser = contactUserResult.rows[0];
                const contactUserId = contactUser.id;

                if (contactUser.role === "mutual" && user.role === "mutual") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET emergency_contacts = CASE 
                            WHEN emergency_contacts IS NULL THEN ARRAY[$1]
                            WHEN NOT ($1 = ANY(emergency_contacts)) THEN emergency_contacts || $1
                            ELSE emergency_contacts
                        END,
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2
                    `, [user.phone_no, contactUserId]);
                } else if (user.role === "dependent" && contactUser.role === "mutual") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET dependent_contacts = CASE 
                            WHEN dependent_contacts IS NULL THEN ARRAY[$1]
                            WHEN NOT ($1 = ANY(dependent_contacts)) THEN dependent_contacts || $1
                            ELSE dependent_contacts
                        END,
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2
                    `, [user.phone_no, contactUserId]);
                }
            }
        }
    }

    // Handle dependent contacts (mutual → dependent)
    if (newlyAddedDependent.length > 0) {
        for (const contactPhone of newlyAddedDependent) {
            const contactUserResult = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contactPhone]);
            if (contactUserResult.rows.length > 0) {
                const contactUser = contactUserResult.rows[0];
                const contactUserId = contactUser.id;

                if (user.role === "mutual" && contactUser.role === "dependent") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET emergency_contacts = CASE 
                            WHEN emergency_contacts IS NULL THEN ARRAY[$1]
                            WHEN NOT ($1 = ANY(emergency_contacts)) THEN emergency_contacts || $1
                            ELSE emergency_contacts
                        END,
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2
                    `, [user.phone_no, contactUserId]);
                }
            }
        }
    }

    // Check if any new contacts were actually added
    const hasNewContacts = newlyAddedEmergency.length > 0 || newlyAddedDependent.length > 0;

    if (hasNewContacts) {
        return c.json({
            success: true,
            message: "New contacts added successfully",
            added: {
                emergency_contacts: newlyAddedEmergency,
                dependent_contacts: newlyAddedDependent
            }
        });
    } else {
        return c.json({
            success: true,
            message: "No new contacts added (duplicates detected)",
            added: {
                emergency_contacts: [],
                dependent_contacts: []
            }
        });
    }
});

router.put("/contacts", async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: "Invalid Philippine phone numbers in contact arrays" }, 400);
    }

    // Guard: Dependent users cannot add dependent contacts
    if (user.role === "dependent" && parsed.data.dependent_contacts && parsed.data.dependent_contacts.length > 0) {
        return c.json({ error: "Dependent users cannot add dependent contacts." }, 400);
    }

    const updateFields: string[] = [];
    const values: (string[] | string)[] = [];
    let index = 1;
    let uniqueEmergencyContacts: string[] = [];
    let uniqueDependentContacts: string[] = [];

    // Handle emergency contacts (REPLACE logic)
    if (parsed.data.emergency_contacts !== undefined) {
        // Remove duplicates and empty strings
        uniqueEmergencyContacts = Array.from(new Set(parsed.data.emergency_contacts.filter(contact => contact.trim() !== "")));

        // Validate each emergency contact
        for (const contact of uniqueEmergencyContacts) {
            if (contact === user.phone_no) {
                return c.json({ error: "You cannot add your own phone number as an emergency contact." }, 400);
            }
            const result = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contact]);
            if (result.rows.length === 0) {
                return c.json({ error: `Emergency contact ${contact} is not a registered user.` }, 400);
            }

            const contactUser = result.rows[0];

            // Emergency contacts can only be mutual users
            if (contactUser.role !== "mutual") {
                return c.json({ error: `Emergency contact ${contact} must be a mutual user, not ${contactUser.role}.` }, 400);
            }
        }

        updateFields.push(`emergency_contacts = $${index++}`);
        values.push(uniqueEmergencyContacts);
    }

    // Handle dependent contacts (REPLACE logic)
    if (parsed.data.dependent_contacts !== undefined) {
        // Remove duplicates and empty strings
        uniqueDependentContacts = Array.from(new Set(parsed.data.dependent_contacts.filter(contact => contact.trim() !== "")));

        // Validate each dependent contact
        for (const contact of uniqueDependentContacts) {
            if (contact === user.phone_no) {
                return c.json({ error: "You cannot add your own phone number as a dependent contact." }, 400);
            }
            const result = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contact]);
            if (result.rows.length === 0) {
                return c.json({ error: `Dependent contact ${contact} is not a registered user.` }, 400);
            }

            const contactUser = result.rows[0];

            // Dependent contacts can only be dependent users
            if (contactUser.role !== "dependent") {
                return c.json({ error: `Dependent contact ${contact} must be a dependent user, not ${contactUser.role}.` }, 400);
            }
        }

        updateFields.push(`dependent_contacts = $${index++}`);
        values.push(uniqueDependentContacts);
    }

    if (updateFields.length === 0) {
        return c.json({ error: "No fields to update" }, 400);
    }

    // Get current contacts before replacement for bidirectional cleanup
    const currentContactsResult = await dbPool.query('SELECT emergency_contacts, dependent_contacts FROM contacts WHERE user_id = $1', [user.id]);
    let currentEmergency: string[] = [];
    let currentDependent: string[] = [];

    if (currentContactsResult.rows.length > 0) {
        currentEmergency = currentContactsResult.rows[0].emergency_contacts || [];
        currentDependent = currentContactsResult.rows[0].dependent_contacts || [];
    }

    values.push(user.id);
    const query = `UPDATE contacts SET ${updateFields.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $${index}`;
    await dbPool.query(query, values);

    // Handle bidirectional relationships for REPLACE operation
    // Emergency contacts: mutual ↔ mutual
    if (parsed.data.emergency_contacts !== undefined) {
        const contactsToRemove = currentEmergency.filter(contact => !uniqueEmergencyContacts.includes(contact));
        const contactsToAdd = uniqueEmergencyContacts.filter(contact => !currentEmergency.includes(contact));

        // Remove from other users' contacts
        for (const contactPhone of contactsToRemove) {
            const contactUserResult = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contactPhone]);
            if (contactUserResult.rows.length > 0) {
                const contactUser = contactUserResult.rows[0];
                const contactUserId = contactUser.id;

                if (contactUser.role === "mutual" && user.role === "mutual") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET emergency_contacts = array_remove(emergency_contacts, $1),
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2 AND $1 = ANY(emergency_contacts)
                    `, [user.phone_no, contactUserId]);
                } else if (user.role === "dependent" && contactUser.role === "mutual") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET dependent_contacts = array_remove(dependent_contacts, $1),
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2 AND $1 = ANY(dependent_contacts)
                    `, [user.phone_no, contactUserId]);
                }
            }
        }

        // Add to other users' contacts
        for (const contactPhone of contactsToAdd) {
            const contactUserResult = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contactPhone]);
            if (contactUserResult.rows.length > 0) {
                const contactUser = contactUserResult.rows[0];
                const contactUserId = contactUser.id;

                if (contactUser.role === "mutual" && user.role === "mutual") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET emergency_contacts = CASE 
                            WHEN emergency_contacts IS NULL THEN ARRAY[$1]
                            WHEN NOT ($1 = ANY(emergency_contacts)) THEN emergency_contacts || $1
                            ELSE emergency_contacts
                        END,
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2
                    `, [user.phone_no, contactUserId]);
                } else if (user.role === "dependent" && contactUser.role === "mutual") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET dependent_contacts = CASE 
                            WHEN dependent_contacts IS NULL THEN ARRAY[$1]
                            WHEN NOT ($1 = ANY(dependent_contacts)) THEN dependent_contacts || $1
                            ELSE dependent_contacts
                        END,
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2
                    `, [user.phone_no, contactUserId]);
                }
            }
        }
    }

    // Dependent contacts: mutual → dependent
    if (parsed.data.dependent_contacts !== undefined) {
        const contactsToRemove = currentDependent.filter(contact => !uniqueDependentContacts.includes(contact));
        const contactsToAdd = uniqueDependentContacts.filter(contact => !currentDependent.includes(contact));

        // Remove from other users' contacts
        for (const contactPhone of contactsToRemove) {
            const contactUserResult = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contactPhone]);
            if (contactUserResult.rows.length > 0) {
                const contactUser = contactUserResult.rows[0];
                const contactUserId = contactUser.id;

                if (user.role === "mutual" && contactUser.role === "dependent") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET emergency_contacts = array_remove(emergency_contacts, $1),
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2 AND $1 = ANY(emergency_contacts)
                    `, [user.phone_no, contactUserId]);
                }
            }
        }

        // Add to other users' contacts
        for (const contactPhone of contactsToAdd) {
            const contactUserResult = await dbPool.query('SELECT id, role FROM "user" WHERE phone_no = $1', [contactPhone]);
            if (contactUserResult.rows.length > 0) {
                const contactUser = contactUserResult.rows[0];
                const contactUserId = contactUser.id;

                if (user.role === "mutual" && contactUser.role === "dependent") {
                    await dbPool.query(`
                        UPDATE contacts 
                        SET emergency_contacts = CASE 
                            WHEN emergency_contacts IS NULL THEN ARRAY[$1]
                            WHEN NOT ($1 = ANY(emergency_contacts)) THEN emergency_contacts || $1
                            ELSE emergency_contacts
                        END,
                        "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2
                    `, [user.phone_no, contactUserId]);
                }
            }
        }
    }

    return c.json({
        success: true,
        message: "Contacts replaced successfully",
        contacts: {
            emergency_contacts: uniqueEmergencyContacts,
            dependent_contacts: uniqueDependentContacts
        }
    });
});

router.delete("/contacts", async (c) => {
    const user = c.get("user");

    // Start transaction for bidirectional contact clearing
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');

        // Get current contacts before clearing
        const currentContactsResult = await client.query(`
            SELECT emergency_contacts, dependent_contacts 
            FROM contacts 
            WHERE user_id = $1
        `, [user.id]);

        if (currentContactsResult.rows.length > 0) {
            const currentContacts = currentContactsResult.rows[0];
            const allContacts = [
                ...(currentContacts.emergency_contacts || []),
                ...(currentContacts.dependent_contacts || [])
            ];

            // Remove current user from all contacts' emergency lists
            for (const contactPhone of allContacts) {
                const contactUserResult = await client.query('SELECT id FROM "user" WHERE phone_no = $1', [contactPhone]);
                if (contactUserResult.rows.length > 0) {
                    const contactUserId = contactUserResult.rows[0].id;
                    await client.query(`
                        UPDATE contacts 
                        SET emergency_contacts = array_remove(emergency_contacts, $1),
                            "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE user_id = $2
                    `, [user.phone_no, contactUserId]);
                }
            }
        }

        // Clear current user's contacts
        await client.query('UPDATE contacts SET emergency_contacts = NULL, dependent_contacts = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $1', [user.id]);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

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

    // Start transaction for bidirectional contact removal
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');

        // Get current contacts array
        const result = await client.query(`SELECT ${fieldName} FROM contacts WHERE user_id = $1`, [user.id]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return c.json({ error: "Contacts not found" }, 404);
        }

        const contacts: string[] = (result.rows[0][fieldName] as string[]) || [];
        if (index >= contacts.length) {
            await client.query('ROLLBACK');
            return c.json({ error: "Contact index out of bounds" }, 400);
        }

        // Get the phone number being removed
        const removedPhone = contacts[index];

        // Remove contact at specified index from current user
        const updatedContacts = [...contacts];
        updatedContacts.splice(index, 1);

        await client.query(`UPDATE contacts SET ${fieldName} = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE user_id = $2`, [updatedContacts, user.id]);

        // Remove current user from the removed contact's emergency contacts (bidirectional removal)
        if (type === "emergency" || type === "dependent") {
            // Get the removed contact's user ID
            const contactUserResult = await client.query('SELECT id FROM "user" WHERE phone_no = $1', [removedPhone]);
            if (contactUserResult.rows.length > 0) {
                const contactUserId = contactUserResult.rows[0].id;

                // Remove current user from contact's emergency contacts array
                await client.query(`
                    UPDATE contacts 
                    SET emergency_contacts = array_remove(emergency_contacts, $1),
                        "updatedAt" = CURRENT_TIMESTAMP 
                    WHERE user_id = $2
                `, [user.phone_no, contactUserId]);
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return c.json({ success: true });
});

export default router;
