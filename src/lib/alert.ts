import { Alert as RNAlert, Platform } from 'react-native';

export interface AlertButton {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

type ShowFn = (title: string, message?: string, buttons?: AlertButton[]) => void;

let showImpl: ShowFn | null = null;

/** Wired up once by <AlertHost/> (mounted at the app root) so `Alert.alert` can reach it. */
export function registerAlertHost(fn: ShowFn | null): void {
  showImpl = fn;
}

/**
 * Drop-in replacement for React Native's `Alert.alert` — same call signature, so every existing
 * call site works unchanged. On native it delegates straight to the real thing. On web,
 * react-native-web's Alert.alert is a hard no-op (`static alert() {}`), so every confirmation
 * dialog and action sheet in the app would otherwise silently do nothing; this renders a real
 * modal via <AlertHost/> instead.
 */
function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons as Parameters<typeof RNAlert.alert>[2]);
    return;
  }
  if (showImpl) {
    showImpl(title, message, buttons);
    return;
  }
  // AlertHost not mounted yet — extremely unlikely, but don't lose the message entirely.
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert([title, message].filter(Boolean).join('\n\n'));
  }
}

export const Alert = { alert };
