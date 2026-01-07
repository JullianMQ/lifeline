import { authClient } from "./auth-client";
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
                callbackURL: "http://localhost:5173/dashboard",
                newUserCallbackURL: "http://localhost:5173/addContact",
                disableRedirect: false, 
            });
            console.log("Data:", data)
            const res = await fetch("http://localhost:3000/api/auth/get-session", {credentials: "include",});
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