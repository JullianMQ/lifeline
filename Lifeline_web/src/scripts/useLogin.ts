import { useState } from "react";
import { authClient } from "./auth-client";
import Login from "../pages/login";

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

    try {
      const data = await authClient.signIn.email({
        email: email,
        password: password,
        callbackURL: "/dashboard",
      });
    } catch (err: any) {
      if (err.code === "INVALID_EMAIL_OR_PASSWORD") {
        setError("Please check your email and password");
      } else {
        setError(err.message || "Failed to connect. Please try again later.");
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error, invalidFields, setInvalidFields };
}
