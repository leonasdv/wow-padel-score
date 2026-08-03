import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius } from '../theme/tokens';

export function ScreenBackground({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={gradients.screenBg} style={styles.bg} start={{ x: 0.2, y: 0 }} end={{ x: 0.6, y: 1 }}>
      {children}
    </LinearGradient>
  );
}

export function IconButton({
  name,
  onPress,
  size = 40,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.iconBtn, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Ionicons name={name} size={size * 0.5} color={colors.textPrimary} />
    </Pressable>
  );
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.progressSeg, { backgroundColor: i < step ? colors.lime : colors.white06 }]} />
      ))}
    </View>
  );
}

export function StepHeader({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
      <View style={styles.headerRow}>
        <IconButton name="chevron-back" onPress={onBack} />
        <Text style={styles.stepLabel}>
          Step {step} of {total}
        </Text>
      </View>
      <View style={{ marginTop: 20 }}>
        <StepProgress step={step} total={total} />
      </View>
    </View>
  );
}

export function InfoBox({ text }: { text: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name="information-circle-outline" size={22} color={colors.blueText} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  live: { bg: 'rgba(198,234,59,.16)', fg: colors.lime, label: 'LIVE' },
  upcoming: { bg: 'rgba(47,128,255,.16)', fg: colors.blueText, label: 'UPCOMING' },
  draft: { bg: colors.white06, fg: colors.textMuted, label: 'DRAFT' },
  done: { bg: colors.white06, fg: colors.textFaint, label: 'ENDED' },
};

export function StatusPill({ status }: { status: 'live' | 'upcoming' | 'draft' | 'done' }) {
  const s = STATUS_STYLE[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

export function LivePulseDot() {
  return <View style={styles.dot} />;
}

export function Card({ children, style, bordered }: { children: React.ReactNode; style?: any; bordered?: 'lime' | 'default' }) {
  return (
    <View
      style={[
        styles.card,
        bordered === 'lime' && { borderColor: colors.lime, borderWidth: 1.5 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  iconBtn: { backgroundColor: colors.white06, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', gap: 7 },
  progressSeg: { flex: 1, height: 5, borderRadius: 99 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  info: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.blueTint,
    borderWidth: 1,
    borderColor: colors.blueTintBorder,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  pill: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.round },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
});
