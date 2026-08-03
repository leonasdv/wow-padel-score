import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ScreenBackground, StepHeader } from '../../components/Misc';
import { TextField } from '../../components/TextField';
import { useDraft } from '../../data/draft';
import { useEvents } from '../../data/store';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';

const MAX_LEN = 40;

export function CreateNameScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setDraft } = useDraft();
  const { events } = useEvents();
  const [name, setName] = useState(draft.name);

  const recent = useMemo(() => {
    const names = events.map((e) => e.name);
    return Array.from(new Set(names)).slice(0, 4);
  }, [events]);

  const onContinue = () => {
    setDraft((d) => ({ ...d, name: name.trim() }));
    nav.navigate('CreateFormat');
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StepHeader step={1} total={5} onBack={() => nav.goBack()} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Name your event</Text>
          <Text style={styles.subtitle}>This is how it shows up in your events list.</Text>
          <TextField
            label="Event name"
            value={name}
            onChangeText={(t) => setName(t.slice(0, MAX_LEN))}
            placeholder="Friday Night Americano"
            rightHint={`${name.length} / ${MAX_LEN}`}
            autoFocus
          />
          {recent.length > 0 && (
            <>
              <Text style={styles.recentLabel}>Recent</Text>
              <View style={styles.chipRow}>
                {recent.map((r) => (
                  <Chip key={r} label={r} onPress={() => setName(r.slice(0, MAX_LEN))} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Continue" icon="chevron-forward" onPress={onContinue} disabled={name.trim().length === 0} />
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 24, paddingTop: 36 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 21, marginBottom: 32 },
  recentLabel: { marginTop: 28, marginBottom: 12, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footer: { paddingHorizontal: 24, paddingBottom: 20 },
});
