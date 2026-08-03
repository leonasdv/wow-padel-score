export const colors = {
  ink: '#071733',
  courtNavy: '#0B1E3B',
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
} as const;

export const gradients = {
  screenBg: ['#0d264a', '#071733', '#040d1f'] as [string, string, string],
  selectedCard: ['#1C3A66', '#13294D'] as [string, string],
};

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
