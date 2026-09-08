import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { extractReclubUrl, fetchReclubConfirmedNames } from '../lib/reclub';
import { colors } from '../theme/tokens';

type Status = 'idle' | 'loading' | 'error' | 'success';

interface Props {
  visible: boolean;
  isTeamMode: boolean;
  onClose: () => void;
  onImport: (names: string[]) => void;
}

export function ImportReclubModal({ visible, isTeamMode, onClose, onImport }: Props) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [names, setNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const url = useMemo(() => extractReclubUrl(text), [text]);

  const reset = () => {
    setText('');
    setStatus('idle');
    setError('');
    setNames([]);
    setSelected(new Set());
  };

  const close = () => {
    reset();
    onClose();
  };

  const fetchConfirmed = async () => {
    if (!url) return;
    setStatus('loading');
    setError('');
    try {
      const found = await fetchReclubConfirmedNames(url);
      setNames(found);
      setSelected(new Set(found));
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that Reclub page.');
      setStatus('error');
    }
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const confirm = () => {
    onImport(names.filter((n) => selected.has(n)));
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.modal}>
          <Text style={styles.title}>Import from Reclub</Text>
          <Text style={styles.desc}>
            Paste the RSVP message from the group chat. We'll open the link and pull in everyone listed under
            "Confirmed" / "Dikonfirmasi".
          </Text>

          {status !== 'success' && (
            <>
              <TextInput
                style={styles.textarea}
                value={text}
                onChangeText={setText}
                placeholder="Paste the routine message here…"
                placeholderTextColor={colors.textFaint}
                multiline
                numberOfLines={6}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                style={[styles.confirmBtn, (!url || status === 'loading') && { opacity: 0.5 }]}
                onPress={fetchConfirmed}
                disabled={!url || status === 'loading'}
              >
                <Text style={styles.confirmText}>
                  {status === 'loading' ? 'Fetching confirmed players…' : 'Fetch confirmed players'}
                </Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}

          {status === 'success' && (
            <>
              <Text style={styles.label}>Confirmed · {names.length} found</Text>
              <ScrollView style={styles.list} contentContainerStyle={{ gap: 8 }}>
                {names.map((name) => {
                  const on = selected.has(name);
                  return (
                    <Pressable key={name} style={[styles.row, on && styles.rowOn]} onPress={() => toggle(name)}>
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on && <Ionicons name="checkmark" size={14} color={colors.courtNavy} />}
                      </View>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.hint}>
                {isTeamMode
                  ? 'Each name is added as its own entry — use "Link as team" afterward to pair them up.'
                  : 'Imported players default to Male — adjust M/F for each in the list below.'}
              </Text>
              <Pressable style={[styles.confirmBtn, selected.size === 0 && { opacity: 0.5 }]} onPress={confirm} disabled={selected.size === 0}>
                <Text style={styles.confirmText}>
                  Add {selected.size} {isTeamMode ? 'entr' : 'player'}
                  {isTeamMode ? (selected.size === 1 ? 'y' : 'ies') : selected.size === 1 ? '' : 's'}
                </Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,25,.6)' },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  modal: {
    backgroundColor: '#12274a',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: 24,
    paddingTop: 26,
    maxHeight: '82%',
  },
  title: { fontSize: 19, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 4 },
  desc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 16 },
  textarea: {
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  error: { fontSize: 13, color: colors.amber, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 10 },
  list: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
  },
  rowOn: { borderColor: colors.lime },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.lime, borderWidth: 0 },
  rowName: { flex: 1, fontWeight: '700', fontSize: 14, color: colors.textPrimary },
  hint: { fontSize: 12, color: colors.textFaint, marginBottom: 14, lineHeight: 16 },
  confirmBtn: { height: 54, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  confirmText: { fontWeight: '800', fontSize: 15, color: colors.courtNavy },
  cancelBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontWeight: '700', fontSize: 15, color: colors.textMuted },
});
