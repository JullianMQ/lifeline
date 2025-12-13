import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { Pool } from "pg";
import { openAPI } from "better-auth/plugins";
import { z } from "zod";

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
    trustedOrigins: ["*"],
    emailAndPassword: {
        enabled: true
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                validator: {
                    input: z.enum(["mutual", "dependent"]),
                },
            },
            phone_no: {
                type: "string",
                required: true,
            },
            emergency_contact: {
                type: "number",
                required: false,
            }
        }
    },
    plugins: [
        openAPI()
    ],
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path.startsWith("/sign-up")) {
                const newSession = ctx.context.newSession;
                if (newSession) {
                    const pool = new Pool({
                        connectionString: process.env.DATABASE_URL,
                    });
                    const result = await pool.query('INSERT INTO contacts (user_id) VALUES ($1) RETURNING id', [newSession.user.id]);
                    const contactId = result.rows[0].id;
                    await pool.query('UPDATE "user" SET emergency_contact = $1 WHERE id = $2', [contactId, newSession.user.id]);
                    await pool.end();
                }
            }
        })
    }
});

export type AuthType = {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
}
