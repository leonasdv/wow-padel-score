import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { IconButton, LivePulseDot, ScreenBackground } from '../components/Misc';
import { QrCodeModal } from '../components/QrCodeModal';
import { TiebreakInfoModal, type TiebreakEntry } from '../components/TiebreakInfoModal';
import { ScoreKeypad } from '../components/ScoreKeypad';
import { useEvents } from '../data/store';
import { Alert } from '../lib/alert';
import { publishEvent, shareUrlFor } from '../lib/share';
import {
  clearGroupScore,
  computeAllGroupTables,
  groupIndexOfMatch,
  groupStageProgress,
  groupStageRounds,
  groupTieSentence,
  isGroupStageComplete,
  setGroupScore,
  startTournamentKnockout,
} from '../lib/tournamentMode';
import type { RootStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import type { Match } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'GroupStage'>;

export function GroupStageScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { getEvent, updateEvent } = useEvents();
  const event = getEvent(route.params.eventId);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [groupIdx, setGroupIdx] = useState(0);
  const [edit, setEdit] = useState<{ roundIndex: number; courtId: string; team: 'A' | 'B' } | null>(null);
  const [buffer, setBuffer] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [tiebreakInfo, setTiebreakInfo] = useState<{ playerName: string; points: number; entries: TiebreakEntry[] } | null>(null);

  if (!event || !event.tournament) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <Text style={{ color: colors.textPrimary, padding: 24 }}>Event not found.</Text>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const cfg = event.tournament;
  const locked = event.format !== 'tournament'; // knockout already started — group results are final
  const tables = computeAllGroupTables(event);
  const safeIdx = Math.min(groupIdx, Math.max(tables.length - 1, 0));
  const current = tables[safeIdx];
  const progress = groupStageProgress(event);
  const complete = isGroupStageComplete(event);
  const nameOf = (id: string | undefined) => (id ? event.players.find((p) => p.id === id)?.name ?? '—' : '—');

  // This group's fixtures, bucketed by matchday.
  const matchdays = groupStageRounds(event)
    .map((r) => ({ index: r.index, matches: r.matches.filter((m) => groupIndexOfMatch(m) === safeIdx) }))
    .filter((d) => d.matches.length > 0);
  const groupProgress = {
    played: matchdays.flatMap((d) => d.matches).filter((m) => m.scoreA != null && m.scoreB != null).length,
    total: matchdays.reduce((sum, d) => sum + d.matches.length, 0),
  };

  const openEdit = (roundIndex: number, m: Match, team: 'A' | 'B') => {
    if (locked) return;
    const cur = team === 'A' ? m.scoreA : m.scoreB;
    setEdit({ roundIndex, courtId: m.courtId, team });
    setBuffer(cur != null ? String(cur) : '');
  };

  const confirmScore = async () => {
    if (!edit) return;
    const value = buffer === '' ? 0 : Number(buffer);
    await updateEvent(event.id, (e) => setGroupScore(e, edit.roundIndex, edit.courtId, edit.team, value));
    setEdit(null);
    setBuffer('');
  };

  const clearMatch = () => {
    if (!edit) return;
    const { roundIndex, courtId } = edit;
    Alert.alert('Clear this score?', 'Both scores for this match go back to unscored.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await updateEvent(event.id, (e) => clearGroupScore(e, roundIndex, courtId));
          setEdit(null);
          setBuffer('');
        },
      },
    ]);
  };

  const onStartKnockout = () => {
    const qualifiers = tables.reduce((sum, t) => sum + Math.min(cfg.advanceCount, t.table.length), 0);
    Alert.alert(
      'Start knockout stage?',
      `The top ${cfg.advanceCount} of each group (${qualifiers} players) go into the bracket. Group results are locked once it starts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start knockout',
          onPress: async () => {
            if (starting) return;
            setStarting(true);
            try {
              await updateEvent(event.id, (e) => startTournamentKnockout(e));
              nav.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'Knockout', params: { eventId: event.id } }] });
            } finally {
              setStarting(false);
            }
          },
        },
      ]
    );
  };

  const onShareLive = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      let target = event;
      if (!target.shareId) {
        const published = await publishEvent(target);
        await updateEvent(event.id, () => published, { skipHistory: true });
        target = published;
      }
      setQrUrl(shareUrlFor(target.shareId!));
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? 'Could not create the share link. Check your connection and try again.');
    } finally {
      setShareBusy(false);
    }
  };

  const scoreChip = (m: Match, team: 'A' | 'B', roundIndex: number) => {
    const score = team === 'A' ? m.scoreA : m.scoreB;
    const other = team === 'A' ? m.scoreB : m.scoreA;
    const win = score != null && other != null && score > other;
    return (
      <Pressable
        onPress={() => openEdit(roundIndex, m, team)}
        disabled={locked}
        style={[styles.scoreChip, win && styles.scoreChipWin, score != null && !win && styles.scoreChipFilled]}
      >
        <Text style={[styles.scoreChipText, win && { color: colors.courtNavy }]}>{score ?? '–'}</Text>
      </Pressable>
    );
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headRow}>
            <IconButton name="chevron-back" onPress={() => nav.navigate('MainTabs')} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.pill, locked && styles.endedPill]}>
                {!locked && <LivePulseDot />}
                <Text style={[styles.pillText, locked && { color: colors.textMuted }]}>{locked ? 'GROUPS DONE' : 'GROUP STAGE'}</Text>
              </View>
              <IconButton name="ellipsis-horizontal" size={38} onPress={() => nav.navigate('EditEvent', { eventId: event.id })} />
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {event.name}
          </Text>
          <Text style={styles.meta}>
            Tournament Mode · {event.players.length} players · {cfg.groups.length} groups · top {cfg.advanceCount} advance
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {tables.map((t, i) => (
            <Pressable key={t.group.id} onPress={() => setGroupIdx(i)} style={[styles.tab, i === safeIdx && styles.tabOn]}>
              <Text style={[styles.tabText, i === safeIdx && styles.tabTextOn]}>{t.group.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
          {locked && (
            <Pressable style={styles.lockedBanner} onPress={() => nav.navigate('Knockout', { eventId: event.id })}>
              <Ionicons name="git-network-outline" size={18} color={colors.lime} />
              <Text style={styles.lockedText}>Knockout stage has started — tap to open the bracket</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          )}

          {current && (
            <>
              <Text style={styles.sectionLabel}>{current.group.name} · standings</Text>
              <View style={styles.tableCard}>
                <View style={styles.tHead}>
                  <Text style={[styles.th, { width: 30 }]}>#</Text>
                  <Text style={[styles.th, { flex: 1 }]}>Player</Text>
                  <Text style={[styles.th, styles.num]}>P</Text>
                  <Text style={[styles.th, styles.num]}>W</Text>
                  <Text style={[styles.th, styles.num]}>D</Text>
                  <Text style={[styles.th, styles.num]}>L</Text>
                  <Text style={[styles.th, styles.numWide]}>+/-</Text>
                  <Text style={[styles.th, styles.numWide, { textAlign: 'right' }]}>Pts</Text>
                </View>
                {current.table.map((row, ri) => {
                  const advancing = row.rank <= cfg.advanceCount;
                  // Explain the order against whoever sits directly above/below on the same points.
                  const tiebreakEntries: TiebreakEntry[] = [current.table[ri - 1], current.table[ri + 1]].flatMap((nb) => {
                    const reason = nb ? row.tieReasons[nb.player.id] : undefined;
                    return nb && reason ? [{ neighborName: nb.player.name, text: groupTieSentence(row.player.name, nb.player.name, reason) }] : [];
                  });
                  const lastAdvancing = row.rank === cfg.advanceCount && row.rank < current.table.length;
                  return (
                    <View key={row.player.id}>
                      <View style={[styles.tRow, advancing && styles.tRowAdv]}>
                        <View style={[styles.rankBadge, advancing && styles.rankBadgeAdv]}>
                          <Text style={[styles.rankText, advancing && { color: colors.courtNavy }]}>{row.rank}</Text>
                        </View>
                        <View style={styles.tNameWrap}>
                          <Text style={styles.tName}>{row.player.name}</Text>
                          {tiebreakEntries.length > 0 && (
                            <Pressable
                              hitSlop={8}
                              onPress={() => setTiebreakInfo({ playerName: row.player.name, points: row.points, entries: tiebreakEntries })}
                            >
                              <Ionicons name="alert-circle" size={14} color={colors.amber} />
                            </Pressable>
                          )}
                        </View>
                        <Text style={[styles.tCell, styles.num]}>{row.played}</Text>
                        <Text style={[styles.tCell, styles.num, { fontWeight: '800' }]}>{row.wins}</Text>
                        <Text style={[styles.tCell, styles.num]}>{row.draws}</Text>
                        <Text style={[styles.tCell, styles.num]}>{row.losses}</Text>
                        <Text style={[styles.tCell, styles.numWide, { color: colors.textMuted }]}>{row.diff > 0 ? `+${row.diff}` : row.diff}</Text>
                        <Text style={[styles.tPts, styles.numWide, advancing && { color: colors.lime }]}>{row.points}</Text>
                      </View>
                      {lastAdvancing && (
                        <View style={styles.cutLine}>
                          <Text style={styles.cutText}>advance to knockout ↑</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.rule}>Win 3 · Tie 1 · Loss 0. Level on points → head-to-head, then score difference.</Text>

              <Text style={styles.sectionLabel}>
                {current.group.name} · matches ({groupProgress.played}/{groupProgress.total})
              </Text>
              {matchdays.map((d) => (
                <View key={d.index} style={{ marginBottom: 10 }}>
                  <Text style={styles.dayLabel}>Matchday {d.index}</Text>
                  {d.matches.map((m) => {
                    const done = m.scoreA != null && m.scoreB != null;
                    return (
                      <View key={m.courtId} style={[styles.matchCard, done && styles.matchCardDone]}>
                        <Text style={styles.matchName}>{nameOf(m.teamA[0])}</Text>
                        {scoreChip(m, 'A', d.index)}
                        <Text style={styles.vs}>vs</Text>
                        {scoreChip(m, 'B', d.index)}
                        <Text style={[styles.matchName, { textAlign: 'right' }]}>{nameOf(m.teamB[0])}</Text>
                      </View>
                    );
                  })}
                  {(() => {
                    const bye = groupStageRounds(event)
                      .find((r) => r.index === d.index)
                      ?.sitOuts.filter((id) => current.group.playerIds.includes(id));
                    return bye && bye.length > 0 ? <Text style={styles.byeText}>Bye: {bye.map((id) => nameOf(id)).join(', ')}</Text> : null;
                  })()}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.progress}>
            {progress.played} of {progress.total} group matches played
          </Text>
          {locked ? (
            <Button label="Open knockout bracket" icon="git-network-outline" iconPosition="left" onPress={() => nav.navigate('Knockout', { eventId: event.id })} />
          ) : (
            <Button
              label={complete ? 'Start knockout stage' : 'Finish all group matches to continue'}
              icon="flag-outline"
              iconPosition="left"
              onPress={onStartKnockout}
              disabled={!complete}
              loading={starting}
            />
          )}
          <View style={{ marginTop: 10 }}>
            <Button label="Share live" variant="secondary" icon="share-social-outline" iconPosition="left" loading={shareBusy} onPress={onShareLive} />
          </View>
        </View>

        <ScoreKeypad
          visible={!!edit}
          title={edit ? `Enter score · Player ${edit.team === 'A' ? '1' : '2'}` : ''}
          scoringMode="free"
          pot={event.pot}
          buffer={buffer}
          oppLabel=""
          onDigit={(d) => setBuffer((b) => (b + d).slice(0, 2))}
          onDelete={() => setBuffer((b) => b.slice(0, -1))}
          onConfirm={confirmScore}
          onClose={() => {
            setEdit(null);
            setBuffer('');
          }}
          onClear={clearMatch}
        />

        <QrCodeModal visible={!!qrUrl} url={qrUrl ?? ''} onClose={() => setQrUrl(null)} />

        <TiebreakInfoModal
          visible={!!tiebreakInfo}
          playerName={tiebreakInfo?.playerName ?? ''}
          points={tiebreakInfo?.points ?? 0}
          entries={tiebreakInfo?.entries ?? []}
          onClose={() => setTiebreakInfo(null)}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    safe: { flex: 1 },
    header: { paddingHorizontal: 22, paddingTop: 6 },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: colors.limeTint, borderWidth: 1, borderColor: colors.limeTintBorder },
    endedPill: { backgroundColor: colors.white06, borderColor: colors.hairlineStrong },
    pillText: { fontSize: 12, fontWeight: '800', color: colors.lime, letterSpacing: 0.5 },
    title: { marginTop: 14, fontSize: 23, fontWeight: '900', letterSpacing: -0.6, color: colors.textPrimary },
    meta: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 3 },
    tabsScroll: { flexGrow: 0, marginTop: 14 },
    tabs: { paddingHorizontal: 22, gap: 8 },
    tab: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairline },
    tabOn: { backgroundColor: colors.surface, borderColor: colors.lime },
    tabText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
    tabTextOn: { color: colors.lime },
    body: { padding: 22, paddingTop: 8, paddingBottom: 16 },
    lockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.limeTint, borderWidth: 1, borderColor: colors.limeTintBorder, marginBottom: 8 },
    lockedText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    sectionLabel: { marginTop: 14, marginBottom: 10, fontSize: 12, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: colors.textFaint },
    tableCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.hairline, padding: 10 },
    tHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 6, gap: 6 },
    th: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textFaint },
    num: { width: 22, textAlign: 'center' },
    numWide: { width: 34, textAlign: 'center' },
    tRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
    tRowAdv: { backgroundColor: 'rgba(198,234,59,.07)' },
    rankBadge: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.white06, alignItems: 'center', justifyContent: 'center', marginRight: 0 },
    rankBadgeAdv: { backgroundColor: colors.lime },
    rankText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
    tNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    tName: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    tCell: { fontSize: 13, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    tPts: { fontSize: 15, fontWeight: '900', color: colors.textPrimary, textAlign: 'right', fontVariant: ['tabular-nums'] },
    cutLine: { alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: colors.limeTintBorder, marginBottom: 4 },
    cutText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.lime, opacity: 0.8 },
    rule: { marginTop: 8, fontSize: 11.5, lineHeight: 16, color: colors.textFaint },
    dayLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.blueText, marginBottom: 8 },
    matchCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.hairline, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
    matchCardDone: { borderColor: colors.hairlineStrong },
    matchName: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
    vs: { fontSize: 11, fontWeight: '700', color: colors.textFaint },
    scoreChip: { minWidth: 38, height: 38, borderRadius: 10, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    scoreChipFilled: { backgroundColor: colors.surface2 },
    scoreChipWin: { backgroundColor: colors.lime, borderColor: colors.lime },
    scoreChipText: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    byeText: { fontSize: 12, color: colors.textFaint, marginTop: 0, marginBottom: 4 },
    footer: { paddingHorizontal: 22, paddingBottom: 22, paddingTop: 8 },
    progress: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginBottom: 10 },
  });
