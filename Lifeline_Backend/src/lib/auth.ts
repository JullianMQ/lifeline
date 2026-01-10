import { betterAuth } from "better-auth";
import { createAuthMiddleware, magicLink, openAPI } from "better-auth/plugins";
import { z } from "zod";
import { sendVerifyEmail, sendMagicLinkEmail } from "./email";
import { dbPool } from "./db";

let magicLinkUrl: string;
let magicLinkToken: string;
export const auth = betterAuth({
    appName: "Lifeline",
    database: dbPool,
    baseURL: process.env.NODE_ENV === 'production' ? process.env.HOSTED_BETTER_AUTH_URL : process.env.LOCAL_BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: process.env.ALLOWED_ORIGINS?.split(','),
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        requireEmailVerification: false,
        revokeSessionsOnPasswordReset: true,
        // TODO: ADDING PASSWORD RESET WHEN DOMAIN IS READY
        // sendResetPassword
        // onPasswordReset
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url, token }, request) => {
            // console.log("request", request)
            // console.log("token", token)
            sendVerifyEmail(user.email, url)
                // .then(res => {
                //     console.log(res)
                // })
                .catch(err => {
                    console.log(err)
                })
        }
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
            sameSite: "none", // TODO: Turned into none for use in different domains but only on trusted origins
            partitioned: true
        }
    },
    plugins: [
        openAPI({
            path: "/reference"
        }),
        magicLink({
            expiresIn: 900, // 15 minutes
            storeToken: "plain",
            sendMagicLink: async ({ email, url, token }, ctx) => {
                magicLinkUrl = url
                magicLinkToken = token
                sendMagicLinkEmail(email, url, token).catch(err => {
                    console.error('Error sending magic link email:', err)
                })
            }
        })
    ],
    // hooks: {
    //     after: createAuthMiddleware(async (ctx) => {
    //         if (ctx.path === "/sign-in/magic-link") {
    //             console.log("Path is true")
    //             console.log("ctx.body:", ctx.body)
    //             console.log("ctx.context:", ctx.context)
    //             return ctx.json({
    //                 status: true,
    //                 url: ctx.context.url,
    //                 token: ctx.context.token
    //             })
    //         }
    //     })
    // },
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    const result = await dbPool.query('INSERT INTO contacts (user_id) VALUES ($1) RETURNING id', [user.id]);
                    const contactId = result.rows[0].id;
                    await dbPool.query('UPDATE "user" SET emergency_contact = $1 WHERE id = $2', [contactId, user.id]);
                }
            }
        }
    }
});

export { magicLinkUrl, magicLinkToken }

export type Auth = typeof auth;

export type AuthType = {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
}
