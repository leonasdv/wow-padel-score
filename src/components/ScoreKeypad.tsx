import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme/tokens';
import type { ScoringMode } from '../types';

interface Props {
  visible: boolean;
  title: string;
  scoringMode: ScoringMode;
  pot: number;
  buffer: string;
  oppLabel: string;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

export function ScoreKeypad({ visible, title, scoringMode, pot, buffer, oppLabel, onDigit, onDelete, onConfirm, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const max = scoringMode === 'total' ? pot : 99;
  const bufNum = buffer === '' ? null : Math.min(Number(buffer), max);
  const autoFill = scoringMode === 'total' ? (bufNum === null ? '–' : String(pot - bufNum)) : null;

  // A digit is only usable if appending it keeps the score within the scoring scheme's max.
  const digitDisabled = (k: string) => Number(buffer + k) > max;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>
          {title} · {scoringMode === 'total' ? `Total Score, pot ${pot}` : 'Free Entry'}
        </Text>
        <View style={styles.valuesRow}>
          <View style={styles.valueBox}>
            <Text style={styles.valueText}>{buffer === '' ? '–' : buffer}</Text>
          </View>
          {scoringMode === 'total' && (
            <>
              <Text style={styles.slash}>/</Text>
              <View style={styles.autoBox}>
                <Text style={styles.autoText}>{autoFill}</Text>
                <Text style={styles.autoLabel}>{oppLabel}</Text>
              </View>
            </>
          )}
        </View>
        <View style={styles.grid}>
          {KEYS.map((k) => {
            if (k === 'del') {
              return (
                <Pressable key={k} onPress={onDelete} style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
                  <Ionicons name="backspace-outline" size={20} color={colors.textPrimary} />
                </Pressable>
              );
            }
            if (k === 'ok') {
              return (
                <Pressable key={k} onPress={onConfirm} style={({ pressed }) => [styles.key, { backgroundColor: colors.lime }, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="checkmark" size={22} color={colors.courtNavy} />
                </Pressable>
              );
            }
            const disabled = digitDisabled(k);
            return (
              <Pressable
                key={k}
                disabled={disabled}
                onPress={() => onDigit(k)}
                style={({ pressed }) => [styles.key, disabled && styles.keyDisabled, pressed && !disabled && styles.keyPressed]}
              >
                <Text style={[styles.keyLabel, disabled && styles.keyLabelDisabled]}>{k}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,10,25,.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0e2242',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  grabber: { width: 44, height: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,.18)', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 12 },
  valuesRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  valueBox: {
    flex: 1,
    minWidth: 96,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: { fontSize: 36, fontWeight: '800', color: colors.lime },
  slash: { fontSize: 15, fontWeight: '800', color: colors.textFaint },
  autoBox: {
    flex: 1,
    minWidth: 96,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,.03)',
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoText: { fontSize: 32, fontWeight: '800', color: colors.textFaint, lineHeight: 34 },
  autoLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textGhost },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  key: {
    width: '31%',
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: 'rgba(255,255,255,.14)' },
  keyDisabled: { backgroundColor: 'rgba(255,255,255,.02)' },
  keyLabel: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  keyLabelDisabled: { color: 'rgba(255,255,255,.15)' },
});
