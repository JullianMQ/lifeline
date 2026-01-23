import { useState } from "react";
import { authClient } from "./auth-client";

type LoginForm = {
    email: string;
    password: string;
};

export function useLogin() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invalidFields, setInvalidFields] = useState<string[]>([]);

    const login = async ({ email, password }: LoginForm) => {
        setLoading(true);
        setError(null);
        setInvalidFields([]);

        const errors: string[] = [];
        if (!email) errors.push("email");
        if (!password) errors.push("password");

        if (errors.length > 0) {
            setInvalidFields(errors);
            setLoading(false);
            return null;
        }

        const res = await authClient.signIn.email({
            email: email,
            password: password,
            callbackURL: `${window.location.origin}/dashboard`,
        })

        if (res?.data !== null) {
            window.location.href = '/dashboard';
        }

        if (res?.error !== null) {
            console.error("Login failed:", res?.error);
            if (res?.error.code === "INVALID_EMAIL_OR_PASSWORD") {
                setError("Please check your email and password");
            } else {
                setError(res?.error.code || "Failed to connect. Please try again later.");
            }
        }

        setLoading(false);
    };

    return { login, loading, error, invalidFields, setInvalidFields };
}
