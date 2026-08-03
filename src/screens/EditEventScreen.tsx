import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddPlayerModal } from '../components/AddPlayerModal';
import { RenameModal } from '../components/RenameModal';
import { Avatar } from '../components/Avatar';
import { ScreenBackground } from '../components/Misc';
import { useEvents } from '../data/store';
import { makeId } from '../lib/id';
import { addPlayerMidEvent, isRankingBased, minPlayersFor, removePlayer } from '../lib/tournament';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius } from '../theme/tokens';
import type { Gender } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'EditEvent'>;

export function EditEventScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { getEvent, updateEvent } = useEvents();
  const event = getEvent(route.params.eventId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<'event' | 'court' | 'player'>('player');
  const [editInitial, setEditInitial] = useState('');
  const [addPlayerVisible, setAddPlayerVisible] = useState(false);

  if (!event) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <Text style={{ color: colors.textPrimary, padding: 24 }}>Event not found.</Text>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const startRenameEvent = () => {
    setEditTarget('event');
    setEditInitial(event.name);
    setEditingId(event.id);
  };

  const startRenameCourt = (id: string, current: string) => {
    setEditTarget('court');
    setEditInitial(current);
    setEditingId(id);
  };

  const startRenamePlayer = (id: string, current: string) => {
    setEditTarget('player');
    setEditInitial(current);
    setEditingId(id);
  };

  const onSaveEdit = async (value: string) => {
    const id = editingId;
    const target = editTarget;
    setEditingId(null);
    if (!id) return;
    const name = value.trim();
    if (!name) return;
    if (target === 'event') {
      await updateEvent(event.id, (e) => ({ ...e, name }));
    } else if (target === 'court') {
      await updateEvent(event.id, (e) => ({ ...e, courts: e.courts.map((c) => (c.id === id ? { ...c, name } : c)) }));
    } else {
      await updateEvent(event.id, (e) => ({ ...e, players: e.players.map((p) => (p.id === id ? { ...p, name } : p)) }));
    }
  };

  const entityWord = event.format === 'team_americano' ? 'team' : 'player';
  const minPlayers = minPlayersFor(event.format);
  const isKnockout = event.format === 'knockout';
  // Knockout brackets are fixed at creation — adding/removing entrants isn't supported once built.
  const canEditRoster = event.status === 'live' && !isKnockout;

  const onDeletePlayer = (id: string, name: string) => {
    if (event.players.length <= minPlayers) {
      Alert.alert(`Can't remove ${entityWord}`, `This event needs at least ${minPlayers} ${entityWord}s to keep running.`);
      return;
    }
    Alert.alert(`Remove ${name}?`, `They'll be taken out of the roster and every upcoming round will be regenerated without them. Completed rounds keep their recorded scores.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => updateEvent(event.id, (e) => removePlayer(e, id)) },
    ]);
  };
  const regenerationText = isRankingBased(event.format)
    ? `Adding a ${entityWord} now will affect pairings once Round ${event.currentRoundIndex} ends. Completed rounds and current standings stay untouched.`
    : `Adding a ${entityWord} now will regenerate upcoming rounds (${event.currentRoundIndex + 1}–${event.totalRoundsEstimate}). Completed rounds and current standings stay untouched.`;

  const onAddPlayer = async (name: string, gender: Gender) => {
    setAddPlayerVisible(false);
    await updateEvent(event.id, (e) => addPlayerMidEvent(e, { id: makeId('player'), name, gender }));
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headRow}>
            <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
              <Ionicons name="chevron-back" size={19} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={() => nav.goBack()}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>Edit event</Text>
          <Text style={styles.subtitle}>Rename the event, courts, and players. Changes apply next round.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionLabel}>Event name</Text>
          <View style={[styles.row, { marginBottom: 24 }]}>
            <Text style={styles.rowText} numberOfLines={1}>
              {event.name}
            </Text>
            <Pressable onPress={startRenameEvent} hitSlop={8}>
              <Ionicons name="create-outline" size={17} color={colors.textFaint} />
            </Pressable>
          </View>

          {!isKnockout && (
            <>
              <Text style={styles.sectionLabel}>Courts</Text>
              <View style={{ gap: 10, marginBottom: 24 }}>
                {event.courts.map((c, i) => (
                  <View key={c.id} style={styles.row}>
                    <Text style={styles.rowIndex}>{i + 1}</Text>
                    <Text style={styles.rowText}>{c.name}</Text>
                    <Pressable onPress={() => startRenameCourt(c.id, c.name)} hitSlop={8}>
                      <Ionicons name="create-outline" size={17} color={colors.textFaint} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.playersHeadRow}>
            <Text style={styles.sectionLabel}>
              {event.format === 'team_americano' ? 'Teams' : 'Players'} · {event.players.length}
            </Text>
            {canEditRoster && (
              <Pressable onPress={() => setAddPlayerVisible(true)}>
                <Text style={styles.addLink}>+ Add</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.editHint}>{canEditRoster ? '🗑 remove · ✎ fix the name' : '✎ fix the name'}</Text>
          <View style={{ gap: 9 }}>
            {event.players.map((p) => (
              <View key={p.id} style={styles.playerRow}>
                <Avatar name={p.name} gender={p.gender} size={32} />
                <Text style={styles.playerName} numberOfLines={1}>
                  {p.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  {canEditRoster && (
                    <Pressable onPress={() => onDeletePlayer(p.id, p.name)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => startRenamePlayer(p.id, p.name)} hitSlop={8}>
                    <Ionicons name="create-outline" size={16} color={colors.textFaint} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <RenameModal
          visible={editingId !== null}
          title={editTarget === 'event' ? 'Rename event' : editTarget === 'court' ? 'Rename court' : `Rename ${entityWord}`}
          label={editTarget === 'event' ? 'Event name' : editTarget === 'court' ? 'Court name' : `${entityWord} name`}
          placeholder={editTarget === 'event' ? 'Event name' : editTarget === 'court' ? 'Court name' : `${entityWord} name`}
          initialValue={editInitial}
          confirmText="Save"
          onClose={() => setEditingId(null)}
          onConfirm={onSaveEdit}
        />

        <AddPlayerModal
          visible={addPlayerVisible}
          regenerationText={regenerationText}
          showGender={event.format !== 'team_americano'}
          onClose={() => setAddPlayerVisible(false)}
          onConfirm={onAddPlayer}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white06, alignItems: 'center', justifyContent: 'center' },
  done: { fontSize: 14, fontWeight: '800', color: colors.lime },
  title: { marginTop: 14, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, color: colors.textPrimary },
  subtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  body: { padding: 22, paddingTop: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 12 },
  playersHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addLink: { fontSize: 13, fontWeight: '800', color: colors.lime },
  editHint: { fontSize: 11, color: colors.textFaint, marginBottom: 12, marginTop: -4 },
  row: { height: 52, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  rowIndex: { fontSize: 12, fontWeight: '800', color: colors.textFaint, width: 16 },
  rowText: { flex: 1, fontWeight: '700', fontSize: 15, color: colors.textPrimary },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: 13, padding: 8, paddingHorizontal: 12 },
  playerName: { flex: 1, fontWeight: '700', fontSize: 14, color: colors.textPrimary },
});
