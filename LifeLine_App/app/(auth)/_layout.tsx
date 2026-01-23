import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { checkSession } from "../../lib/api/auth";
import { useSegments } from "expo-router";

export default function AuthLayout() {
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        checkSession().then((session) => {
            const currentPage = segments[1];

            if (session && (currentPage === "login" || currentPage === "signup")) {
                router.replace("/(main)/landing");
            }
        });
    }, [segments]);

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="add_member" />
            <Stack.Screen name="member_signup" />
            <Stack.Screen name="select_role" />
            <Stack.Screen name="add_member_existing" />
            <Stack.Screen name="add_phone_num" />
        </Stack>
    );
}
