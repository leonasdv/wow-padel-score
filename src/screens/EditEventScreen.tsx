import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddPlayerModal } from '../components/AddPlayerModal';
import { RenameModal } from '../components/RenameModal';
import { Avatar } from '../components/Avatar';
import { ScreenBackground } from '../components/Misc';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { useEvents } from '../data/store';
import { Alert } from '../lib/alert';
import { copyLinkWithFeedback, shareOrCopyLink } from '../lib/clipboard';
import { makeId } from '../lib/id';
import { editorShareUrlFor, publishEvent, setShareInputSource, shareUrlFor, unpublishEvent } from '../lib/share';
import { addPlayerMidEvent, isRankingBased, isTeamFormat, toggleBench } from '../lib/tournament';
import type { RootStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import type { Gender } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'EditEvent'>;

export function EditEventScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { getEvent, updateEvent } = useEvents();
  const event = getEvent(route.params.eventId);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<'event' | 'court' | 'player'>('player');
  const [editInitial, setEditInitial] = useState('');
  const [addPlayerVisible, setAddPlayerVisible] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [inputSourceBusy, setInputSourceBusy] = useState(false);

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

  const entityWord = isTeamFormat(event.format) ? 'team' : 'player';
  const isKnockout = event.format === 'knockout';
  // Knockout brackets are fixed at creation — adding/removing entrants isn't supported once built.
  const canEditRoster = event.status === 'live' && !isKnockout;

  const regenerationText = isRankingBased(event.format) || event.format === 'team_mexicano'
    ? `Adding a ${entityWord} now will affect pairings once Round ${event.currentRoundIndex} ends. Completed rounds and current standings stay untouched.`
    : `Adding a ${entityWord} now will regenerate upcoming rounds (${event.currentRoundIndex + 1}–${event.totalRoundsEstimate}). Completed rounds and current standings stay untouched.`;

  const onAddPlayer = async (name: string, gender: Gender) => {
    setAddPlayerVisible(false);
    await updateEvent(event.id, (e) => addPlayerMidEvent(e, { id: makeId('player'), name, gender }));
  };

  const onToggleBench = (id: string) => {
    updateEvent(event.id, (e) => toggleBench(e, id));
  };

  const onToggleShare = async (value: boolean) => {
    setShareBusy(true);
    try {
      if (value) {
        const published = await publishEvent(event);
        await updateEvent(event.id, () => published);
      } else {
        const unpublished = await unpublishEvent(event);
        await updateEvent(event.id, () => unpublished);
      }
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? 'Could not update the share link. Check your connection and try again.');
    } finally {
      setShareBusy(false);
    }
  };

  const onShareLink = () => {
    if (!event.shareId) return;
    shareOrCopyLink(shareUrlFor(event.shareId));
  };

  const onCopyLink = async () => {
    if (!event.shareId) return;
    await copyLinkWithFeedback(shareUrlFor(event.shareId));
  };

  const onChangeInputSource = async (source: 'app' | 'web') => {
    if (source === (event.shareInputSource ?? 'app')) return;
    setInputSourceBusy(true);
    try {
      const updated = await setShareInputSource(event, source);
      await updateEvent(event.id, () => updated);
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? "Couldn't switch score entry. Check your connection and try again.");
    } finally {
      setInputSourceBusy(false);
    }
  };

  const editorLink = event.shareId && event.editorToken ? editorShareUrlFor(event.shareId, event.editorToken) : null;

  const onShareEditorLink = () => {
    if (!editorLink) return;
    shareOrCopyLink(editorLink);
  };

  const onCopyEditorLink = async () => {
    if (!editorLink) return;
    await copyLinkWithFeedback(editorLink, 'Score entry link copied to clipboard.');
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

          <Text style={styles.sectionLabel}>Live share link</Text>
          <View style={[styles.row, { marginBottom: event.shareId ? 10 : 24 }]}>
            <Text style={styles.rowText} numberOfLines={1}>
              {event.shareId ? 'Published — anyone with the link can watch live' : 'Publish a read-only link anyone can watch live'}
            </Text>
            <Switch value={!!event.shareId} onValueChange={onToggleShare} disabled={shareBusy} trackColor={{ true: colors.lime }} />
          </View>
          {event.shareId && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              <Pressable style={styles.linkAction} onPress={onCopyLink}>
                <Ionicons name="copy-outline" size={15} color={colors.textPrimary} />
                <Text style={styles.linkActionText}>Copy link</Text>
              </Pressable>
              <Pressable style={styles.linkAction} onPress={onShareLink}>
                <Ionicons name="share-outline" size={15} color={colors.textPrimary} />
                <Text style={styles.linkActionText}>Share</Text>
              </Pressable>
            </View>
          )}

          {event.shareId && !isKnockout && (
            <>
              <Text style={styles.sectionLabel}>Score entry</Text>
              <View style={{ marginBottom: 10 }}>
                <SegmentedTabs
                  options={[
                    { key: 'app', label: 'This app' },
                    { key: 'web', label: 'Web link' },
                  ]}
                  value={event.shareInputSource ?? 'app'}
                  onChange={(k) => onChangeInputSource(k as 'app' | 'web')}
                />
              </View>
              <Text style={styles.editHint}>
                {(event.shareInputSource ?? 'app') === 'app'
                  ? 'Scores are entered from this app. Switch to "Web link" to let someone else enter scores for the current round from their phone instead.'
                  : "Scores are entered from the link below — this app won't accept new scores until you switch back."}
              </Text>
              {(event.shareInputSource ?? 'app') === 'web' && editorLink && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 24 }}>
                  <Pressable style={styles.linkAction} onPress={onCopyEditorLink} disabled={inputSourceBusy}>
                    <Ionicons name="copy-outline" size={15} color={colors.textPrimary} />
                    <Text style={styles.linkActionText}>Copy link</Text>
                  </Pressable>
                  <Pressable style={styles.linkAction} onPress={onShareEditorLink} disabled={inputSourceBusy}>
                    <Ionicons name="share-outline" size={15} color={colors.textPrimary} />
                    <Text style={styles.linkActionText}>Share</Text>
                  </Pressable>
                </View>
              )}
              {(event.shareInputSource ?? 'app') === 'app' && <View style={{ marginBottom: 24 }} />}
            </>
          )}

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
              {isTeamFormat(event.format) ? 'Teams' : 'Players'} · {event.players.length}
            </Text>
            {canEditRoster && (
              <Pressable onPress={() => setAddPlayerVisible(true)}>
                <Text style={styles.addLink}>+ Add</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.editHint}>{canEditRoster ? '⏸ bench · ✎ fix the name' : '✎ fix the name'}</Text>
          <View style={{ gap: 9 }}>
            {event.players.map((p) => (
              <View key={p.id} style={[styles.playerRow, p.benched && styles.playerRowBenched]}>
                <Avatar name={p.name} gender={p.gender} size={32} />
                <Text style={[styles.playerName, p.benched && styles.playerNameBenched]} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.benched && (
                  <View style={styles.benchBadge}>
                    <Text style={styles.benchBadgeText}>⏸ BENCHED</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  {canEditRoster && (
                    <Pressable onPress={() => onToggleBench(p.id)} hitSlop={8}>
                      <Ionicons
                        name={p.benched ? 'play-circle-outline' : 'pause-circle-outline'}
                        size={19}
                        color={p.benched ? colors.lime : colors.textFaint}
                      />
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
          showGender={!isTeamFormat(event.format)}
          onClose={() => setAddPlayerVisible(false)}
          onConfirm={onAddPlayer}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (colors: ColorPalette) => StyleSheet.create({
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
  linkAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, borderRadius: 12, backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairline },
  linkActionText: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  rowIndex: { fontSize: 12, fontWeight: '800', color: colors.textFaint, width: 16 },
  rowText: { flex: 1, fontWeight: '700', fontSize: 15, color: colors.textPrimary },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: 13, padding: 8, paddingHorizontal: 12 },
  playerRowBenched: { opacity: 0.6 },
  playerName: { flex: 1, fontWeight: '700', fontSize: 14, color: colors.textPrimary },
  playerNameBenched: { textDecorationLine: 'line-through', color: colors.textFaint },
  benchBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.white06 },
  benchBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, color: colors.textFaint },
});
