import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { GenderToggle } from '../../components/GenderToggle';
import { ScreenBackground, StepHeader } from '../../components/Misc';
import { useDraft } from '../../data/draft';
import { useEvents } from '../../data/store';
import { makeId } from '../../lib/id';
import { estimateRoundsForMatchesPerPlayer, knockoutRoundName, matchesPerPlayerIsFeasible, startEvent } from '../../lib/tournament';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme/tokens';
import type { Gender, WowEvent } from '../../types';

const MAX_PLAYERS = 48;

export function CreatePlayersScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setDraft } = useDraft();
  const { addEvent } = useEvents();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const isTeamMode = draft.format === 'team_americano';
  const isKnockout = draft.format === 'knockout';
  const showGender = !isTeamMode && !isKnockout;

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed || draft.players.length >= MAX_PLAYERS) return;
    let gender: Gender = 'M';
    if (showGender) {
      const lastGender: Gender = draft.players.length > 0 ? draft.players[draft.players.length - 1].gender : 'F';
      gender = lastGender === 'M' ? 'F' : 'M';
    }
    setDraft((d) => ({ ...d, players: [...d.players, { id: makeId('player'), name: trimmed, gender }] }));
    setName('');
  };

  const setGender = (id: string, gender: Gender) => {
    setDraft((d) => ({ ...d, players: d.players.map((p) => (p.id === id ? { ...p, gender } : p)) }));
  };

  const removePlayer = (id: string) => {
    setDraft((d) => ({ ...d, players: d.players.filter((p) => p.id !== id) }));
  };

  const minRequired = isTeamMode ? 2 : isKnockout ? 3 : 4;

  const matchesPerPlayer = draft.matchesPerPlayer;
  const matchesInputText = matchesPerPlayer != null ? String(matchesPerPlayer) : '';
  const setMatchesInputText = (t: string) => {
    const digits = t.replace(/[^0-9]/g, '');
    setDraft((d) => ({ ...d, matchesPerPlayer: digits === '' ? undefined : Number(digits) }));
  };
  const matchesFeasible = matchesPerPlayer == null || matchesPerPlayerIsFeasible(draft.format, draft.players, matchesPerPlayer);
  const estimatedRounds =
    !isKnockout && matchesPerPlayer != null && matchesFeasible && draft.players.length >= minRequired
      ? estimateRoundsForMatchesPerPlayer(draft.format, draft.players, draft.courts, matchesPerPlayer)
      : null;

  const canGenerate = draft.players.length >= minRequired && !busy && (isKnockout || matchesFeasible);

  let bracketHint = 'Add at least 3 players to build a bracket.';
  if (isKnockout && draft.players.length >= minRequired) {
    let size = 2;
    while (size < draft.players.length) size *= 2;
    size = Math.max(4, size);
    const startName = knockoutRoundName(size);
    const byes = size - draft.players.length;
    bracketHint = `Starts at ${startName}${byes > 0 ? ` · ${byes} bye${byes === 1 ? '' : 's'}` : ''}`;
  }

  const onGenerate = async () => {
    if (!canGenerate) return;
    setBusy(true);
    const base: WowEvent = {
      id: makeId('event'),
      name: draft.name || 'Untitled event',
      format: draft.format,
      scoringMode: isKnockout ? 'free' : draft.scoringMode,
      pot: draft.pot,
      courts: draft.courts,
      players: draft.players,
      rounds: [],
      totalRoundsEstimate: 0,
      currentRoundIndex: 1,
      status: 'draft',
      createdAt: Date.now(),
      resultBgIndex: 0,
    };
    const live = startEvent(base, draft.numRounds, isKnockout ? undefined : matchesPerPlayer);
    await addEvent(live);
    const dest = isKnockout ? 'Knockout' : 'Dashboard';
    nav.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: dest, params: { eventId: live.id } }] });
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StepHeader step={isKnockout ? 3 : 5} total={isKnockout ? 3 : 5} onBack={() => nav.goBack()} />
        <View style={styles.headRow}>
          <Text style={styles.title}>{isTeamMode ? 'Add teams' : 'Add players'}</Text>
          <Text style={styles.counter}>
            {draft.players.length} <Text style={styles.counterMax}>/ {MAX_PLAYERS}</Text>
          </Text>
        </View>
        {isTeamMode && <Text style={styles.hint}>Each entry is a complete team — e.g. "Leon & Sinta".</Text>}
        {isKnockout && <Text style={styles.hint}>{bracketHint}</Text>}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={isTeamMode ? 'Team name…' : 'Player name…'}
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={addPlayer}
            returnKeyType="done"
          />
          <Pressable style={styles.addBtn} onPress={addPlayer}>
            <Ionicons name="add" size={22} color={colors.courtNavy} />
          </Pressable>
        </View>

        <FlatList
          data={draft.players}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isTeamMode
                ? 'Add at least 2 teams to generate rounds.'
                : isKnockout
                  ? 'Add at least 3 players to build a bracket.'
                  : 'Add at least 4 players to generate rounds.'}
            </Text>
          }
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.idx}>{index + 1}</Text>
              <Avatar name={item.name} gender={item.gender} />
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {showGender && <GenderToggle value={item.gender} onChange={(g) => setGender(item.id, g)} />}
              <Pressable onPress={() => removePlayer(item.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
          )}
        />

        {!isKnockout && (
          <View style={styles.matchesSection}>
            <View style={styles.matchesRow}>
              <Text style={styles.matchesLabel}>{isTeamMode ? 'Matches per team' : 'Matches per player'} (optional)</Text>
              <TextInput
                style={styles.matchesInput}
                value={matchesInputText}
                onChangeText={setMatchesInputText}
                placeholder="Auto"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
            {matchesPerPlayer == null && (
              <Text style={styles.matchesHint}>Leave blank to keep the {draft.numRounds} rounds from the previous step.</Text>
            )}
            {matchesPerPlayer != null && !matchesFeasible && (
              <Text style={[styles.matchesHint, { color: colors.amber }]}>
                Can't split {draft.players.length} {isTeamMode ? 'teams' : 'players'} into exactly {matchesPerPlayer} match{matchesPerPlayer === 1 ? '' : 'es'} each — try a different number.
              </Text>
            )}
            {estimatedRounds != null && (
              <Text style={styles.matchesHint}>
                → {estimatedRounds} rounds so every {isTeamMode ? 'team' : 'player'} gets exactly {matchesPerPlayer} match{matchesPerPlayer === 1 ? '' : 'es'}, even if that leaves a court idle in the last round.
              </Text>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Button label={isKnockout ? 'Build bracket' : 'Generate rounds'} icon="chevron-forward" onPress={onGenerate} disabled={!canGenerate} loading={busy} />
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headRow: { paddingHorizontal: 24, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  counter: { fontSize: 15, fontWeight: '800', color: colors.lime, fontVariant: ['tabular-nums'] },
  counterMax: { color: colors.textFaint, fontWeight: '700' },
  hint: { paddingHorizontal: 24, marginTop: 6, fontSize: 12, color: colors.textFaint },
  inputRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  addBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 12, gap: 9, flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 24, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  idx: { fontSize: 12, fontWeight: '800', color: colors.textFaint, width: 16, fontVariant: ['tabular-nums'] },
  name: { flex: 1, fontWeight: '700', fontSize: 15, color: colors.textPrimary },
  matchesSection: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 4 },
  matchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  matchesLabel: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textFaint },
  matchesInput: {
    width: 64,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 10,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  matchesHint: { marginTop: 6, fontSize: 11, color: colors.textFaint, lineHeight: 15 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
});
