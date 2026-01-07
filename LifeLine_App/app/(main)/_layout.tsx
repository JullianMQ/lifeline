import { Slot, useRouter } from "expo-router";
import { useEffect } from "react";
import { checkSession } from "../../lib/api/auth";

export default function MainLayout() {
    const router = useRouter();

    useEffect(() => {
        checkSession().then(session => {
            if (!session) {
                router.replace("/(auth)/login");
            }
        });
    }, []);

    return <Slot />;
}
