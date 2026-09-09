import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { ScreenBackground, StepHeader } from '../../components/Misc';
import { useDraft } from '../../data/draft';
import type { RootStackParamList } from '../../navigation/types';
import type { ColorPalette } from '../../theme/tokens';
import { radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { FORMAT_META, type Format } from '../../types';

const FORMATS = Object.keys(FORMAT_META) as Format[];

export function CreateFormatScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setDraft } = useDraft();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StepHeader step={2} total={draft.format === 'knockout' ? 3 : 5} onBack={() => nav.goBack()} />
        <Text style={styles.title}>Choose a format</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {FORMATS.map((f) => {
            const meta = FORMAT_META[f];
            const on = draft.format === f;
            return (
              <Pressable
                key={f}
                onPress={() => setDraft((d) => ({ ...d, format: f }))}
                style={[styles.card, on && styles.cardOn]}
              >
                <View style={[styles.iconBox, on && styles.iconBoxOn]}>
                  <Text style={[styles.abbr, on && styles.abbrOn]}>{meta.abbr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{meta.name}</Text>
                  <Text style={styles.desc}>{meta.desc}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label="Continue"
            icon="chevron-forward"
            onPress={() => {
              if (draft.format === 'knockout') {
                // Knockout is always free-entry and has no courts — skip those steps.
                setDraft((d) => ({ ...d, scoringMode: 'free' }));
                nav.navigate('CreatePlayers');
              } else {
                nav.navigate('CreateScoring');
              }
            }}
          />
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  safe: { flex: 1 },
  title: { marginTop: 12, marginBottom: 4, marginHorizontal: 24, fontSize: 26, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary },
  list: { padding: 20, paddingTop: 16, gap: 12 },
  card: {
    borderRadius: radius.xl,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  cardOn: { backgroundColor: colors.surface2, borderColor: colors.lime },
  iconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white06 },
  iconBoxOn: { backgroundColor: colors.lime },
  abbr: { fontWeight: '900', fontSize: 16, color: colors.textMuted },
  abbrOn: { color: colors.courtNavy },
  name: { fontWeight: '800', fontSize: 16, letterSpacing: -0.3, color: colors.textPrimary },
  desc: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.lime },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.lime },
  footer: { paddingHorizontal: 24, paddingBottom: 20 },
});
