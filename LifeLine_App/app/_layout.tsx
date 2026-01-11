import { Stack } from "expo-router";
import "./globals.css";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import "../lib/tasks/background_sensors";
import { SensorProvider } from "@/lib/context/sensor_context";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
  offlineAccess: true,
});

export default function RootLayout() {
  return (

    <SensorProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
      </Stack>
    </SensorProvider>
  );
}