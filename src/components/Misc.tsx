import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

const staticStyles = StyleSheet.create({ bg: { flex: 1 } });

export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { gradients } = useTheme();
  return (
    <LinearGradient colors={gradients.screenBg} style={staticStyles.bg} start={{ x: 0.2, y: 0 }} end={{ x: 0.6, y: 1 }}>
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
  const { colors } = useTheme();
  const s = useStyles(colors);
  return (
    <Pressable onPress={onPress} style={[s.iconBtn, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Ionicons name={name} size={size * 0.5} color={colors.textPrimary} />
    </Pressable>
  );
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  return (
    <View style={s.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.progressSeg, { backgroundColor: i < step ? colors.lime : colors.white06 }]} />
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
  const { colors } = useTheme();
  const s = useStyles(colors);
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
      <View style={s.headerRow}>
        <IconButton name="chevron-back" onPress={onBack} />
        <Text style={s.stepLabel}>
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
  const { colors } = useTheme();
  const s = useStyles(colors);
  return (
    <View style={s.info}>
      <Ionicons name="information-circle-outline" size={22} color={colors.blueText} />
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

function statusStyleFor(colors: ColorPalette): Record<string, { bg: string; fg: string; label: string }> {
  return {
    live: { bg: colors.limeTint, fg: colors.lime, label: 'LIVE' },
    upcoming: { bg: colors.blueTint, fg: colors.blueText, label: 'UPCOMING' },
    draft: { bg: colors.white06, fg: colors.textMuted, label: 'DRAFT' },
    done: { bg: colors.white06, fg: colors.textFaint, label: 'ENDED' },
  };
}

export function StatusPill({ status }: { status: 'live' | 'upcoming' | 'draft' | 'done' }) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const st = statusStyleFor(colors)[status];
  return (
    <View style={[s.pill, { backgroundColor: st.bg }]}>
      <Text style={[s.pillText, { color: st.fg }]}>{st.label}</Text>
    </View>
  );
}

export function LivePulseDot() {
  const { colors } = useTheme();
  const s = useStyles(colors);
  return <View style={s.dot} />;
}

export function Card({ children, style, bordered }: { children: React.ReactNode; style?: any; bordered?: 'lime' | 'default' }) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  return (
    <View
      style={[
        s.card,
        bordered === 'lime' && { borderColor: colors.lime, borderWidth: 1.5 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function useStyles(colors: ColorPalette) {
  return useMemo(() => makeStyles(colors), [colors]);
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
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
