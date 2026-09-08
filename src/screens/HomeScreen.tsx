import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusPill } from '../components/Misc';
import { WowLogo } from '../components/WowLogo';
import { useDraft } from '../data/draft';
import { useEvents } from '../data/store';
import { exportAllData, mergeEvents, pickBackupFile } from '../lib/backup';
import { makeId } from '../lib/id';
import { startEvent } from '../lib/tournament';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius } from '../theme/tokens';
import { FORMAT_META, type WowEvent } from '../types';

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { events, addEvent, deleteEvent, replaceAllEvents } = useEvents();
  const { reset } = useDraft();
  const liveCount = events.filter((e) => e.status === 'live').length;
  const [backupBusy, setBackupBusy] = useState(false);

  const onOpenEvent = (ev: WowEvent) => {
    if (ev.format === 'knockout') {
      nav.navigate('Knockout', { eventId: ev.id });
      return;
    }
    // Finished events open on the Standings tab (with a Share button there) instead of jumping straight to the result card.
    nav.navigate('Dashboard', { eventId: ev.id, tab: ev.status === 'done' ? 'standings' : 'rounds' });
  };

  const onCreate = () => {
    reset();
    nav.navigate('CreateName');
  };

  const onDuplicate = async (ev: WowEvent) => {
    const draftCopy: WowEvent = {
      ...ev,
      id: makeId('event'),
      name: `${ev.name} (Copy)`,
      courts: ev.courts.map((c) => ({ ...c, id: makeId('court') })),
      players: ev.players.map((p) => ({ ...p, id: makeId('player') })),
      fixedTeams: undefined,
      rounds: [],
      totalRoundsEstimate: 0,
      currentRoundIndex: 1,
      status: 'draft',
      createdAt: Date.now(),
      resultBgUri: undefined,
      shareId: undefined,
      editToken: undefined,
    };
    const live = startEvent(draftCopy, ev.totalRoundsEstimate);
    await addEvent(live);
    if (live.format === 'knockout') nav.navigate('Knockout', { eventId: live.id });
    else nav.navigate('Dashboard', { eventId: live.id });
  };

  const onDeleteRequest = (ev: WowEvent) => {
    Alert.alert('Delete this event?', `"${ev.name}" and all its scores will be permanently deleted. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(ev.id) },
    ]);
  };

  const onMoreOptions = (ev: WowEvent) => {
    Alert.alert(ev.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Duplicate event', onPress: () => onDuplicate(ev) },
      { text: 'Delete event', style: 'destructive', onPress: () => onDeleteRequest(ev) },
    ]);
  };

  const onExportAll = async () => {
    if (events.length === 0) {
      Alert.alert('Nothing to export', 'Create a tournament first.');
      return;
    }
    setBackupBusy(true);
    try {
      await exportAllData(events);
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not export your data. Please try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const onImportAll = async () => {
    setBackupBusy(true);
    try {
      const picked = await pickBackupFile();
      if (picked.cancelled) return;
      const { merged, added, updated } = mergeEvents(events, picked.events);
      await replaceAllEvents(merged);
      Alert.alert('Import complete', `${added} tournament${added === 1 ? '' : 's'} added, ${updated} updated. Existing tournaments not in the file were kept.`);
    } catch (err: any) {
      Alert.alert('Import failed', err?.message ?? 'Could not import that file. Please try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const onOpenBackupMenu = () => {
    Alert.alert('Backup & restore', 'Export every tournament to a file, or import one previously saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Export all data', onPress: onExportAll },
      { text: 'Import data', onPress: onImportAll },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <WowLogo size={22} subtitle />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable style={styles.backupBtn} onPress={onOpenBackupMenu} disabled={backupBusy} hitSlop={8}>
              <Ionicons name="cloud-upload-outline" size={18} color={backupBusy ? colors.textFaint : colors.textSecondary} />
            </Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {`LF`}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.title}>Events</Text>
        <Text style={styles.subtitle}>
          {events.length} tournament{events.length === 1 ? '' : 's'} · {liveCount} live now
        </Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="tennisball-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>No events yet. Tap + to create your first tournament.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpenEvent(item)} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <StatusPill status={item.status} />
              <Pressable onPress={() => onMoreOptions(item)} hitSlop={10} style={styles.moreBtn}>
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{FORMAT_META[item.format].name}</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.players.length} players</Text>
              </View>
              {item.format !== 'knockout' && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.courts.length} courts</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={onCreate}>
        <Ionicons name="add" size={26} color={colors.courtNavy} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.courtNavy },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  backupBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white06, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: colors.lime, fontSize: 14 },
  title: { marginTop: 22, fontSize: 28, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.textMuted },
  list: { paddingHorizontal: 20, gap: 14, paddingBottom: 120 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.xxl, padding: 18, paddingBottom: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  moreBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '800', fontSize: 17, letterSpacing: -0.3, color: colors.textPrimary },
  cardDate: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  tag: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 9, backgroundColor: colors.white05 },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  empty: { alignItems: 'center', gap: 14, paddingTop: 80, paddingHorizontal: 40 },
  emptyText: { color: colors.textFaint, textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
