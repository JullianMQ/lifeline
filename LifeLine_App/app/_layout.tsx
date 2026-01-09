import { Stack } from "expo-router";
import "./globals.css";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import "../tasks/backgroud_sensors";
import { SensorProvider } from "@/context/sensor_context";

GoogleSignin.configure({
  webClientId: "648793210978-a1a9sonc1v4i4n2qi4sbt6pe8cr4bisg.apps.googleusercontent.com",
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