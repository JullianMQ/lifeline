import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { Pool } from "pg";

export const auth = betterAuth({
    database: new Pool({
        connectionString: "postgres://lifeline:lifeline@localhost:5432/lifeline?options=-c search_path=auth",
    }),
    trustedOrigins: ['*'], // TODO: CHANGE PATH TO ONLY THE FRONTEND
    emailAndPassword: {
        enabled: true
    },
    plugins: [
        openAPI(),
    ],
});

export type AuthType = {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
}
