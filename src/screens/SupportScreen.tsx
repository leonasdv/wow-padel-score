import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.subtitle}>Help keep WOW Padel Score running & free.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* GoPay QR */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="qr-code-outline" size={18} color={colors.lime} />
            <Text style={styles.cardTitle}>Support via GoPay</Text>
          </View>
          <View style={styles.qrFrame}>
            <Image source={require('../../assets/support-gopay.png')} style={styles.qr} resizeMode="contain" />
          </View>
          <Text style={styles.qrHint}>Scan with GoPay / any QRIS-enabled app</Text>
        </View>

        {/* Bank transfer */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="card-outline" size={18} color={colors.lime} />
            <Text style={styles.cardTitle}>Bank transfer</Text>
          </View>
          <View style={styles.bankRow}>
            <View style={styles.bankBadge}>
              <Text style={styles.bankBadgeText}>BCA</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text selectable style={styles.account}>
                0658065761
              </Text>
              <Text style={styles.holder}>a.n Leon Febri</Text>
            </View>
          </View>
          <Text style={styles.qrHint}>Long-press the number to copy it.</Text>
        </View>

        <View style={styles.thanks}>
          <Ionicons name="heart" size={16} color={colors.female} />
          <Text style={styles.thanksText}>Terima kasih for supporting the community!</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.screenBg },
    header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
    subtitle: { marginTop: 4, fontSize: 14, color: colors.textMuted },
    body: { padding: 20, gap: 16, paddingBottom: 120 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.hairline,
      borderRadius: radius.xxl,
      padding: 18,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
    cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    qrFrame: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, alignItems: 'center', justifyContent: 'center' },
    qr: { width: '100%', aspectRatio: 1, borderRadius: 8 },
    qrHint: { marginTop: 12, fontSize: 12, color: colors.textFaint, textAlign: 'center' },
    bankRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    bankBadge: {
      width: 58,
      height: 42,
      borderRadius: 10,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bankBadgeText: { color: '#0a55c8', fontWeight: '900', fontSize: 18, fontStyle: 'italic', letterSpacing: -0.5 },
    account: { fontSize: 24, fontWeight: '900', color: colors.lime, letterSpacing: 1, fontVariant: ['tabular-nums'] },
    holder: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    thanks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    thanksText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  });
