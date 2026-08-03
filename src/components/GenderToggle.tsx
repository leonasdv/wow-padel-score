import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/tokens';
import type { Gender } from '../types';

interface Props {
  value: Gender;
  onChange: (g: Gender) => void;
  compact?: boolean;
}

export function GenderToggle({ value, onChange, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Pressable
        onPress={() => onChange('M')}
        style={[styles.btn, compact && styles.btnCompact, value === 'M' && { backgroundColor: colors.male }]}
      >
        <Text style={[styles.label, { color: value === 'M' ? colors.courtNavy : colors.textFaint }]}>M</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('F')}
        style={[styles.btn, compact && styles.btnCompact, value === 'F' && { backgroundColor: colors.female }]}
      >
        <Text style={[styles.label, { color: value === 'F' ? colors.courtNavy : colors.textFaint }]}>F</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: 10, padding: 3, gap: 3 },
  wrapCompact: { borderRadius: 10, padding: 3, gap: 3 },
  btn: { width: 30, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnCompact: { width: 30, height: 28, borderRadius: 8 },
  label: { fontSize: 13, fontWeight: '800' },
});
