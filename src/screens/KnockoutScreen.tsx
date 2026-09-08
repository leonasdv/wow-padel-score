import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Button } from '../components/Button';
import { IconButton, LivePulseDot, ScreenBackground } from '../components/Misc';
import { ScoreKeypad } from '../components/ScoreKeypad';
import { WowLogo } from '../components/WowLogo';
import { useEvents } from '../data/store';
import { shareOrCopyLink } from '../lib/clipboard';
import { publishEvent, shareUrlFor } from '../lib/share';
import { clearKnockoutScore, clearThirdPlaceScore, knockoutRoundName, replaceParticipant, setKnockoutScore, setThirdPlaceScore } from '../lib/tournament';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius } from '../theme/tokens';
import type { Match } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'Knockout'>;

// Bracket geometry — each later round's cards are spaced to sit between their two feeders.
const CARD_H = 72;
const GAP0 = 18;
const UNIT = CARD_H + GAP0;
const COL_W = 190;

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function KnockoutScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { getEvent, updateEvent } = useEvents();
  const event = getEvent(route.params.eventId);

  const [edit, setEdit] = useState<{ roundIndex: number; matchIndex: number; team: 'A' | 'B' } | null>(null);
  const [buffer, setBuffer] = useState('');
  const [rename, setRename] = useState<{ id: string; text: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const bracketShotRef = useRef<ViewShotRef>(null);

  if (!event) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <Text style={{ color: colors.textPrimary, padding: 24 }}>Event not found.</Text>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const nameOf = (id: string | undefined) => (id ? event.players.find((p) => p.id === id)?.name ?? '—' : undefined);

  const openEdit = (roundIndex: number, matchIndex: number, m: Match, team: 'A' | 'B', isFirstRound: boolean) => {
    // Can only score a match once both competitors are known (byes resolve automatically).
    if (!m.teamA[0] || !m.teamB[0]) return;
    const cur = team === 'A' ? m.scoreA : m.scoreB;
    setEdit({ roundIndex, matchIndex, team });
    setBuffer(cur != null ? String(cur) : '');
  };

  const confirmScore = async () => {
    if (!edit) return;
    const value = buffer === '' ? 0 : Number(buffer);
    // roundIndex === -1 is the sentinel for the 3rd-place playoff (stored outside `rounds`).
    if (edit.roundIndex === -1) {
      await updateEvent(event.id, (e) => setThirdPlaceScore(e, edit.team, value));
    } else {
      await updateEvent(event.id, (e) => setKnockoutScore(e, edit.roundIndex, edit.matchIndex, edit.team, value));
    }
    setEdit(null);
    setBuffer('');
  };

  const clearMatchScore = () => {
    if (!edit) return;
    const { roundIndex, matchIndex } = edit;
    const isThirdPlace = roundIndex === -1;
    Alert.alert(
      'Clear this score?',
      isThirdPlace
        ? 'Both scores for the 3rd-place playoff go back to unscored.'
        : "Both scores go back to unscored — if this match's winner had already advanced, that later slot clears too.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (isThirdPlace) {
              await updateEvent(event.id, (e) => clearThirdPlaceScore(e));
            } else {
              await updateEvent(event.id, (e) => clearKnockoutScore(e, roundIndex, matchIndex));
            }
            setEdit(null);
            setBuffer('');
          },
        },
      ]
    );
  };

  const openRename = (id: string) => setRename({ id, text: nameOf(id) ?? '' });
  const confirmRename = async () => {
    if (!rename) return;
    const name = rename.text.trim();
    const id = rename.id;
    setRename(null);
    if (!name) return;
    await updateEvent(event.id, (e) => replaceParticipant(e, id, name));
  };

  const champion = event.status === 'done'
    ? nameOf(
        (() => {
          const finalMatch = event.rounds[event.rounds.length - 1].matches[0];
          if (finalMatch.scoreA == null || finalMatch.scoreB == null) return undefined;
          return finalMatch.scoreA > finalMatch.scoreB ? finalMatch.teamA[0] : finalMatch.teamB[0];
        })()
      )
    : undefined;

  const scoreBox = (m: Match, team: 'A' | 'B', roundIndex: number, matchIndex: number, isFirstRound: boolean) => {
    const id = team === 'A' ? m.teamA[0] : m.teamB[0];
    const score = team === 'A' ? m.scoreA : m.scoreB;
    const other = team === 'A' ? m.scoreB : m.scoreA;
    const decided = score != null && other != null && score !== other;
    const isWinner = decided && (score as number) > (other as number);
    const isBye = !!id && (team === 'A' ? !m.teamB[0] : !m.teamA[0]) && isFirstRound;
    const label = id ? shortName(nameOf(id) as string) : 'TBD';
    return (
      <View style={[styles.slot, isWinner && styles.slotWinner]}>
        {/* Tap the name to rename that competitor (only real, entered players). */}
        <Pressable style={styles.slotNameArea} onPress={() => id && openRename(id)} disabled={!id}>
          <Text style={[styles.slotName, !id && styles.slotTbd, isWinner && styles.slotNameWinner]} numberOfLines={1}>
            {label}
          </Text>
          {!!id && <Ionicons name="pencil" size={10} color={isWinner ? colors.lime : colors.textFaint} style={styles.slotEditIcon} />}
        </Pressable>
        {isBye ? (
          <Text style={styles.byeTag}>BYE</Text>
        ) : (
          <Pressable
            onPress={() => openEdit(roundIndex, matchIndex, m, team, isFirstRound)}
            style={[styles.scoreChip, isWinner && styles.scoreChipWinner]}
          >
            <Text style={[styles.scoreChipText, isWinner && { color: colors.courtNavy }]}>{score ?? '–'}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderColumns = () =>
    event.rounds.map((round, ri) => {
      const competitors = round.matches.length * 2;
      const pitch = UNIT * Math.pow(2, ri);
      const paddingTop = pitch / 2 - CARD_H / 2;
      const gap = pitch - CARD_H;
      const isFirstRound = ri === 0;
      return (
        <View key={round.index} style={[styles.col, { width: COL_W }]}>
          <Text style={styles.colTitle}>{knockoutRoundName(competitors)}</Text>
          <View style={{ paddingTop, gap }}>
            {round.matches.map((m, mi) => (
              <View key={mi} style={[styles.card, { height: CARD_H }]}>
                {scoreBox(m, 'A', round.index, mi, isFirstRound)}
                <View style={styles.cardDivider} />
                {scoreBox(m, 'B', round.index, mi, isFirstRound)}
              </View>
            ))}
          </View>
        </View>
      );
    });

  const renderThirdPlace = (wrapStyle: object) =>
    event.thirdPlaceMatch ? (
      <View style={wrapStyle}>
        <Text style={styles.thirdLabel}>🥉 3rd Place Playoff</Text>
        <View style={[styles.card, { height: CARD_H, width: COL_W }]}>
          {scoreBox(event.thirdPlaceMatch, 'A', -1, 0, false)}
          <View style={styles.cardDivider} />
          {scoreBox(event.thirdPlaceMatch, 'B', -1, 0, false)}
        </View>
      </View>
    ) : null;

  const onShareLive = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      let target = event;
      if (!target.shareId) {
        const published = await publishEvent(target);
        await updateEvent(event.id, () => published);
        target = published;
      }
      await shareOrCopyLink(shareUrlFor(target.shareId!));
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? 'Could not create the share link. Check your connection and try again.');
    } finally {
      setShareBusy(false);
    }
  };

  const shareBracket = async () => {
    if (!bracketShotRef.current || sharing) return;
    setSharing(true);
    try {
      const uri = await bracketShotRef.current.capture!();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share bracket' });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not supported on this device.');
      }
    } catch {
      Alert.alert('Something went wrong', 'Could not generate the bracket image.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headRow}>
            <IconButton name="chevron-back" onPress={() => nav.navigate('MainTabs')} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable style={[styles.pill, event.status !== 'live' && styles.endedPill]}>
                {event.status === 'live' && <LivePulseDot />}
                <Text style={[styles.pillText, event.status !== 'live' && { color: colors.textMuted }]}>
                  {event.status === 'live' ? 'LIVE' : 'FINISHED'}
                </Text>
              </Pressable>
              <IconButton name="share-social-outline" size={38} onPress={shareBracket} />
              <IconButton name="ellipsis-horizontal" size={38} onPress={() => nav.navigate('EditEvent', { eventId: event.id })} />
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {event.name}
          </Text>
          <Text style={styles.meta}>Knockout · {event.players.length} players</Text>
        </View>

        {champion && (
          <View style={styles.champBanner}>
            <Ionicons name="trophy" size={18} color={colors.gold} />
            <Text style={styles.champText}>Champion: {champion}</Text>
          </View>
        )}

        <ScrollView style={styles.vscroll} contentContainerStyle={{ paddingBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bracket}>
            {renderColumns()}
          </ScrollView>

          {renderThirdPlace(styles.thirdWrap)}
        </ScrollView>

        {/* Off-screen full-size copy of the whole bracket (every round + 3rd place, no scroll clipping) captured for sharing — nothing gets cropped regardless of how wide the on-screen bracket is. */}
        <View style={styles.exportHiddenWrap} pointerEvents="none">
          <ViewShot ref={bracketShotRef} options={{ format: 'png', quality: 1 }}>
            <View style={styles.exportCard}>
              <View style={styles.exportHeadRow}>
                <WowLogo size={22} />
                <Text style={styles.exportEventName} numberOfLines={1}>
                  {event.name}
                </Text>
              </View>
              <Text style={styles.exportMeta}>Knockout Bracket · {event.players.length} players</Text>
              {champion && (
                <View style={styles.exportChampBanner}>
                  <Ionicons name="trophy" size={16} color={colors.gold} />
                  <Text style={styles.exportChampText}>Champion: {champion}</Text>
                </View>
              )}
              <View style={styles.exportBracketRow}>{renderColumns()}</View>
              {renderThirdPlace(styles.exportThirdWrap)}
            </View>
          </ViewShot>
        </View>

        <View style={styles.footer}>
          {event.status === 'done' ? (
            <View style={styles.footerRow}>
              <View style={{ flex: 1 }}>
                <Button
                  label="View results & share"
                  icon="trophy-outline"
                  iconPosition="left"
                  onPress={() => nav.navigate('ResultCard', { eventId: event.id })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Share live" variant="secondary" icon="share-social-outline" iconPosition="left" loading={shareBusy} onPress={onShareLive} />
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.footerHint}>Tap a competitor's score box to enter results. Winners advance automatically.</Text>
              <View style={{ marginTop: 10 }}>
                <Button label="Share live" variant="secondary" icon="share-social-outline" iconPosition="left" loading={shareBusy} onPress={onShareLive} />
              </View>
            </>
          )}
        </View>

        <ScoreKeypad
          visible={!!edit}
          title={edit ? `Enter score · Team ${edit.team}` : ''}
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
          onClear={clearMatchScore}
        />

        <Modal visible={!!rename} transparent animationType="fade" onRequestClose={() => setRename(null)}>
          <Pressable style={styles.renameBackdrop} onPress={() => setRename(null)} />
          <View style={styles.renameCenter}>
            <View style={styles.renameCard}>
              <Text style={styles.renameLabel}>Edit competitor</Text>
              <TextInput
                style={styles.renameInput}
                value={rename?.text ?? ''}
                onChangeText={(t) => setRename((r) => (r ? { ...r, text: t } : r))}
                placeholder="Name"
                placeholderTextColor={colors.textFaint}
                autoFocus
                onSubmitEditing={confirmRename}
                returnKeyType="done"
              />
              <View style={styles.renameActions}>
                <Pressable style={styles.renameCancel} onPress={() => setRename(null)}>
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.renameSave} onPress={confirmRename}>
                  <Text style={styles.renameSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  exportHiddenWrap: { position: 'absolute', top: 0, left: 0, opacity: 0 },
  exportCard: { backgroundColor: colors.courtNavy, padding: 24 },
  exportHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportEventName: { fontSize: 18, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },
  exportMeta: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 4, marginBottom: 16 },
  exportChampBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,211,78,.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,78,.3)',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  exportChampText: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  exportBracketRow: { flexDirection: 'row' },
  exportThirdWrap: { paddingTop: 16 },
  header: { paddingHorizontal: 22, paddingTop: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: colors.limeTint, borderWidth: 1, borderColor: colors.limeTintBorder },
  endedPill: { backgroundColor: colors.white06, borderColor: colors.hairlineStrong },
  pillText: { fontSize: 12, fontWeight: '800', color: colors.lime, letterSpacing: 0.5 },
  title: { marginTop: 14, fontSize: 23, fontWeight: '900', letterSpacing: -0.6, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 3 },
  champBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 22, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,211,78,.12)', borderWidth: 1, borderColor: 'rgba(255,211,78,.3)' },
  champText: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  vscroll: { flex: 1 },
  bracket: { padding: 22, paddingTop: 16 },
  thirdWrap: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 8 },
  thirdLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.bronze, marginBottom: 10 },
  col: { marginRight: 8 },
  colTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.lime, marginBottom: 10, height: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden', justifyContent: 'center' },
  cardDivider: { height: 1, backgroundColor: colors.hairline },
  slot: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  slotWinner: { backgroundColor: 'rgba(198,234,59,.10)' },
  slotNameArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  slotName: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  slotNameWinner: { color: colors.lime },
  slotEditIcon: { opacity: 0.6 },
  slotTbd: { color: colors.textFaint, fontStyle: 'italic', fontWeight: '600' },
  byeTag: { fontSize: 10, fontWeight: '800', color: colors.textFaint, letterSpacing: 1 },
  scoreChip: { minWidth: 30, height: 30, borderRadius: 8, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  scoreChipWinner: { backgroundColor: colors.lime, borderColor: colors.lime },
  scoreChipText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  footer: { paddingHorizontal: 22, paddingBottom: 22, paddingTop: 8 },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerHint: { fontSize: 12, color: colors.textFaint, textAlign: 'center', lineHeight: 17 },
  renameBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,25,.6)' },
  renameCenter: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  renameCard: { backgroundColor: '#12274a', borderRadius: 20, borderWidth: 1, borderColor: colors.hairlineStrong, padding: 22 },
  renameLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 10 },
  renameInput: { height: 52, borderRadius: 14, backgroundColor: colors.surfaceSunken, borderWidth: 1.5, borderColor: colors.lime, paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  renameActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  renameCancel: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairlineStrong },
  renameCancelText: { fontWeight: '700', fontSize: 14, color: colors.textMuted },
  renameSave: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
  renameSaveText: { fontWeight: '800', fontSize: 14, color: colors.courtNavy },
});
