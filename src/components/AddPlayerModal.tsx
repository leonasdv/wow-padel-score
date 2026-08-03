import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../theme/tokens';
import type { Gender } from '../types';

interface Props {
  visible: boolean;
  regenerationText: string;
  showGender?: boolean;
  onClose: () => void;
  onConfirm: (name: string, gender: Gender) => void;
}

export function AddPlayerModal({ visible, regenerationText, showGender = true, onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('F');
  const isTeamMode = !showGender;

  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, gender);
    setName('');
    setGender('F');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} />
      <View style={styles.centerWrap}>
        <View style={styles.modal}>
          <View style={styles.warnIcon}>
            <Ionicons name="warning-outline" size={28} color={colors.amber} />
          </View>
          <Text style={styles.title}>{isTeamMode ? 'Add team mid-event?' : 'Add player mid-event?'}</Text>
          <Text style={styles.desc}>{regenerationText}</Text>
          <Text style={styles.label}>{isTeamMode ? 'New team' : 'New player'}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={isTeamMode ? 'Team name' : 'Player name'}
            placeholderTextColor={colors.textFaint}
            autoFocus
          />
          {showGender && (
            <View style={styles.genderRow}>
              <Pressable
                style={[styles.genderBtn, gender === 'M' && { backgroundColor: 'rgba(67,176,255,.16)', borderColor: colors.male, borderWidth: 1.5 }]}
                onPress={() => setGender('M')}
              >
                <Text style={[styles.genderText, gender === 'M' && { color: colors.male }]}>Male</Text>
              </Pressable>
              <Pressable
                style={[styles.genderBtn, gender === 'F' && { backgroundColor: 'rgba(255,111,165,.16)', borderColor: colors.female, borderWidth: 1.5 }]}
                onPress={() => setGender('F')}
              >
                <Text style={[styles.genderText, gender === 'F' && { color: colors.female }]}>Female</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            style={[styles.confirmBtn, { marginTop: showGender ? 0 : 10 }, name.trim().length === 0 && { opacity: 0.5 }]}
            onPress={confirm}
            disabled={name.trim().length === 0}
          >
            <Text style={styles.confirmText}>Add & regenerate rounds</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
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
    paddingTop: 28,
  },
  warnIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,180,60,.14)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 21, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.4, marginBottom: 10 },
  desc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 9 },
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
    marginBottom: 12,
  },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  genderBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white05, borderWidth: 1, borderColor: colors.hairlineStrong },
  genderText: { fontWeight: '800', fontSize: 14, color: colors.textMuted },
  confirmBtn: { height: 54, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  confirmText: { fontWeight: '800', fontSize: 15, color: colors.courtNavy },
  cancelBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontWeight: '700', fontSize: 15, color: colors.textMuted },
});
