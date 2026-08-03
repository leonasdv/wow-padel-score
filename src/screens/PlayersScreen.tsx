import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { useEvents } from '../data/store';
import { colors, radius } from '../theme/tokens';
import { computeStandings } from '../lib/tournament';

interface Aggregate {
  id: string;
  name: string;
  gender: 'M' | 'F';
  events: number;
  played: number;
  wins: number;
  points: number;
}

export function PlayersScreen() {
  const { events } = useEvents();

  const roster = useMemo(() => {
    const map: Record<string, Aggregate> = {};
    for (const ev of events) {
      const standings = computeStandings(ev);
      for (const s of standings) {
        const cur = map[s.player.id] ?? {
          id: s.player.id,
          name: s.player.name,
          gender: s.player.gender,
          events: 0,
          played: 0,
          wins: 0,
          points: 0,
        };
        cur.events += 1;
        cur.played += s.played;
        cur.wins += s.wins;
        cur.points += s.points;
        map[s.player.id] = cur;
      }
    }
    return Object.values(map).sort((a, b) => b.points - a.points);
  }, [events]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Players</Text>
        <Text style={styles.subtitle}>All-time roster across every event</Text>
      </View>
      <FlatList
        data={roster}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>Players you add to events will show up here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar name={item.name} gender={item.gender} size={38} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.events} event{item.events === 1 ? '' : 's'} · {item.played} played · {item.wins} wins
              </Text>
            </View>
            <Text style={styles.points}>{item.points}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.courtNavy },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.textMuted },
  list: { paddingHorizontal: 20, gap: 9, paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: 12,
  },
  name: { fontWeight: '700', fontSize: 15, color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  points: { fontSize: 18, fontWeight: '800', color: colors.lime, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: 14, paddingTop: 80, paddingHorizontal: 40 },
  emptyText: { color: colors.textFaint, textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
