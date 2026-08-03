import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { ScreenBackground, StepHeader } from '../../components/Misc';
import { useDraft } from '../../data/draft';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme/tokens';

export function CreateScoringScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setDraft } = useDraft();
  const isTotal = draft.scoringMode === 'total';

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StepHeader step={3} total={5} onBack={() => nav.goBack()} />
        <Text style={styles.title}>Scoring system</Text>
        <ScrollView contentContainerStyle={styles.body}>
          <Pressable
            onPress={() => setDraft((d) => ({ ...d, scoringMode: 'total' }))}
            style={[styles.card, isTotal && styles.cardOn]}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, isTotal && styles.iconBoxOn]}>
                <Text style={[styles.sigma, isTotal && styles.sigmaOn]}>Σ</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Total Score</Text>
                <Text style={styles.desc}>Fixed pot of points split each match. Enter one team — the other fills in.</Text>
              </View>
              <View style={[styles.radio, isTotal && styles.radioOn]}>{isTotal && <View style={styles.radioDot} />}</View>
            </View>
            {isTotal && (
              <View style={styles.potRow}>
                <Text style={styles.potLabel}>Points per match</Text>
                <View style={styles.potControls}>
                  <Pressable
                    style={styles.potBtn}
                    onPress={() => setDraft((d) => ({ ...d, pot: Math.max(4, d.pot - 1) }))}
                  >
                    <Text style={styles.potBtnText}>–</Text>
                  </Pressable>
                  <View style={styles.potValue}>
                    <Text style={styles.potValueText}>{draft.pot}</Text>
                  </View>
                  <Pressable
                    style={[styles.potBtn, { backgroundColor: colors.white06 }]}
                    onPress={() => setDraft((d) => ({ ...d, pot: Math.min(21, d.pot + 1) }))}
                  >
                    <Text style={[styles.potBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setDraft((d) => ({ ...d, scoringMode: 'free' }))}
            style={[styles.card, !isTotal && styles.cardOn, { marginTop: 14 }]}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, !isTotal && styles.iconBoxOn]}>
                <Text style={[styles.sigma, !isTotal && styles.sigmaOn, { fontSize: 16 }]}>✎</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Free Entry</Text>
                <Text style={styles.desc}>Type both team scores per match. No fixed total.</Text>
              </View>
              <View style={[styles.radio, !isTotal && styles.radioOn]}>{!isTotal && <View style={styles.radioDot} />}</View>
            </View>
          </Pressable>
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Continue" icon="chevron-forward" onPress={() => nav.navigate('CreateCourts')} />
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: { marginTop: 12, marginBottom: 4, marginHorizontal: 24, fontSize: 26, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  body: { padding: 24, paddingTop: 18 },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.hairline, padding: 18 },
  cardOn: { backgroundColor: colors.surface2, borderColor: colors.lime },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  iconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white06 },
  iconBoxOn: { backgroundColor: colors.lime },
  sigma: { fontWeight: '900', fontSize: 20, color: colors.textMuted },
  sigmaOn: { color: colors.courtNavy },
  name: { fontWeight: '800', fontSize: 17, letterSpacing: -0.3, color: colors.textPrimary },
  desc: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 17, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.lime },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.lime },
  potRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    padding: 12,
  },
  potLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint },
  potControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  potBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.white06, alignItems: 'center', justifyContent: 'center' },
  potBtnText: { fontSize: 22, fontWeight: '800', color: colors.textMuted },
  potValue: { minWidth: 64, height: 52, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  potValueText: { fontSize: 30, fontWeight: '800', color: colors.lime },
  footer: { paddingHorizontal: 24, paddingBottom: 20 },
});
