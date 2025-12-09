import { API_BASE_URL } from "./config";

export async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Origin": API_BASE_URL,
        },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to login");
    }

    return await res.json();
}


// sign out
export async function logout() {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Origin": API_BASE_URL,
        },
        body: JSON.stringify({}),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to log out");
    }

    return await res.json();
}