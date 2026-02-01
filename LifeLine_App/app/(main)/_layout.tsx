import { Slot, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { checkSession } from "../../lib/api/auth";
import { WSProvider } from "@/lib/context/ws_context";

export default function MainLayout() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const session = await checkSession();
                if (cancelled) return;

                if (!session) {
                    setIsAuthed(false);
                    router.replace("/(auth)/login");
                } else {
                    setIsAuthed(true);
                }
            } finally {
                if (!cancelled) setChecking(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // While we’re checking auth, don’t render Slot or WSProvider yet
    if (checking) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // If not authed, we already redirected; render nothing
    if (!isAuthed) return null;

    // ✅ Authenticated: mount WSProvider once for the entire (main) stack
    return (
        <WSProvider>
            <Slot />
        </WSProvider>
    );
}
