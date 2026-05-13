import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) router.replace('/(home)/');
      } else if (event === 'SIGNED_IN') {
        router.replace('/(home)/');
      } else if (event === 'SIGNED_OUT') {
        router.replace('/');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(home)" />
        <Stack.Screen
          name="check-in"
          options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.bg } }}
        />
        <Stack.Screen name="deposit-success" />
        <Stack.Screen name="deposit-cancel" />
      </Stack>
    </SafeAreaProvider>
  );
}
