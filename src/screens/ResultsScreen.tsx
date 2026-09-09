import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { computeStandings, sortStandings } from '../lib/tournament';
import { useEvents } from '../data/store';
import type { RootStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export function ResultsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { events } = useEvents();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ended = useMemo(() => events.filter((e) => e.status === 'done'), [events]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Results</Text>
        <Text style={styles.subtitle}>Finished tournaments</Text>
      </View>
      <FlatList
        data={ended}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>Finished events and their podiums will show up here.</Text>
          </View>
        }
        renderItem={({ item }) => {
          // Match the ranking used by the Dashboard standings tab and result-card share screen.
          const top = sortStandings(computeStandings(item), 'points', item.rounds)[0];
          return (
            <Pressable style={styles.card} onPress={() => nav.navigate('Dashboard', { eventId: item.id, tab: 'standings' })}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>{item.rounds.length} rounds · {item.players.length} players</Text>
              </View>
              {top && (
                <View style={styles.winner}>
                  <Ionicons name="trophy" size={14} color={colors.gold} />
                  <Text style={styles.winnerName} numberOfLines={1}>
                    {top.player.name}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.textMuted },
  list: { paddingHorizontal: 20, gap: 12, paddingBottom: 120 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.xxl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: { fontWeight: '800', fontSize: 16, color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textFaint, marginTop: 4 },
  winner: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 140 },
  winnerName: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  empty: { alignItems: 'center', gap: 14, paddingTop: 80, paddingHorizontal: 40 },
  emptyText: { color: colors.textFaint, textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
