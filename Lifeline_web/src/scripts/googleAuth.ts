import { authClient } from "./auth-client";
import { API_BASE_URL } from "../config/api";
export function googleAuth() {

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (err: any) {
                console.error("Google login failed:", err.message);
        }
    };

    const signInWithGoogle = async () => {
        try {
            const data = await authClient.signIn.social({
                provider: "google",
                callbackURL: `${window.location.origin}/dashboard`,
                newUserCallbackURL: `${window.location.origin}/addContact`,
                disableRedirect: false, 
            });
            console.log("Data:", data)
            const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {credentials: "include",});
            const session = await res.json();
            
            return session;
        } catch (err: any) {
            console.error("Google login failed:", err.message);
        }
    };
    return {
        handleGoogleLogin,
    };
    
}
