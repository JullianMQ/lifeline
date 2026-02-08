import { Slot, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { checkSession } from "../../lib/api/auth";
import { getToken } from "@/lib/api/storage/user";
import { WSProvider } from "@/lib/context/ws_context";
import { SosMediaProvider } from "@/lib/services/sos_media_provider"; // <-- adjust path if needed

export default function MainLayout() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const session = await checkSession();
                if (cancelled) return;

                if (!session) {
                    setIsAuthed(false);
                    setToken(null);
                    router.replace("/(auth)/login");
                    return;
                }

                setIsAuthed(true);

                // For mobile WS auth we pass the stored token (Authorization: Bearer <token>)
                const t = await getToken().catch(() => null);
                if (!cancelled) setToken(t ?? null);
            } finally {
                if (!cancelled) setChecking(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router]);

    if (checking) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!isAuthed) return null;

    return (
        <SosMediaProvider>
            <WSProvider authToken={token}>
                <Slot />
            </WSProvider>
        </SosMediaProvider>
    );
}
