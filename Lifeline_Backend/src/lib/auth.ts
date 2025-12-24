import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { openAPI } from "better-auth/plugins";
import { z } from "zod";

export const auth = betterAuth({
    appName: "Lifeline",
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: ["http://localhost:*", "https://*"],
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        requireEmailVerification: false,
        revokeSessionsOnPasswordReset: true,
        // TODO: ADDING PASSWORD RESET WHEN DOMAIN IS READY
        // sendResetPassword
        // onPasswordReset
    },
    socialProviders: {
        google: {
            prompt: "select_account",
            clientId: process.env.GOOGLE_CLIENT_ID! as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
        },
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "mutual",
                validator: {
                    input: z.enum(["mutual", "dependent"]),
                },
                input: true
            },
            phone_no: {
                type: "string",
                required: false,
                validator: {
                    input: z.string().refine(val => val === "" || /^09\d{9}$/.test(val) || /^\+639\d{9}$/.test(val), "Phone number must be valid (09XXXXXXXXX or +639XXXXXXXXX)")
                },
                input: true,
                unique: true
            },
            emergency_contact: {
                type: "number",
                required: false,
                input: false
            }
        }
    },
    session: {
        cookieCache: {
            enabled: true,
            strategy: "jwe",
        }
    },
    account: {
        storeAccountCookie: true,
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "facebook"],
            allowDifferentEmails: false
        }
    },
    advanced: {
        ipAddress: {
            ipAddressHeaders: ["x-forwarded-for", "cf-connecting-ip", "x-real-ip"],
            disableIpTracking: false
        },
        defaultCookieAttributes: {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        }
    },
    plugins: [
        openAPI()
    ],
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    const pool = new Pool({
                        connectionString: process.env.DATABASE_URL,
                    });
                    const result = await pool.query('INSERT INTO contacts (user_id) VALUES ($1) RETURNING id', [user.id]);
                    const contactId = result.rows[0].id;
                    await pool.query('UPDATE "user" SET emergency_contact = $1 WHERE id = $2', [contactId, user.id]);
                    await pool.end();
                }
            }
        }
    }
});

export type Auth = typeof auth;

export type AuthType = {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
}
