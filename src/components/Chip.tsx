import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Chip({ label, active, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.active : styles.inactive]}
    >
      <Text style={[styles.label, { color: active ? colors.courtNavy : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    chip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: radius.round },
    active: { backgroundColor: colors.lime },
    inactive: { backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairlineStrong },
    label: { fontSize: 13, fontWeight: '700' },
  });
