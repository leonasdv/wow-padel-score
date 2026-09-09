import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ColorPalette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

/**
 * Floating dark/light switch rendered once at the app root (see App.tsx) so it stays on screen
 * over every page, not just one tab — toggling theme shouldn't require navigating anywhere first.
 */
export function ThemeToggleButton() {
  const { theme, colors, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={toggleTheme}
      hitSlop={8}
      style={[styles.btn, { top: insets.top + 8 }]}
    >
      <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const SIZE = 38;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    // Centered horizontally rather than pinned to a corner: every screen's header consistently
    // pins its own controls (back button, menu, "Done", etc.) to the left and right edges, so the
    // middle of the top row is the one spot free of collisions across the whole app.
    btn: {
      position: 'absolute',
      left: '50%',
      marginLeft: -SIZE / 2,
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      zIndex: 1000,
      elevation: 10,
    },
  });
