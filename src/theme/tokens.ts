export type ThemeName = 'dark' | 'light';

export interface ColorPalette {
  ink: string;
  /** Dark "ink" text/icon color for anything sitting on a bright accent fill (buttons, active chips,
   *  medal badges) — stays the same near-black navy in both themes, since those fills stay bright
   *  in both themes too. Also doubles as the deliberately-dark background for exported/shared cards. */
  courtNavy: string;
  /** Opaque app-screen background for screens that don't use the {@link ScreenBackground} gradient. */
  screenBg: string;
  surface: string;
  surface2: string;
  surfaceSunken: string;
  lime: string;
  courtBlue: string;
  male: string;
  female: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  textGhost: string;
  amber: string;
  win: string;
  tie: string;
  lose: string;
  hairline: string;
  hairlineStrong: string;
  white06: string;
  white05: string;
  overlay: string;
  blueTint: string;
  blueTintBorder: string;
  blueText: string;
  limeTint: string;
  limeTintBorder: string;
  maleTint: string;
  femaleTint: string;
  gold: string;
  silver: string;
  bronze: string;
}

const darkColors: ColorPalette = {
  ink: '#071733',
  courtNavy: '#0B1E3B',
  screenBg: '#0B1E3B',
  surface: '#13294D',
  surface2: '#1C3A66',
  surfaceSunken: '#0a1a34',
  lime: '#C6EA3B',
  courtBlue: '#2F80FF',
  male: '#43B0FF',
  female: '#FF6FA5',
  textPrimary: '#EAF1FF',
  textSecondary: '#B9C8E2',
  textMuted: '#92A6C9',
  textFaint: '#6E82A6',
  textGhost: '#42557a',
  amber: '#FFB43C',
  win: '#3DDC6F',
  tie: '#92A6C9',
  lose: '#FF5C5C',
  hairline: 'rgba(255,255,255,.08)',
  hairlineStrong: 'rgba(255,255,255,.14)',
  white06: 'rgba(255,255,255,.06)',
  white05: 'rgba(255,255,255,.05)',
  overlay: 'rgba(4,10,25,.6)',
  blueTint: 'rgba(47,128,255,.1)',
  blueTintBorder: 'rgba(47,128,255,.25)',
  blueText: '#7FB2FF',
  limeTint: 'rgba(198,234,59,.14)',
  limeTintBorder: 'rgba(198,234,59,.35)',
  maleTint: 'rgba(67,176,255,.16)',
  femaleTint: 'rgba(255,111,165,.16)',
  gold: '#FFD34E',
  silver: '#C9D6E5',
  bronze: '#E39A5B',
};

const lightColors: ColorPalette = {
  ink: '#F4F7FC',
  courtNavy: '#0B1E3B',
  screenBg: '#F3F5FA',
  surface: '#FFFFFF',
  surface2: '#E9F0FC',
  surfaceSunken: '#EEF1F8',
  lime: '#3D8B1D',
  courtBlue: '#2F80FF',
  male: '#1E7FE0',
  female: '#D93E77',
  textPrimary: '#0F1E33',
  textSecondary: '#3A4A63',
  textMuted: '#5C6B85',
  textFaint: '#7A879C',
  textGhost: '#C7CEDA',
  amber: '#B5750A',
  win: '#1D9E4B',
  tie: '#5C6B85',
  lose: '#D93636',
  hairline: 'rgba(11,30,59,.08)',
  hairlineStrong: 'rgba(11,30,59,.14)',
  white06: 'rgba(11,30,59,.05)',
  white05: 'rgba(11,30,59,.04)',
  overlay: 'rgba(4,10,25,.6)',
  blueTint: 'rgba(22,86,199,.08)',
  blueTintBorder: 'rgba(22,86,199,.25)',
  blueText: '#1656C7',
  limeTint: 'rgba(61,139,29,.12)',
  limeTintBorder: 'rgba(61,139,29,.35)',
  maleTint: 'rgba(30,127,224,.14)',
  femaleTint: 'rgba(217,62,119,.12)',
  gold: '#FFD34E',
  silver: '#C9D6E5',
  bronze: '#E39A5B',
};

export const palettes: Record<ThemeName, ColorPalette> = {
  dark: darkColors,
  light: lightColors,
};

export interface GradientTriple {
  screenBg: [string, string, string];
  selectedCard: [string, string];
}

const darkGradients: GradientTriple = {
  screenBg: ['#0d264a', '#071733', '#040d1f'],
  selectedCard: ['#1C3A66', '#13294D'],
};

const lightGradients: GradientTriple = {
  screenBg: ['#FDFEFF', '#F3F6FC', '#E9EEF7'],
  selectedCard: ['#FFFFFF', '#E9F0FC'],
};

export const gradientsByTheme: Record<ThemeName, GradientTriple> = {
  dark: darkGradients,
  light: lightGradients,
};

/** Static default palette — kept for any spot that hasn't been migrated to `useTheme()` yet. */
export const colors = darkColors;
export const gradients = darkGradients;

export const type = {
  score: { fontSize: 56, fontWeight: '800' as const },
  screenTitle: { fontSize: 26, fontWeight: '900' as const, letterSpacing: -1 },
  body: { fontSize: 15, fontWeight: '600' as const },
  overline: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 2, textTransform: 'uppercase' as const },
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  round: 999,
};

export const spacing = (n: number) => n * 4;

export const fontFamily = undefined; // system font fallback; Archivo not bundled on-device
