import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ScreenBackground, StepHeader } from '../../components/Misc';
import { useDraft } from '../../data/draft';
import { useEvents } from '../../data/store';
import { makeId } from '../../lib/id';
import { defaultGroupName, randomGroupAssignment, startTournament, tournamentSetupProblem } from '../../lib/tournamentMode';
import type { RootStackParamList } from '../../navigation/types';
import type { ColorPalette } from '../../theme/tokens';
import { radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import type { Player, WowEvent } from '../../types';

const MAX_GROUPS = 8;

export function CreateGroupsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setDraft } = useDraft();
  const { addEvent } = useEvents();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [moving, setMoving] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);

  const { players, groupCount, advanceCount } = draft;
  const maxGroups = Math.max(2, Math.min(MAX_GROUPS, Math.floor(players.length / 2)));

  // A player counts as unassigned if they have no group, or sit in a group that no longer exists (group count was lowered).
  const groupIndexOf = (id: string): number | null => {
    const v = draft.groupOf[id];
    return v != null && v < groupCount ? v : null;
  };
  const members = Array.from({ length: groupCount }, (_, gi) => players.filter((p) => groupIndexOf(p.id) === gi));
  const unassigned = players.filter((p) => groupIndexOf(p.id) === null);
  const sizes = members.map((m) => m.length);
  const smallest = sizes.length ? Math.min(...sizes) : 0;
  const problem = tournamentSetupProblem(sizes, unassigned.length, advanceCount);
  const matchCount = sizes.reduce((sum, n) => sum + (n * (n - 1)) / 2, 0);

  const setGroupCount = (n: number) => {
    const next = Math.max(2, Math.min(maxGroups, n));
    setDraft((d) => ({ ...d, groupCount: next }));
  };
  const setAdvance = (n: number) => setDraft((d) => ({ ...d, advanceCount: Math.max(1, Math.min(n, Math.max(smallest, 1))) }));

  const randomize = () =>
    setDraft((d) => ({ ...d, groupOf: randomGroupAssignment(d.players.map((p) => p.id), d.groupCount) }));
  const clearAll = () => setDraft((d) => ({ ...d, groupOf: {} }));
  const assign = (playerId: string, group: number | null) => {
    setDraft((d) => {
      const groupOf = { ...d.groupOf };
      if (group === null) delete groupOf[playerId];
      else groupOf[playerId] = group;
      return { ...d, groupOf };
    });
    setMoving(null);
  };

  const onCreate = async () => {
    if (problem || busy) return;
    setBusy(true);
    const groups = members.map((m, gi) => ({ id: makeId('group'), name: defaultGroupName(gi), playerIds: m.map((p) => p.id) }));
    const base: WowEvent = {
      id: makeId('event'),
      name: draft.name || 'Untitled event',
      format: 'tournament',
      scoringMode: 'free',
      pot: draft.pot,
      courts: [],
      players: draft.players,
      tournament: { groups, advanceCount },
      rounds: [],
      totalRoundsEstimate: 0,
      currentRoundIndex: 1,
      status: 'draft',
      createdAt: Date.now(),
      resultBgIndex: 0,
    };
    const live = startTournament(base);
    await addEvent(live);
    nav.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'GroupStage', params: { eventId: live.id } }] });
  };

  const renderStepper = ({ label, value, onMinus, onPlus, suffix }: { label: string; value: number; onMinus: () => void; onPlus: () => void; suffix?: string }) => (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable style={styles.stepBtn} onPress={onMinus} hitSlop={6}>
          <Text style={styles.stepBtnText}>–</Text>
        </Pressable>
        <View style={styles.stepValue}>
          <Text style={styles.stepValueText}>{suffix ? `${suffix} ${value}` : value}</Text>
        </View>
        <Pressable style={[styles.stepBtn, { backgroundColor: colors.white06 }]} onPress={onPlus} hitSlop={6}>
          <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  const playerChip = (p: Player) => (
    <Pressable key={p.id} style={styles.playerRow} onPress={() => setMoving(p)}>
      <Avatar name={p.name} gender={p.gender} />
      <Text style={styles.playerName} numberOfLines={1}>
        {p.name}
      </Text>
      <Ionicons name="swap-horizontal" size={16} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StepHeader step={4} total={4} onBack={() => nav.goBack()} />
        <View style={styles.headBlock}>
          <Text style={styles.title}>Set up groups</Text>
          <Text style={styles.subtitle}>Everyone plays everyone in their group. Win 3 pts · Tie 1 · Loss 0.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {renderStepper({ label: 'Number of groups', value: groupCount, onMinus: () => setGroupCount(groupCount - 1), onPlus: () => setGroupCount(groupCount + 1) })}
          <View style={{ height: 10 }} />
          {renderStepper({
            label: 'Advance to knockout (per group)',
            value: advanceCount,
            suffix: 'Top',
            onMinus: () => setAdvance(advanceCount - 1),
            onPlus: () => setAdvance(advanceCount + 1),
          })}

          <View style={styles.actionRow}>
            <Pressable style={styles.randomBtn} onPress={randomize}>
              <Ionicons name="shuffle" size={17} color={colors.courtNavy} />
              <Text style={styles.randomText}>Randomize evenly</Text>
            </Pressable>
            <Pressable style={styles.clearBtn} onPress={clearAll}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          <Text style={styles.tip}>Tap a player to move them to a group.</Text>

          {unassigned.length > 0 && (
            <View style={styles.groupCard}>
              <View style={styles.groupHead}>
                <Text style={[styles.groupName, { color: colors.amber }]}>Not assigned</Text>
                <Text style={styles.groupCount}>{unassigned.length}</Text>
              </View>
              <View style={{ gap: 8 }}>{unassigned.map(playerChip)}</View>
            </View>
          )}

          {members.map((m, gi) => (
            <View key={gi} style={styles.groupCard}>
              <View style={styles.groupHead}>
                <Text style={styles.groupName}>{defaultGroupName(gi)}</Text>
                <Text style={styles.groupCount}>
                  {m.length} player{m.length === 1 ? '' : 's'}
                </Text>
              </View>
              {m.length === 0 ? <Text style={styles.emptyGroup}>No players yet</Text> : <View style={{ gap: 8 }}>{m.map(playerChip)}</View>}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={[styles.summary, problem ? { color: colors.amber } : null]}>
            {problem ?? `${matchCount} group matches · top ${advanceCount} of each group (${advanceCount * groupCount} players) reach the knockout`}
          </Text>
          <Button label="Create tournament" icon="chevron-forward" onPress={onCreate} disabled={!!problem} loading={busy} />
        </View>

        <Modal visible={!!moving} transparent animationType="fade" onRequestClose={() => setMoving(null)}>
          <Pressable style={styles.backdrop} onPress={() => setMoving(null)} />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalLabel}>Move {moving?.name}</Text>
              <View style={{ gap: 8 }}>
                {Array.from({ length: groupCount }, (_, gi) => {
                  const on = moving ? groupIndexOf(moving.id) === gi : false;
                  return (
                    <Pressable key={gi} style={[styles.modalOption, on && styles.modalOptionOn]} onPress={() => moving && assign(moving.id, gi)}>
                      <Text style={[styles.modalOptionText, on && { color: colors.lime }]}>{defaultGroupName(gi)}</Text>
                      <Text style={styles.modalOptionCount}>{members[gi].length}</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.modalOption} onPress={() => moving && assign(moving.id, null)}>
                  <Text style={[styles.modalOptionText, { color: colors.textMuted }]}>Not assigned</Text>
                </Pressable>
              </View>
              <Pressable style={styles.modalCancel} onPress={() => setMoving(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    safe: { flex: 1 },
    headBlock: { paddingHorizontal: 24, paddingTop: 12 },
    title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
    subtitle: { marginTop: 6, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    body: { padding: 24, paddingTop: 18, paddingBottom: 12 },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.hairline,
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    stepLabel: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textFaint },
    stepControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white06, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontSize: 20, fontWeight: '800', color: colors.textMuted },
    stepValue: { minWidth: 70, height: 42, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
    stepValueText: { fontSize: 18, fontWeight: '800', color: colors.lime },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
    randomBtn: { flex: 1, height: 46, borderRadius: 13, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    randomText: { fontSize: 14, fontWeight: '800', color: colors.courtNavy },
    clearBtn: { height: 46, paddingHorizontal: 18, borderRadius: 13, backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
    clearText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
    tip: { marginTop: 8, marginBottom: 6, fontSize: 12, color: colors.textFaint },
    groupCard: { marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.hairline, padding: 14 },
    groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    groupName: { fontSize: 13, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', color: colors.lime },
    groupCount: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
    emptyGroup: { fontSize: 13, color: colors.textFaint, fontStyle: 'italic' },
    playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceSunken, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
    playerName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20, gap: 10 },
    summary: { fontSize: 12, lineHeight: 17, color: colors.textFaint, textAlign: 'center' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,25,.6)' },
    modalCenter: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
    modalCard: { backgroundColor: '#12274a', borderRadius: 20, borderWidth: 1, borderColor: colors.hairlineStrong, padding: 20 },
    modalLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 12 },
    modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairline },
    modalOptionOn: { borderColor: colors.lime },
    modalOptionText: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    modalOptionCount: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
    modalCancel: { marginTop: 12, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalCancelText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  });
