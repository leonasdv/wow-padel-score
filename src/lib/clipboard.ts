import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import { Alert } from './alert';

/**
 * Copies a link with a guaranteed-visible fallback on web: `expo-clipboard` there tries the
 * Clipboard API, then an `execCommand('copy')` shim, and can fail both silently (returns
 * `false` rather than throwing) depending on browser/permission quirks. `window.prompt`
 * pre-selects the text so the user can copy it manually regardless of clipboard permissions.
 */
export async function copyLinkWithFeedback(link: string, successMessage = 'Link copied to clipboard.'): Promise<void> {
  const ok = await Clipboard.setStringAsync(link);
  if (ok) {
    Alert.alert('Copied', successMessage);
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.prompt === 'function') {
    window.prompt('Copy this link:', link);
    return;
  }
  Alert.alert("Couldn't copy automatically", link);
}

/**
 * Tries the native/web share sheet first, falling back to copying the link if sharing isn't
 * supported at all — react-native-web rejects with "Share is not supported in this browser"
 * whenever the Web Share API is missing, which is most desktop browsers. A share sheet the user
 * actually opened and then cancelled is left alone (no surprise clipboard write behind their back).
 */
export async function shareOrCopyLink(link: string): Promise<void> {
  try {
    await Share.share({ message: link });
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    await copyLinkWithFeedback(link);
  }
}
