import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme/tokens';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Chip({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.active : styles.inactive]}
    >
      <Text style={[styles.label, { color: active ? colors.courtNavy : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: radius.round },
  active: { backgroundColor: colors.lime },
  inactive: { backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairlineStrong },
  label: { fontSize: 13, fontWeight: '700' },
});
