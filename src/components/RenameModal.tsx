import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/tokens';

interface QuickPick {
  id: string;
  label: string;
}

interface Props {
  visible: boolean;
  title: string;
  label: string;
  placeholder?: string;
  /** Prefill the field (used for rename). Leave empty for replace. */
  initialValue?: string;
  confirmText?: string;
  /** Existing roster entries (e.g. sitting out this round) offered as a tap-to-pick shortcut. */
  quickPicks?: QuickPick[];
  quickPicksLabel?: string;
  onPickExisting?: (id: string) => void;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

export function RenameModal({
  visible,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmText = 'Save',
  quickPicks,
  quickPicksLabel = 'Swap in someone sitting out',
  onPickExisting,
  onClose,
  onConfirm,
}: Props) {
  const [text, setText] = useState(initialValue);

  // Re-sync the field whenever the modal is (re)opened for a different target.
  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  const confirm = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.centerWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <View style={styles.modal}>
          <View style={styles.head}>
            <Ionicons name="create-outline" size={20} color={colors.lime} />
            <Text style={styles.title}>{title}</Text>
          </View>

          {!!quickPicks?.length && (
            <>
              <Text style={styles.label}>{quickPicksLabel}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickRow} contentContainerStyle={{ gap: 8 }}>
                {quickPicks.map((qp) => (
                  <Pressable key={qp.id} style={styles.pickChip} onPress={() => onPickExisting?.(qp.id)}>
                    <Ionicons name="swap-horizontal" size={13} color={colors.lime} />
                    <Text style={styles.pickChipText} numberOfLines={1}>
                      {qp.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            autoFocus={!quickPicks?.length}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={confirm}
          />
          <Pressable style={[styles.confirmBtn, text.trim().length === 0 && { opacity: 0.5 }]} onPress={confirm} disabled={text.trim().length === 0}>
            <Text style={styles.confirmText}>{confirmText}</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: 22,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  title: { fontSize: 19, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 9 },
  pickRow: { marginBottom: 4 },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: colors.limeTint,
    borderWidth: 1,
    borderColor: colors.limeTintBorder,
    maxWidth: 160,
  },
  pickChipText: { fontSize: 13, fontWeight: '800', color: colors.lime, flexShrink: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.hairlineStrong },
  dividerText: { fontSize: 11, fontWeight: '800', color: colors.textFaint, letterSpacing: 1 },
  input: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.lime,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  confirmBtn: { height: 54, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  confirmText: { fontWeight: '800', fontSize: 15, color: colors.courtNavy },
  cancelBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontWeight: '700', fontSize: 15, color: colors.textMuted },
});
