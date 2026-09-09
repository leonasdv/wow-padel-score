import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { registerAlertHost, type AlertButton } from '../lib/alert';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

/** Renders the web-only modal that src/lib/alert.ts's Alert.alert shows its dialogs through. Mount once at the app root. */
export function AlertHost() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [state, setState] = useState<AlertState | null>(null);

  useEffect(() => {
    registerAlertHost((title, message, buttons) => {
      setState({ title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }] });
    });
    return () => registerAlertHost(null);
  }, []);

  if (!state) return null;

  const cancelButton = state.buttons.find((b) => b.style === 'cancel');

  const dismiss = (button?: AlertButton) => {
    setState(null);
    button?.onPress?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => dismiss(cancelButton)}>
      <Pressable style={styles.backdrop} onPress={() => dismiss(cancelButton)} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.modal}>
          <Text style={styles.title}>{state.title}</Text>
          {!!state.message && <Text style={styles.message}>{state.message}</Text>}
          <View style={styles.buttons}>
            {state.buttons.map((button, i) => (
              <Pressable key={i} style={styles.btn} onPress={() => dismiss(button)}>
                <Text
                  style={[
                    styles.btnText,
                    button.style === 'cancel' && styles.btnTextCancel,
                    button.style === 'destructive' && styles.btnTextDestructive,
                  ]}
                >
                  {button.text ?? 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,25,.6)' },
    centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    modal: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surface,
      borderRadius: radius.xxl,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      padding: 22,
    },
    title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
    message: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
    buttons: { gap: 8 },
    btn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white06 },
    btnText: { fontSize: 15, fontWeight: '800', color: colors.lime },
    btnTextCancel: { color: colors.textMuted },
    btnTextDestructive: { color: '#FF6B6B' },
  });
