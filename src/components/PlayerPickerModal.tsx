import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ColorPalette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export interface PickerItem {
  id: string;
  name: string;
  tag?: string;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: PickerItem[];
  emptyText?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function PlayerPickerModal({ visible, title, subtitle, items, emptyText = 'No one else to swap in.', onPick, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.modal}>
          <View style={styles.head}>
            <Ionicons name="swap-horizontal" size={20} color={colors.lime} />
            <Text style={styles.title}>{title}</Text>
          </View>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {items.length === 0 ? (
            <Text style={styles.emptyText}>{emptyText}</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ gap: 8 }}>
              {items.map((it) => (
                <Pressable key={it.id} style={styles.row} onPress={() => onPick(it.id)}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  {!!it.tag && <Text style={styles.rowTag}>{it.tag}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,25,.6)' },
    centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      padding: 24,
      paddingTop: 22,
      maxHeight: '76%',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 },
    title: { fontSize: 19, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },
    subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 14, lineHeight: 18 },
    list: { marginTop: 8, marginBottom: 14 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      paddingHorizontal: 16,
    },
    rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    rowTag: { fontSize: 11, fontWeight: '800', color: colors.lime, marginLeft: 8 },
    emptyText: { fontSize: 13, color: colors.textFaint, textAlign: 'center', paddingVertical: 20 },
    cancelBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    cancelText: { fontWeight: '700', fontSize: 15, color: colors.textMuted },
  });
