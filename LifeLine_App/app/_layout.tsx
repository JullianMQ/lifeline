import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState, type PropsWithChildren } from 'react';
import { isAuthenticated } from './storage/session';
import "./globals.css";

function AuthChecker({ children }: PropsWithChildren) {
  const router = useRouter();
  const segments = useSegments();
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const sessionExists = await isAuthenticated();


      const onboardingScreens = ['(auth)', 'select_role', 'child_info', 'parent_info'];
      const currentSegment = segments[0];

      if (!sessionExists && !onboardingScreens.includes(currentSegment)) {

        router.replace('/(auth)/login');
      } else if (sessionExists && currentSegment === '(auth)' && !onboardingScreens.includes(currentSegment)) {

        router.replace('/landing');
      }

      setIsAppReady(true);
    };

    checkSession();
  }, [segments]);

  if (!isAppReady) return null;

  return <>{children}</>;
}


export default function RootLayout() {
  return (
    <AuthChecker>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="landing" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AuthChecker>
  );
}