import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TiebreakReason } from '../lib/tournament';
import { colors } from '../theme/tokens';

export interface TiebreakEntry {
  neighborName: string;
  reason: TiebreakReason;
}

interface Props {
  visible: boolean;
  playerName: string;
  points: number;
  entries: TiebreakEntry[];
  onClose: () => void;
}

const CRITERION_LABEL: Record<TiebreakReason['criterion'], string> = {
  league: 'league score (PPM)',
  wins: 'win count',
  ties: 'tie count',
  losses: 'loss count',
  headToHead: 'head-to-head record',
  tied: '',
};

function formatValue(criterion: TiebreakReason['criterion'], value: number): string {
  return criterion === 'league' ? value.toFixed(2) : String(value);
}

function sentenceFor(playerName: string, entry: TiebreakEntry): string {
  const { reason, neighborName } = entry;
  if (reason.criterion === 'tied') {
    return `${playerName} and ${neighborName} are fully tied on every stat (points, league score, wins, ties, losses, and head-to-head). The order shown just reflects entry order.`;
  }
  const label = CRITERION_LABEL[reason.criterion];
  const own = formatValue(reason.criterion, reason.ownValue);
  const other = formatValue(reason.criterion, reason.otherValue);
  const above = reason.aheadOfOther;
  const comparator = reason.criterion === 'losses' ? (above ? 'fewer' : 'more') : above ? 'higher' : 'lower';
  return `${playerName} is ranked ${above ? 'above' : 'below'} ${neighborName} — same points, but ${comparator} ${label}: ${own} vs ${other}.`;
}

export function TiebreakInfoModal({ visible, playerName, points, entries, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.modal}>
          <View style={styles.head}>
            <Ionicons name="alert-circle" size={20} color={colors.amber} />
            <Text style={styles.title} numberOfLines={1}>
              {playerName}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            Tied on {points} pts with {entries.length} other player{entries.length === 1 ? '' : 's'} — here's how the tie was broken:
          </Text>
          <View style={{ gap: 10 }}>
            {entries.map((entry, i) => (
              <Text key={i} style={styles.line}>
                {sentenceFor(playerName, entry)}
              </Text>
            ))}
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,25,.6)' },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  modal: {
    backgroundColor: '#12274a',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: 24,
    paddingTop: 22,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 },
  title: { flex: 1, fontSize: 19, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 14, lineHeight: 18 },
  line: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  closeBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16, backgroundColor: colors.lime },
  closeText: { fontWeight: '800', fontSize: 15, color: colors.courtNavy },
});
