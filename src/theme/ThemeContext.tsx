import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ColorPalette, GradientTriple, ThemeName } from './tokens';
import { gradientsByTheme, palettes } from './tokens';

const STORAGE_KEY = '@wow_padel_score/theme';

interface ThemeContextValue {
  theme: ThemeName;
  colors: ColorPalette;
  gradients: GradientTriple;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Defaults to dark — matches the app's original look until someone opts into light mode.
  const [theme, setThemeState] = useState<ThemeName>('dark');

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') setThemeState(saved);
    })();
  }, []);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: palettes[theme],
      gradients: gradientsByTheme[theme],
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
