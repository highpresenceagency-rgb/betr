import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../lib/theme';
import DeviceFrame from '../components/DeviceFrame';
import { exitGuestMode, isGuest, loadGuestMode } from '../lib/guest';
import { supabase } from '../lib/supabase';

function RootNav() {
  const { colors } = useTheme();

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;

    (async () => {
      // Load the persisted guest flag before we decide where to route.
      await loadGuestMode();

      const res = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') {
          if (session) {
            // A real session always wins over a stale guest flag.
            if (isGuest()) exitGuestMode();
            router.replace('/(home)/');
          } else if (isGuest()) {
            router.replace('/(home)/');
          }
        } else if (event === 'SIGNED_IN') {
          // Signing in supersedes guest mode.
          if (isGuest()) exitGuestMode();
          router.replace('/(home)/');
        } else if (event === 'SIGNED_OUT') {
          router.replace('/');
        }
      });
      subscription = res.data.subscription;
    })();

    return () => subscription?.unsubscribe();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(home)" />
      <Stack.Screen
        name="check-in"
        options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.bg } }}
      />
      <Stack.Screen
        name="proof"
        options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.bg } }}
      />
      <Stack.Screen name="deposit-success" />
      <Stack.Screen name="deposit-cancel" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <DeviceFrame>
        <SafeAreaProvider>
          <RootNav />
        </SafeAreaProvider>
      </DeviceFrame>
    </ThemeProvider>
  );
}
