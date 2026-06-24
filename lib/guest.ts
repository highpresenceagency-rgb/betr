import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

// ─── Guest mode ─────────────────────────────────────────────────────────────
//
// A "guest" has no Supabase session. They can browse public challenges and
// profiles read-only (RLS allows anon reads), but any write action is gated
// behind `guardGuest()`, which prompts them to create an account.
//
// State is kept in memory for synchronous reads (`isGuest()`) and mirrored to
// AsyncStorage so guest mode survives an app restart.

const STORAGE_KEY = 'bettr.guestMode';

let guestActive = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Load the persisted guest flag into memory. Call once at startup before routing. */
export async function loadGuestMode(): Promise<boolean> {
  try {
    guestActive = (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
  } catch {
    guestActive = false;
  }
  emit();
  return guestActive;
}

/** Synchronous read of the current guest state. */
export function isGuest(): boolean {
  return guestActive;
}

export async function enterGuestMode(): Promise<void> {
  guestActive = true;
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // best-effort persistence; in-memory state still works for this session
  }
}

export async function exitGuestMode(): Promise<void> {
  guestActive = false;
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook — re-renders the component when guest state changes. */
export function useIsGuest(): boolean {
  return useSyncExternalStore(subscribe, isGuest, isGuest);
}

/**
 * Guard a sign-in-only action. If the current user is a guest, shows a prompt
 * inviting them to create an account / sign in and returns `true` (the caller
 * should bail out). Returns `false` for real signed-in users.
 *
 * Usage:  if (guardGuest('join this challenge')) return;
 */
export function guardGuest(action = 'do that'): boolean {
  if (!guestActive) return false;
  Alert.alert(
    'Create an account',
    `You're browsing as a guest. Sign up or sign in to ${action}.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Sign in', onPress: () => router.push('/(auth)/sign-in') },
      { text: 'Sign up', onPress: () => router.push('/(auth)/sign-up/step-1') },
    ],
  );
  return true;
}
