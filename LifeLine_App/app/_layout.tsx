import { Stack } from "expo-router";
import "./globals.css";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import "../lib/tasks/background_sensors";
import { SensorProvider } from "@/lib/context/sensor_context";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { saveUser } from "@/lib/api/storage/user";
import { API_BASE_URL } from "@/lib/api/config";
import { Alert } from "react-native";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
  offlineAccess: true,
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      const { path, queryParams } = Linking.parse(url);

      if (path === "landing") {

        if (queryParams?.error) {
          console.warn("Magic link error:", queryParams.error);
          Alert.alert(
            "Magic Link Error",
            "This magic link has expired or is invalid. Please generate a new QR code."
          );
          router.replace("/(auth)/login");
          return;
        }
        const token = queryParams?.token;
        if (token) {
          try {
            const res = await fetch(`${API_BASE_URL}/auth/magic-link/verify?token=${token}`, { method: "POST" });
            if (!res.ok) throw new Error("Token verification failed");
            const data = await res.json();
            await saveUser(data.user);
            router.replace("/(main)/landing");
          } catch (err) {
            console.error("Magic link verification failed", err);
            Alert.alert(
              "Magic Link Error",
              "Failed to verify magic link. Please generate a new QR code."
            );
            router.replace("/(auth)/login");
          }
        } else {
          router.replace("/(auth)/login");
        }
      }
    };


    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

  return (
    <SensorProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
      </Stack>
    </SensorProvider>
  );
}
