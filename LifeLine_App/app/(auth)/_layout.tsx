import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { checkSession } from "../../lib/api/auth";

export default function AuthLayout() {
    const router = useRouter();

    useEffect(() => {
        checkSession().then(session => {
            if (session) {
                router.replace("/(main)/landing");
            }
        });
    }, []);

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="add_member" />
            <Stack.Screen name="member_signup" />
            <Stack.Screen name="select_role" />
        </Stack>
    );
}
