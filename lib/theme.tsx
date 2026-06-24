import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildPalette, Palette, AccentName, ThemeMode, DEFAULT_MODE, DEFAULT_ACCENT, ACCENT_META,
} from '../constants/theme';

const MODE_KEY = 'bettrr.mode';
const ACCENT_KEY = 'bettrr.accent';

type ThemeCtx = {
  colors: Palette;
  mode: ThemeMode;
  accent: AccentName;
  name: AccentName;                 // back-compat alias for accent
  setMode: (m: ThemeMode) => void;
  setTheme: (a: AccentName) => void; // back-compat: sets the accent
  ready: boolean;
};

const ThemeContext = createContext<ThemeCtx | null>(null);
const isAccent = (v: string | null): v is AccentName => !!v && ACCENT_META.some((a) => a.name === v);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [accent, setAccentState] = useState<AccentName>(DEFAULT_ACCENT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(MODE_KEY), AsyncStorage.getItem(ACCENT_KEY)])
      .then(([m, a]) => {
        if (m === 'light' || m === 'dark') setModeState(m);
        if (isAccent(a)) setAccentState(a);
      })
      .finally(() => setReady(true));
  }, []);

  const setMode = (m: ThemeMode) => { setModeState(m); AsyncStorage.setItem(MODE_KEY, m).catch(() => {}); };
  const setTheme = (a: AccentName) => { setAccentState(a); AsyncStorage.setItem(ACCENT_KEY, a).catch(() => {}); };

  const value = useMemo<ThemeCtx>(
    () => ({ colors: buildPalette(mode, accent), mode, accent, name: accent, setMode, setTheme, ready }),
    [mode, accent, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Theme-aware styles with minimal churn. Replace
 *   const styles = StyleSheet.create({ ... colors.accent ... })
 * with
 *   const useStyles = makeStyles(({ colors }) => ({ ... colors.accent ... }))
 * and inside the component: const styles = useStyles();
 * Styles recompute whenever the palette (mode or accent) changes.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (t: { colors: Palette }) => T,
) {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory({ colors })), [colors]);
  };
}
