import 'react-native-gesture-handler';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertHost } from './src/components/AlertHost';
import { SplashOverlay } from './src/components/SplashOverlay';
import { DraftProvider } from './src/data/draft';
import { EventsProvider } from './src/data/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme/tokens';

// Keep the native splash on screen until we manually hide it below.
SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.courtNavy,
    card: colors.courtNavy,
    border: colors.hairline,
    primary: colors.lime,
  },
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Android 12+ can only show a small icon natively, so hide it immediately and let
    // our own full-screen SplashOverlay (below) hold the screen for ~2s instead.
    SplashScreen.hideAsync().catch(() => {});
    const t = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <EventsProvider>
        <DraftProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="light" />
        </DraftProvider>
      </EventsProvider>
      <AlertHost />
      {showSplash && <SplashOverlay />}
    </SafeAreaProvider>
  );
}
