import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { InfoBox, ScreenBackground, StepHeader } from '../../components/Misc';
import { useDraft } from '../../data/draft';
import { makeId } from '../../lib/id';
import type { RootStackParamList } from '../../navigation/types';
import type { ColorPalette } from '../../theme/tokens';
import { radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

export function CreateCourtsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setDraft } = useDraft();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const setCount = (n: number) => {
    setDraft((d) => {
      const courts = [...d.courts];
      while (courts.length < n) courts.push({ id: makeId('court'), name: `Court ${courts.length + 1}` });
      while (courts.length > n) courts.pop();
      return { ...d, courts };
    });
  };

  const renameCourt = (id: string, name: string) => {
    setDraft((d) => ({ ...d, courts: d.courts.map((c) => (c.id === id ? { ...c, name } : c)) }));
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StepHeader step={4} total={5} onBack={() => nav.goBack()} />
        <View style={styles.headBlock}>
          <Text style={styles.title}>How many courts?</Text>
          <Text style={styles.subtitle}>Rounds are generated to keep every court busy.</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const on = draft.courts.length === n;
              return (
                <Pressable key={n} onPress={() => setCount(n)} style={[styles.cell, on && styles.cellOn]}>
                  {on && (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={13} color={colors.courtNavy} />
                    </View>
                  )}
                  <Text style={[styles.cellNum, on && { color: colors.lime }]}>{n}</Text>
                  <Text style={[styles.cellLabel, on && { color: colors.textSecondary }]}>{n === 1 ? 'court' : 'courts'}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Court names</Text>
          <View style={{ gap: 10 }}>
            {draft.courts.map((c, i) => (
              <View key={c.id} style={styles.nameRow}>
                <Text style={styles.nameIndex}>{i + 1}</Text>
                <TextInput
                  style={styles.nameInput}
                  value={c.name}
                  onChangeText={(t) => renameCourt(c.id, t)}
                  placeholder={`Court ${i + 1}`}
                  placeholderTextColor={colors.textFaint}
                />
                <Ionicons name="create-outline" size={17} color={colors.textFaint} />
              </View>
            ))}
          </View>

          <View style={{ marginTop: 16 }}>
            <InfoBox text="Add your players next. You can also add more rounds later if there's time left." />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Continue" icon="chevron-forward" onPress={() => nav.navigate('CreatePlayers')} />
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  safe: { flex: 1 },
  headBlock: { paddingHorizontal: 24, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.textMuted },
  body: { padding: 24, paddingTop: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cell: {
    width: '47%',
    height: 110,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cellOn: { backgroundColor: colors.surface2, borderColor: colors.lime },
  check: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  cellNum: { fontSize: 40, fontWeight: '800', color: colors.textPrimary },
  cellLabel: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
  sectionLabel: { marginTop: 26, marginBottom: 12, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint },
  nameRow: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  nameIndex: { fontSize: 12, fontWeight: '800', color: colors.textFaint, width: 16 },
  nameInput: { flex: 1, fontWeight: '700', fontSize: 15, color: colors.textPrimary, padding: 0 },
  footer: { paddingHorizontal: 24, paddingBottom: 20 },
});
