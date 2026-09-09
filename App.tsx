import 'react-native-gesture-handler';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertHost } from './src/components/AlertHost';
import { SplashOverlay } from './src/components/SplashOverlay';
import { ThemeToggleButton } from './src/components/ThemeToggleButton';
import { DraftProvider } from './src/data/draft';
import { EventsProvider } from './src/data/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Keep the native splash on screen until we manually hide it below.
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppShell() {
  const [showSplash, setShowSplash] = useState(true);
  const { theme, colors } = useTheme();

  useEffect(() => {
    // Android 12+ can only show a small icon natively, so hide it immediately and let
    // our own full-screen SplashOverlay (below) hold the screen for ~2s instead.
    SplashScreen.hideAsync().catch(() => {});
    const t = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(t);
  }, []);

  const navTheme = {
    ...(theme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.screenBg,
      card: colors.screenBg,
      border: colors.hairline,
      primary: colors.lime,
    },
  };

  return (
    <SafeAreaProvider>
      <EventsProvider>
        <DraftProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        </DraftProvider>
      </EventsProvider>
      <ThemeToggleButton />
      <AlertHost />
      {showSplash && <SplashOverlay />}
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
