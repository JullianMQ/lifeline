import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { checkSession } from "../lib/api/auth";
import "./globals.css";

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const checkAuth = async () => {
    const session = await checkSession();
    setIsLoggedIn(!!session);
  };

  useEffect(() => {
    checkAuth();
  }, []);


  useEffect(() => {
    const interval = setInterval(async () => {
      const session = await checkSession();
      if (!!session !== isLoggedIn) setIsLoggedIn(!!session);
    }, 10000); // check every 5s

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  if (isLoggedIn === null) return null;

  return (
    <Stack
      screenOptions={{ headerShown: false }}
      key={isLoggedIn ? "logged-in" : "logged-out"}
    >
      {isLoggedIn ? (
        <Stack.Screen name="(main)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
