import { Ionicons } from '@expo/vector-icons';
import qrcode from 'qrcode-generator';
import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ColorPalette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  visible: boolean;
  url: string;
  onClose: () => void;
}

const QR_SIZE = 220;

function useQrModules(url: string) {
  return useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const modules: boolean[][] = [];
    for (let row = 0; row < count; row++) {
      const line: boolean[] = [];
      for (let col = 0; col < count; col++) line.push(qr.isDark(row, col));
      modules.push(line);
    }
    return modules;
  }, [url]);
}

export function QrCodeModal({ visible, url, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modules = useQrModules(url);
  const cellSize = QR_SIZE / modules.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.modal}>
          <View style={styles.head}>
            <Ionicons name="qr-code-outline" size={20} color={colors.lime} />
            <Text style={styles.title}>Scan to open</Text>
          </View>
          <View style={styles.qrFrame}>
            <View style={{ width: QR_SIZE, height: QR_SIZE }}>
              {modules.map((line, row) => (
                <View key={row} style={{ flexDirection: 'row' }}>
                  {line.map((dark, col) => (
                    <View
                      key={col}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: dark ? '#0B1E3B' : 'transparent',
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.url} numberOfLines={2}>
            {url}
          </Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
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
      alignItems: 'center',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
    title: { fontSize: 17, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },
    qrFrame: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16 },
    url: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 16, marginBottom: 4 },
    closeBtn: { alignSelf: 'stretch', height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: colors.lime },
    closeText: { fontWeight: '800', fontSize: 15, color: colors.courtNavy },
  });
