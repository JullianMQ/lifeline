import { useState } from "react";

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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });


      const data = await res.json();

      if (!res.ok) {
        setError(
          data.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "Please check your email and password"
            : data.message || "Login failed"
        );
        return null;
      }

      return data; 
    } catch (err: any) {
      setError(err.message || "Login failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error, invalidFields, setInvalidFields };
}
