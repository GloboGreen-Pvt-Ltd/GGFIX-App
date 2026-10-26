import { Alert, Platform, ToastAndroid } from 'react-native';

// Burnt is a NATIVE module and is not bundled in Expo Go. Require it defensively
// (not a static import, which can't be wrapped) so the app still boots in Expo
// Go for UI testing — there we fall back to a JS-only toast. In a real dev /
// production build Burnt is present and used as before.
let Burnt = null;
try {
  // eslint-disable-next-line global-require
  Burnt = require('burnt');
} catch {
  Burnt = null;
}

/**
 * Cross-platform confirm dialog. Works on iOS, Android AND web (Expo Web).
 *
 * Usage:
 *   confirm({ title: 'Delete', message: 'Are you sure?', confirmText: 'Yes', destructive: true })
 *     .then((ok) => { if (ok) doDelete(); });
 */
export function confirm({ title = 'Confirm', message = '', confirmText = 'OK', cancelText = 'Cancel', destructive = false } = {}) {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return resolve(false);
      const composed = message ? `${title}\n\n${message}` : title;
      resolve(window.confirm(composed));
      return;
    }
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Cross-platform notification. Renders as a native iOS/Android toast on device
 * via Burnt, falls back to window.alert on web (Burnt has no web target).
 *
 * Signature stays (title, message) for backward compatibility with all existing
 * call sites. Optional third arg lets callers opt into richer styling:
 *   notify('Saved', 'Booking created', { preset: 'done' })
 *   notify('Network error', '', { preset: 'error', haptic: 'error' })
 *
 *   preset:   'done' | 'error' | 'none'   (default: 'none')
 *   duration: seconds (default 2)
 *   haptic:   'success' | 'warning' | 'error' | 'none'
 *   from:     'top' | 'bottom'            (default: 'bottom')
 */
export function notify(title, message = '', options = {}) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    const composed = message ? `${title}\n\n${message}` : title;
    window.alert(composed);
    return;
  }
  const {
    preset = 'none',
    duration = 2,
    haptic = 'none',
    from = 'bottom',
  } = options;
  if (Burnt?.toast) {
    Burnt.toast({
      title: String(title || ''),
      message: message ? String(message) : undefined,
      preset,
      duration,
      haptic,
      from,
    });
    return;
  }
  // Fallback when the native Burnt module is unavailable (e.g. Expo Go).
  if (Platform.OS === 'android') {
    const composed = message ? `${title}: ${message}` : String(title || '');
    ToastAndroid.show(composed, ToastAndroid.SHORT);
  }
  // iOS in Expo Go has no lightweight native toast — skip silently (non-critical).
}
