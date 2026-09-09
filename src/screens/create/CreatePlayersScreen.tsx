import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { GenderToggle } from '../../components/GenderToggle';
import { ImportReclubModal } from '../../components/ImportReclubModal';
import { ScreenBackground, StepHeader } from '../../components/Misc';
import { useDraft } from '../../data/draft';
import { useEvents } from '../../data/store';
import { makeId } from '../../lib/id';
import { estimateRoundsForMatchesPerPlayer, isTeamFormat, knockoutRoundName, matchesPerPlayerIsFeasible, startEvent } from '../../lib/tournament';
import type { RootStackParamList } from '../../navigation/types';
import type { ColorPalette } from '../../theme/tokens';
import { radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import type { Gender, Player, WowEvent } from '../../types';

const MAX_PLAYERS = 48;

export function CreatePlayersScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setDraft } = useDraft();
  const { addEvent } = useEvents();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string[]>([]);

  const isTeamMode = isTeamFormat(draft.format);
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

  const importNames = (imported: string[]) => {
    setDraft((d) => {
      const existing = new Set(d.players.map((p) => p.name.trim().toLowerCase()));
      let lastGender: Gender = d.players.length > 0 ? d.players[d.players.length - 1].gender : 'F';
      let slotsLeft = MAX_PLAYERS - d.players.length;
      const added: Player[] = [];
      for (const raw of imported) {
        if (slotsLeft <= 0) break;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (existing.has(key)) continue;
        existing.add(key);
        slotsLeft--;
        lastGender = showGender ? (lastGender === 'M' ? 'F' : 'M') : 'M';
        added.push({ id: makeId('player'), name: trimmed, gender: lastGender });
      }
      return { ...d, players: [...d.players, ...added] };
    });
    setShowImport(false);
  };

  const setGender = (id: string, gender: Gender) => {
    setDraft((d) => ({ ...d, players: d.players.map((p) => (p.id === id ? { ...p, gender } : p)) }));
  };

  const removePlayer = (id: string) => {
    setDraft((d) => ({ ...d, players: d.players.filter((p) => p.id !== id) }));
    setSelectedForLink((prev) => prev.filter((pid) => pid !== id));
  };

  const toggleSelectForLink = (id: string) => {
    setSelectedForLink((prev) => {
      if (prev.includes(id)) return prev.filter((pid) => pid !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const linkSelected = () => {
    if (selectedForLink.length !== 2) return;
    setDraft((d) => {
      const a = d.players.find((p) => p.id === selectedForLink[0]);
      const b = d.players.find((p) => p.id === selectedForLink[1]);
      if (!a || !b) return d;
      const firstIndex = d.players.findIndex((p) => p.id === a.id);
      const merged: Player = { id: makeId('player'), name: `${a.name} & ${b.name}`, gender: 'M' };
      const rest = d.players.filter((p) => p.id !== a.id && p.id !== b.id);
      const insertAt = Math.min(firstIndex, rest.length);
      const players = [...rest.slice(0, insertAt), merged, ...rest.slice(insertAt)];
      return { ...d, players };
    });
    setSelectedForLink([]);
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

        <Pressable style={styles.importRow} onPress={() => setShowImport(true)}>
          <Ionicons name="cloud-download-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.importText}>Import from Reclub</Text>
        </Pressable>

        {isTeamMode && (
          <View style={styles.linkBar}>
            <Text style={styles.linkHint}>
              {selectedForLink.length === 2
                ? '2 selected'
                : selectedForLink.length === 1
                  ? '1 selected — tap another entry to pair'
                  : 'Tap 2 entries below to merge them into one team'}
            </Text>
            <Pressable
              style={[styles.linkBtn, selectedForLink.length === 2 ? styles.linkBtnOn : styles.linkBtnOff]}
              onPress={linkSelected}
              disabled={selectedForLink.length !== 2}
            >
              <Text style={[styles.linkBtnText, selectedForLink.length === 2 && styles.linkBtnTextOn]}>Link as team</Text>
            </Pressable>
          </View>
        )}

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
          renderItem={({ item, index }) => {
            const isSelected = selectedForLink.includes(item.id);
            return (
              <View style={[styles.row, isTeamMode && isSelected && styles.rowSelected]}>
                {isTeamMode ? (
                  <Pressable
                    onPress={() => toggleSelectForLink(item.id)}
                    style={[styles.checkbox, isSelected && styles.checkboxOn]}
                    hitSlop={6}
                  >
                    {isSelected && <Ionicons name="checkmark" size={13} color={colors.courtNavy} />}
                  </Pressable>
                ) : (
                  <Text style={styles.idx} numberOfLines={1}>
                    {index + 1}
                  </Text>
                )}
                <Avatar name={item.name} gender={item.gender} />
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {showGender && <GenderToggle value={item.gender} onChange={(g) => setGender(item.id, g)} />}
                <Pressable onPress={() => removePlayer(item.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                  <Ionicons name="close" size={16} color={colors.textFaint} />
                </Pressable>
              </View>
            );
          }}
        />

        <ImportReclubModal visible={showImport} isTeamMode={isTeamMode} onClose={() => setShowImport(false)} onImport={importNames} />

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
              <Text style={styles.matchesHint}>Leave blank to play {draft.numRounds} rounds by default.</Text>
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

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  safe: { flex: 1 },
  headRow: { paddingHorizontal: 24, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  counter: { fontSize: 15, fontWeight: '800', color: colors.lime, fontVariant: ['tabular-nums'] },
  counterMax: { color: colors.textFaint, fontWeight: '700' },
  hint: { paddingHorizontal: 24, marginTop: 6, fontSize: 12, color: colors.textFaint },
  inputRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  importRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingBottom: 8 },
  importText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  linkBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingBottom: 10 },
  linkHint: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textFaint },
  linkBtn: { height: 34, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkBtnOn: { backgroundColor: colors.lime },
  linkBtnOff: { backgroundColor: colors.white06 },
  linkBtnText: { fontSize: 12, fontWeight: '800', color: colors.textFaint },
  linkBtnTextOn: { color: colors.courtNavy },
  rowSelected: { borderColor: colors.lime },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.lime, borderWidth: 0 },
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
  idx: { fontSize: 12, fontWeight: '800', color: colors.textFaint, width: 20, flexShrink: 0, textAlign: 'center', fontVariant: ['tabular-nums'] },
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
