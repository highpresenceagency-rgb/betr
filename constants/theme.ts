// ─── Theme ──────────────────────────────────────────────────────────────────
// Theme = MODE (dark | light) × ACCENT (5 hues). All screens read `colors` from
// lib/theme → useTheme(), so flipping either dimension recolours the app live.
// Accent-derived tints (accentDark / accentBorder*) are computed per-mode so the
// same hue works on both a dark and a light base.

export type Palette = {
  bgPage: string; bg: string; card: string; cardInner: string; input: string;
  accent: string; accentDark: string;
  accentBorder: string; accentBorderL: string; accentBorderR: string; accentBorderB: string;
  textPrimary: string; textSecondary: string; textDim: string; textMuted: string;
  borderLight: string; borderMid: string; borderDark: string; borderDarker: string;
  red: string; amber: string;
};

export type ThemeMode = 'dark' | 'light';
export type AccentName = 'tidal' | 'matrix' | 'nebula' | 'ember' | 'coral';

const ACCENT_HEX: Record<AccentName, string> = {
  tidal: '#38BDF8', matrix: '#39FF7A', nebula: '#A78BFA', ember: '#FB923C', coral: '#FB7185',
};

export const ACCENT_META: { name: AccentName; label: string; swatch: string }[] = [
  { name: 'tidal', label: 'Tidal', swatch: ACCENT_HEX.tidal },
  { name: 'matrix', label: 'Matrix', swatch: ACCENT_HEX.matrix },
  { name: 'nebula', label: 'Nebula', swatch: ACCENT_HEX.nebula },
  { name: 'ember', label: 'Ember', swatch: ACCENT_HEX.ember },
  { name: 'coral', label: 'Coral', swatch: ACCENT_HEX.coral },
];
export const PALETTE_META = ACCENT_META; // back-compat alias

// ─── tiny hex blend helpers ───────────────────────────────────────────────────
const _h = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const _c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
function mix(a: string, b: string, t: number): string {
  const A = _h(a), B = _h(b);
  return '#' + _c(A[0] + (B[0] - A[0]) * t) + _c(A[1] + (B[1] - A[1]) * t) + _c(A[2] + (B[2] - A[2]) * t);
}

const darkBase = {
  bgPage: '#060606', bg: '#0C0C0C', card: '#161616', cardInner: '#0F0F0F', input: '#111111',
  textPrimary: '#EFEFEF', textSecondary: '#D0D0D0', textDim: '#6E6E6E', textMuted: '#454545',
  borderLight: '#2A2A2A', borderMid: '#202020', borderDark: '#0D0D0D', borderDarker: '#080808',
  red: '#F87171', amber: '#F59E0B',
};

const lightBase = {
  bgPage: '#F4F6F9', bg: '#FFFFFF', card: '#FFFFFF', cardInner: '#F3F5F8', input: '#EEF1F5',
  textPrimary: '#0E1116', textSecondary: '#3A4250', textDim: '#6B7280', textMuted: '#9AA3AF',
  borderLight: '#E3E7ED', borderMid: '#E8ECF1', borderDark: '#DCE1E8', borderDarker: '#CED5DE',
  red: '#DC2626', amber: '#D97706',
};

export function buildPalette(mode: ThemeMode, accent: AccentName): Palette {
  const a = ACCENT_HEX[accent] ?? ACCENT_HEX.tidal;
  const light = mode === 'light';
  const base = light ? lightBase : darkBase;
  return {
    ...base,
    accent: a,
    accentDark:    light ? mix(a, '#FFFFFF', 0.86) : mix(a, '#000000', 0.84),
    accentBorder:  light ? mix(a, '#FFFFFF', 0.40) : mix(a, '#000000', 0.48),
    accentBorderL: light ? mix(a, '#FFFFFF', 0.50) : mix(a, '#000000', 0.58),
    accentBorderR: light ? mix(a, '#FFFFFF', 0.62) : mix(a, '#000000', 0.66),
    accentBorderB: light ? mix(a, '#FFFFFF', 0.70) : mix(a, '#000000', 0.74),
  };
}

export const DEFAULT_MODE: ThemeMode = 'light';
export const DEFAULT_ACCENT: AccentName = 'tidal';

// Static fallback for any code not on the theme context.
export const colors: Palette = buildPalette(DEFAULT_MODE, DEFAULT_ACCENT);

export const radii = { sm: 8, md: 10, lg: 14, xl: 20, full: 9999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
