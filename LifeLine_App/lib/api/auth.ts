import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { API_BASE_URL } from "./config";

export async function signInWithGoogle() {
    try {
        // device has Google Play Services 
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        // sign out previous session to force fresh token
        try {
            await GoogleSignin.signOut();
        } catch (err) {
            console.warn("Google signOut failed, continuing...", err);
        }
        const userInfo = await GoogleSignin.signIn();

        // Get fresh tokens
        const tokens = await GoogleSignin.getTokens();

        if (!tokens.idToken) {
            throw new Error("No Google ID token found");
        }

        console.log("Fresh Google ID Token:", tokens.idToken);

        // Send the ID token to backend
        const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/social`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": API_BASE_URL,
            },
            body: JSON.stringify({
                provider: "google",
                idToken: { token: tokens.idToken },
            }),
            credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Google login failed");
        }

        return data;

    } catch (err: any) {
        console.error("signInWithGoogle error:", err);
        if (err.code === "TOKEN_EXPIRED") {
            throw new Error("Google token expired. Please try logging in again.");
        }
        if (err.code === "INTERNAL_ERROR") {
            throw new Error("Google sign-in failed. Check your device or network.");
        }
        throw new Error(err.message || "Google login failed");
    }
}



// Sign in
export async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Origin": API_BASE_URL,
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),

    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || "Failed to login");
    }

    return data;
}


// Sign up
interface SignUpPayload {
    name: string;
    email: string;
    phone_no: string;
    password: string;
    role?: "mutual" | "dependent";
}
export const signUp = async (payload: SignUpPayload) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Origin: API_BASE_URL,
        },
        body: JSON.stringify(payload),
        credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Signup failed");

    return data;
};

// Logout
export async function logout() {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Origin": API_BASE_URL,

        },
        credentials: "include",
        body: JSON.stringify({}),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to log out");
    }

    return await res.json();
}

// Check if email already exists
export async function checkEmail(email: string) {
    const res = await fetch(`${API_BASE_URL}/api/check/email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Email check failed");
    }

    return data;
}


// Check session
export async function checkSession() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
            method: "GET",
            credentials: "include",
        });

        if (res.status === 401) return null;

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Session check error:", err);
        return null;
    }
}
