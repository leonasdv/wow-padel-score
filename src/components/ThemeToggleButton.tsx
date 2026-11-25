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
      style={[styles.btn, { top: Math.max(2, insets.top - SIZE) }]}
    >
      <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={13}color={colors.textSecondary} />
    </Pressable>
  );
}

const SIZE = 22;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    // Tucked into the top-left corner, in the strip of the status-bar inset just above the screen
    // headers, so it never covers a header button or page content.
    btn: {
      position: 'absolute',
      left: 12,
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
