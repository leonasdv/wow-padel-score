import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

const WORDMARK_ASPECT = 880 / 310;

interface Props {
  size?: number;
  subtitle?: boolean;
}

export function WowLogo({ size = 22, subtitle = false }: Props) {
  const height = size * 1.15;
  const width = height * WORDMARK_ASPECT;
  return (
    <View style={styles.row}>
      <Image source={require('../../assets/wow-wordmark-dark.png')} style={{ width, height }} resizeMode="contain" />
      {subtitle && <Text style={[styles.subtitle, { color: colors.textFaint, fontSize: size * 0.48 }]}>SCORE</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  subtitle: { fontWeight: '700', letterSpacing: 2, marginLeft: 8 },
});
