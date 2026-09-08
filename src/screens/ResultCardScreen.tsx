import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { initials } from '../components/Avatar';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { WowLogo } from '../components/WowLogo';
import { useEvents } from '../data/store';
import { Alert } from '../lib/alert';
import { computeStandings, sortStandings } from '../lib/tournament';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'ResultCard'>;
type GradientTriple = [string, string, string];

const BACKGROUNDS: { name: string; colors: GradientTriple }[] = [
  { name: 'Court Blue', colors: ['#0B1E3B', '#1C3A66', '#2F80FF'] },
  { name: 'Lime Rush', colors: ['#0B1E3B', '#2f4a12', '#C6EA3B'] },
  { name: 'Night Match', colors: ['#23477a', '#0a1730', '#050e20'] },
  { name: 'Sunset Set', colors: ['#3a1a4d', '#7a2f4a', '#E39A5B'] },
];

const MEDAL = ['#FFD34E', '#C9D6E5', '#E39A5B'];

export function ResultCardScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { getEvent, updateEvent } = useEvents();
  const event = getEvent(route.params.eventId);
  const viewShotRef = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState(false);
  const [sortBy, setSortBy] = useState<'points' | 'wins'>('points');
  const [tableWrapHeight, setTableWrapHeight] = useState(0);

  // Apply an incoming template preference (e.g. "Share standings" opens the Table view).
  const paramTemplate = route.params.template;
  useEffect(() => {
    if (paramTemplate && event && event.resultTemplate !== paramTemplate) {
      updateEvent(event.id, (e) => ({ ...e, resultTemplate: paramTemplate }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTemplate]);

  // Knockout always ranks by its bracket finish order; other formats follow the chosen sort.
  const isKnockoutEvent = event?.format === 'knockout';
  const rankMode = isKnockoutEvent ? 'points' : sortBy;
  const allStandings = useMemo(() => (event ? sortStandings(computeStandings(event), rankMode, event.rounds) : []), [event, rankMode]);
  const top3 = allStandings.slice(0, 3);

  if (!event) {
    return (
      <View style={styles.safe}>
        <Text style={{ color: colors.textPrimary, padding: 24 }}>Event not found.</Text>
      </View>
    );
  }

  const dateLabel = new Date(event.createdAt)
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();

  const pickBackground = async (index: number) => {
    await updateEvent(event.id, (e) => ({ ...e, resultBgIndex: index, resultBgUri: undefined }));
  };

  const pickUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick a background image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [9, 16] });
    if (!result.canceled && result.assets[0]) {
      await updateEvent(event.id, (e) => ({ ...e, resultBgUri: result.assets[0].uri }));
    }
  };

  const shareCard = async () => {
    if (!viewShotRef.current) return;
    setBusy(true);
    try {
      const uri = await viewShotRef.current.capture!();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share result card' });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not supported on this device.');
      }
    } catch {
      Alert.alert('Something went wrong', 'Could not generate the result card image.');
    } finally {
      setBusy(false);
    }
  };

  const bgColors = BACKGROUNDS[event.resultBgIndex]?.colors ?? BACKGROUNDS[0].colors;
  const podiumPosition = event.resultPodiumPosition ?? 'bottom';
  const setPodiumPosition = async (position: 'top' | 'bottom') => {
    await updateEvent(event.id, (e) => ({ ...e, resultPodiumPosition: position }));
  };
  const template = event.resultTemplate ?? 'list';
  const setTemplate = async (t: 'list' | 'podium' | 'table') => {
    await updateEvent(event.id, (e) => ({ ...e, resultTemplate: t }));
  };
  const podiumCols = [top3[1], top3[0], top3[2]]; // display order: 2nd, 1st, 3rd
  const medalOf = (i: number) => (i < 3 ? MEDAL[i] : 'rgba(255,255,255,.25)');
  // The number shown on the card follows the chosen sort. Knockout shows matches won
  // (its internal "points" is a finish-order score, not meaningful to display).
  const isKnockout = event.format === 'knockout';
  const bigNum = (s: (typeof allStandings)[number]) => {
    if (isKnockout) return s.wins;
    if (sortBy === 'wins') return s.wins;
    return s.points;
  };

  // Fit every player's row inside the fixed-size share card — shrink row height/font as the
  // roster grows instead of letting rows overflow past the card and get clipped.
  const tableRowCount = allStandings.length;
  const tableHeadHeight = 20;
  const tableGap = tableRowCount > 20 ? 1 : tableRowCount > 12 ? 2 : 4;
  const tableSafetyMargin = 6;
  const tableAvailableForRows = Math.max(0, tableWrapHeight - tableSafetyMargin - tableHeadHeight - tableGap * tableRowCount);
  const tableRawRowHeight = tableRowCount > 0 ? tableAvailableForRows / tableRowCount : 28;
  const tableRowHeight = tableWrapHeight > 0 ? Math.max(16, Math.min(30, tableRawRowHeight)) : 28;
  const tableRowFont = Math.max(8, Math.min(13, tableRowHeight * 0.42));
  const tableRankSize = Math.max(14, Math.min(20, tableRowHeight * 0.72));

  return (
    <View style={styles.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headRow}>
            <Pressable style={styles.backBtn} onPress={() => nav.navigate('MainTabs')}>
              <Ionicons name="chevron-back" size={19} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.finishedPill}>
              <Ionicons name="trophy-outline" size={14} color={colors.amber} />
              <Text style={styles.finishedText}>FINISHED</Text>
            </View>
          </View>
          <Text style={styles.title}>Share result card</Text>
          <Text style={styles.subtitle}>{event.name} · final standings</Text>
        </View>

        <View style={styles.templateSection}>
          <Text style={styles.sectionLabel}>Template</Text>
          <SegmentedTabs
            options={[
              { key: 'list', label: 'Top 3' },
              { key: 'podium', label: 'Podium' },
              { key: 'table', label: 'Full table' },
            ]}
            value={template}
            onChange={(k) => setTemplate(k as 'list' | 'podium' | 'table')}
          />
        </View>

        {!isKnockout && (
          <View style={styles.sortSection}>
            <Text style={styles.sectionLabel}>Sort by</Text>
            <SegmentedTabs
              options={[
                { key: 'points', label: 'Points' },
                { key: 'wins', label: 'Wins' },
              ]}
              value={sortBy}
              onChange={(k) => setSortBy(k as 'points' | 'wins')}
            />
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.previewWrap}>
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.card}>
              {event.resultBgUri ? (
                <Image source={{ uri: event.resultBgUri }} style={StyleSheet.absoluteFill} />
              ) : (
                <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} />
              )}
              {template === 'list' ? (
                <View style={styles.overlay}>
                  <View style={styles.headerScrim}>
                    <View style={styles.cardTop}>
                      <WowLogo size={26} />
                      <Text style={styles.dateText}>{dateLabel}</Text>
                    </View>
                    <Text style={styles.eventNameHeader} numberOfLines={1}>
                      {event.name}
                    </Text>
                    <Text style={styles.podiumLabel}>Final Podium</Text>
                  </View>
                  <View style={[styles.podiumList, podiumPosition === 'top' ? { marginBottom: 'auto' } : { marginTop: 'auto' }]}>
                    {top3.map((s, i) => (
                      <View
                        key={s.player.id}
                        style={[
                          styles.podiumRow,
                          i === 0 && { backgroundColor: 'rgba(255,255,255,.94)', borderColor: colors.lime, borderWidth: 1.5 },
                        ]}
                      >
                        <View style={[styles.medal, { backgroundColor: MEDAL[i] }]}>
                          <Text style={styles.medalText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.podiumName} numberOfLines={1}>
                          {s.player.name}
                        </Text>
                        <Text style={[styles.podiumPts, i === 0 && { fontSize: 17 }]}>{bigNum(s)}</Text>
                      </View>
                    ))}
                    {top3.length === 0 && <Text style={styles.podiumName}>No scores recorded yet.</Text>}
                  </View>
                </View>
              ) : template === 'podium' ? (
                <View style={styles.overlay}>
                  <View style={styles.headerScrim}>
                    <View style={styles.cardTop}>
                      <WowLogo size={26} />
                      <Text style={styles.dateText}>{dateLabel}</Text>
                    </View>
                    <Text style={styles.eventNameCentered} numberOfLines={1}>
                      {event.name}
                    </Text>
                  </View>
                  <View style={[styles.circlePodiumRow, podiumPosition === 'top' ? { marginBottom: 'auto' } : { marginTop: 'auto' }]}>
                    {podiumCols.map((s, colIdx) => {
                      if (!s) return <View key={colIdx} style={{ flex: 1 }} />;
                      const rank = colIdx === 1 ? 0 : colIdx === 0 ? 1 : 2;
                      const isFirst = rank === 0;
                      const losses = Math.max(0, s.played - s.wins - s.draws);
                      return (
                        <View key={s.player.id} style={styles.circleCol}>
                          <View style={[styles.rankBadgeSmall, { backgroundColor: MEDAL[rank] }]}>
                            <Text style={styles.rankBadgeSmallText}>{rank + 1}</Text>
                          </View>
                          <View
                            style={[
                              styles.circleAvatar,
                              isFirst ? styles.circleAvatarBig : styles.circleAvatarSmall,
                              { backgroundColor: MEDAL[rank] },
                            ]}
                          >
                            <Text style={[styles.circleAvatarText, isFirst && { fontSize: 22 }]}>{initials(s.player.name)}</Text>
                          </View>
                          <Text style={styles.circleName} numberOfLines={1}>
                            {s.player.name}
                          </Text>
                          <Text style={styles.circleRecord}>
                            {s.wins}-{losses}-{s.draws}
                          </Text>
                          <Text style={[styles.circlePts, isFirst && { fontSize: 18 }]}>{bigNum(s)}</Text>
                        </View>
                      );
                    })}
                    {top3.length === 0 && <Text style={styles.podiumName}>No scores recorded yet.</Text>}
                  </View>
                </View>
              ) : (
                <View style={styles.overlay}>
                  <View style={styles.headerScrim}>
                    <View style={styles.cardTop}>
                      <WowLogo size={26} />
                      <Text style={styles.dateText}>{dateLabel}</Text>
                    </View>
                    <Text style={styles.eventNameHeader} numberOfLines={1}>
                      {event.name}
                    </Text>
                  </View>
                  <View style={[styles.tableWrap, { gap: tableGap }]} onLayout={(e) => setTableWrapHeight(e.nativeEvent.layout.height)}>
                    <View style={[styles.tableHeadRow, { height: tableHeadHeight, paddingBottom: 0 }]}>
                      <View style={{ width: tableRankSize }} />
                      <Text style={[styles.tableName, styles.tableHeadText]}>Player</Text>
                      <Text style={[styles.tableStat, styles.tableHeadText]}>W</Text>
                      <Text style={[styles.tableStat, styles.tableHeadText]}>L</Text>
                      <Text style={[styles.tableStat, styles.tableHeadText]}>T</Text>
                      <Text style={[styles.tablePts, styles.tableHeadText]}>{isKnockout || sortBy === 'points' ? 'Pts' : 'Win'}</Text>
                    </View>
                    {allStandings.map((s, i) => {
                      const losses = Math.max(0, s.played - s.wins - s.draws);
                      const dark = i < 3;
                      return (
                        <View
                          key={s.player.id}
                          style={[styles.tableRow, { height: tableRowHeight, paddingVertical: 0 }, dark && { backgroundColor: 'rgba(255,255,255,.86)' }]}
                        >
                          <View style={[styles.tableRank, { width: tableRankSize, height: tableRankSize, borderRadius: tableRankSize * 0.3 }, { backgroundColor: medalOf(i) }]}>
                            <Text style={[styles.tableRankText, { fontSize: tableRankSize * 0.5 }]}>{i + 1}</Text>
                          </View>
                          <Text style={[styles.tableName, { fontSize: tableRowFont }, dark && { color: colors.courtNavy }]} numberOfLines={1}>
                            {s.player.name}
                          </Text>
                          <Text style={[styles.tableStat, { fontSize: tableRowFont }, dark ? { color: colors.courtNavy } : { color: 'rgba(255,255,255,.8)' }]}>{s.wins}</Text>
                          <Text style={[styles.tableStat, { fontSize: tableRowFont }, dark ? { color: colors.courtNavy } : { color: 'rgba(255,255,255,.8)' }]}>{losses}</Text>
                          <Text style={[styles.tableStat, { fontSize: tableRowFont }, dark ? { color: colors.courtNavy } : { color: 'rgba(255,255,255,.8)' }]}>{s.draws}</Text>
                          <Text style={[styles.tablePts, { fontSize: tableRowFont + 1 }, dark && { color: colors.courtNavy }]}>{bigNum(s)}</Text>
                        </View>
                      );
                    })}
                    {allStandings.length === 0 && <Text style={styles.podiumName}>No scores recorded yet.</Text>}
                  </View>
                </View>
              )}
            </ViewShot>
          </View>

          <View style={styles.bgSection}>
            <Text style={styles.sectionLabel}>Background</Text>
            <View style={styles.bgRow}>
              {BACKGROUNDS.map((b, i) => (
                <Pressable key={b.name} onPress={() => pickBackground(i)}>
                  <LinearGradient
                    colors={b.colors}
                    style={[
                      styles.swatch,
                      { borderColor: !event.resultBgUri && event.resultBgIndex === i ? colors.lime : 'transparent' },
                    ]}
                  />
                </Pressable>
              ))}
              <Pressable style={styles.uploadSwatch} onPress={pickUpload}>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.textMuted} />
                <Text style={styles.uploadLabel}>Upload</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.positionSection}>
            <Text style={styles.sectionLabel}>Podium position</Text>
            <SegmentedTabs
              options={[
                { key: 'top', label: 'Top' },
                { key: 'bottom', label: 'Bottom' },
              ]}
              value={podiumPosition}
              onChange={(k) => setPodiumPosition(k as 'top' | 'bottom')}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.iconAction} onPress={shareCard} disabled={busy}>
            <Ionicons name="download-outline" size={20} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={[styles.shareBtn, busy && { opacity: 0.6 }]} onPress={shareCard} disabled={busy}>
            <Ionicons name="share-outline" size={19} color={colors.courtNavy} />
            <Text style={styles.shareText}>{busy ? 'Preparing…' : 'Share card'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.courtNavy },
  header: { paddingHorizontal: 22, paddingTop: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white06, alignItems: 'center', justifyContent: 'center' },
  finishedPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(255,180,60,.14)', borderWidth: 1, borderColor: 'rgba(255,180,60,.35)' },
  finishedText: { fontSize: 12, fontWeight: '800', color: colors.amber },
  title: { marginTop: 12, fontSize: 23, fontWeight: '900', letterSpacing: -0.6, color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  previewWrap: { paddingHorizontal: 22, paddingTop: 16 },
  card: { borderRadius: 22, overflow: 'hidden', width: '100%', aspectRatio: 9 / 16, borderWidth: 1, borderColor: colors.hairlineStrong },
  overlay: { flex: 1, padding: 18 },
  headerScrim: { backgroundColor: 'rgba(6,15,32,.72)', borderRadius: 14, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,.85)' },
  eventNameHeader: { marginTop: 8, fontSize: 14, fontWeight: '800', color: '#fff' },
  podiumLabel: { marginTop: 6, fontSize: 11, fontWeight: '800', letterSpacing: 2, color: colors.lime, textTransform: 'uppercase' },
  podiumList: { gap: 6 },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.85)',
  },
  medal: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontWeight: '900', fontSize: 12, color: colors.courtNavy },
  podiumName: { flex: 1, fontWeight: '700', fontSize: 13, color: colors.courtNavy },
  podiumPts: { fontWeight: '800', fontSize: 15, color: colors.courtNavy, fontVariant: ['tabular-nums'] },
  templateSection: { paddingHorizontal: 22, paddingTop: 14 },
  sortSection: { paddingHorizontal: 22, paddingTop: 14 },
  eventNameCentered: { marginTop: 10, fontSize: 15, fontWeight: '800', color: '#fff', textAlign: 'center' },
  circlePodiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  circleCol: { flex: 1, alignItems: 'center', maxWidth: 110 },
  rankBadgeSmall: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  rankBadgeSmallText: { fontSize: 10, fontWeight: '900', color: colors.courtNavy },
  circleAvatar: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,.4)' },
  circleAvatarBig: { width: 68, height: 68 },
  circleAvatarSmall: { width: 54, height: 54 },
  circleAvatarText: { fontWeight: '900', fontSize: 17, color: colors.courtNavy },
  circleName: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#fff', textAlign: 'center' },
  circleRecord: { marginTop: 2, fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,.65)' },
  circlePts: { marginTop: 3, fontSize: 15, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'] },
  tableWrap: { flex: 1, justifyContent: 'center', gap: 4, marginTop: 12 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,.14)',
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingBottom: 4 },
  tableHeadText: { color: colors.lime, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  tableRank: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tableRankText: { fontSize: 11, fontWeight: '900', color: colors.courtNavy },
  tableName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#fff' },
  tableStat: { width: 20, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  tablePts: { width: 32, textAlign: 'right', fontSize: 14, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  bgSection: { paddingHorizontal: 22, paddingTop: 18 },
  positionSection: { paddingHorizontal: 22, paddingTop: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 11 },
  bgRow: { flexDirection: 'row', gap: 11 },
  swatch: { width: 58, height: 58, borderRadius: 14, borderWidth: 2.5 },
  uploadSwatch: { width: 58, height: 58, borderRadius: 14, backgroundColor: colors.white05, borderWidth: 2, borderColor: colors.hairlineStrong, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 3 },
  uploadLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted },
  footer: { flexDirection: 'row', gap: 11, paddingHorizontal: 22, paddingBottom: 22, paddingTop: 10 },
  iconAction: { width: 58, height: 56, borderRadius: 16, backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  shareText: { fontWeight: '800', fontSize: 16, color: colors.courtNavy },
});
