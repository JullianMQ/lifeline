import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { API_BASE_URL } from "./config";
import { saveUser, saveToken, clearUser, clearToken } from "./storage/user";
import * as Linking from "expo-linking";
import { Alert } from "react-native";
import { jwtDecode } from "jwt-decode";


type GoogleSignInCallbacks = {
    callbackURL?: string;
    newUserCallbackURL?: string;
    errorCallbackURL?: string;
};

export async function signInWithGoogle({
    callbackURL = "lifeline://landing",
    newUserCallbackURL = "lifeline://add_phone_num",
    errorCallbackURL = "lifeline://login",
    flow = "signup",
}: GoogleSignInCallbacks & { flow?: "signup" | "login" } = {}) {
    try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        await GoogleSignin.signOut().catch(() => { });

        const userInfo: any = await GoogleSignin.signIn();
        const { idToken } = await GoogleSignin.getTokens();

        if (!idToken) throw new Error("No Google ID token found");

        const decoded: any = jwtDecode(idToken);
        const email = decoded.email;
        console.log("Google email from token:", email);

        // Check if user exists
        let isNewUser = false;
        try {
            const checkData = await checkEmail(email);
            isNewUser = !!checkData.message && checkData.message.includes("available");
        } catch (err: any) {
            if (err.message.includes("already in use")) {
                isNewUser = false;
            } else {
                console.warn("Email check failed, assuming existing user", err);
                isNewUser = false;
            }
        }

        console.log(isNewUser ? "New user" : "Existing user");

        // LOGIN FLOW
        if (flow === "login" && isNewUser) {
            throw new Error("This email is not registered yet. Please sign up first.");
        }

        // SIGNUP FLOW 
        if (flow === "signup" && !isNewUser) {
            Alert.alert(
                "Email Already Exists",
                "This Google account is already registered. Please log in instead."
            );
            return null;
        }


        const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/social`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "google", idToken: { token: idToken } }),
            credentials: "include",
        });

        const data: any = await res.json();
        if (!res.ok) throw new Error(data?.message || "Google login failed");

        if (data.user) await saveUser(data.user);
        const token = data?.token || data?.accessToken || data?.sessionToken;
        if (token) await saveToken(token);
        // Redirect based on flow
        const targetURL =
            flow === "signup"
                ? isNewUser
                    ? newUserCallbackURL
                    : null
                : callbackURL;

        if (targetURL) {
            console.log(`Redirecting to: ${targetURL}`);
            Linking.openURL(targetURL);
        }
        return data;
    } catch (err: any) {
        console.error("signInWithGoogle error:", err);
        Linking.openURL(errorCallbackURL);
        Alert.alert("Google Login Error", err.message || "Failed to log in with Google. Please try again.");
        throw err;
    }
}


// Sign in
export async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: API_BASE_URL },
        credentials: "include",
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to login");


    const token = data?.token || data?.accessToken || data?.sessionToken;
    if (token) await saveToken(token);

    return data;
}

export const loginWithToken = async (token: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/magic-link/verify?token=${token}`, {
        method: "GET",
        credentials: "include",
    });

    if (!res.ok) throw new Error("Magic link verification failed");

    return await res.json();
};


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
    let serverOk = false;

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Origin: API_BASE_URL,
            },
            credentials: "include",
            body: JSON.stringify({}),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.message || "Failed to log out");
        }

        serverOk = true;
        return await res.json();
    } finally {
        // Always clear local auth state so the next login cannot inherit old WS state
        await clearUser().catch(() => { });
        await clearToken().catch(() => { });

        // Optional: also sign out Google session to avoid “sticky” Google accounts
        await GoogleSignin.signOut().catch(() => { });

        // If you want, you can throw if server failed AFTER clearing local state:
        // (but your caller can also handle this)
        if (!serverOk) {
            // no-op here, because we already threw above
        }
    }
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
