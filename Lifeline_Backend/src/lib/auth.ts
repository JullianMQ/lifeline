import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { openAPI } from "better-auth/plugins";

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
            },
            phone_no: {
                type: "string",
                required: true,
            }
        }
    },
    plugins: [
        openAPI()
    ]
});

export type AuthType = {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
}
