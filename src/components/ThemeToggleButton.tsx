import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { ColorPalette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

/** Inline dark/light switch; sits in a header row (see HomeScreen, right beside the WOW logo). */
export function ThemeToggleButton() {
  const { theme, colors, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={toggleTheme} hitSlop={8} style={styles.btn}>
      <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const SIZE = 32;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    btn: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
    },
  });
