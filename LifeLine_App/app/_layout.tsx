import { Stack } from "expo-router";
import React, { useEffect, useState, type PropsWithChildren } from "react";
import { isAuthenticated } from "../lib/api/storage/session";
import "./globals.css";

function AuthChecker({ children }: PropsWithChildren) {
  const [isAppReady, setIsAppReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const sessionExists = await isAuthenticated();
      setLoggedIn(sessionExists);
      setIsAppReady(true);
    };
    checkSession();
  }, []);

  if (!isAppReady) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const logged = await isAuthenticated();
      setIsLoggedIn(logged);
    };
    checkSession();
  }, []);

  if (isLoggedIn === null) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        // User is logged in → show landing first
        <Stack.Screen name="landing" />
      ) : (
        // User not logged in → show login first
        <Stack.Screen name="(auth)/login" />
      )}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
