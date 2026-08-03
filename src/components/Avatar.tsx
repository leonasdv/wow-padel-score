import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';
import type { Gender } from '../types';

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  name: string;
  gender: Gender;
  size?: number;
}

export function Avatar({ name, gender, size = 34 }: Props) {
  const bg = gender === 'M' ? colors.maleTint : colors.femaleTint;
  const fg = gender === 'M' ? colors.male : colors.female;
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg, fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '800' },
});
