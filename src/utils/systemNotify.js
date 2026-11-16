import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { navigationRef } from '../navigation/navigationRef';

/**
 * Phone (system) notification — the heads-up banner that drops in from the top
 * of the screen and stays in the notification tray. Used for the login /
 * logout / OTP messages.
 *
 * expo-notifications is native: an app build made before it was added doesn't
 * have it, so it's only loaded when the native side exists. Resolves false
 * when it can't post (no module, or permission denied) so the caller can fall
 * back to the in-app toast.
 */
const HAS_NOTIFICATIONS = !!requireOptionalNativeModule('ExpoNotificationScheduler');
const Notifications = HAS_NOTIFICATIONS ? require('expo-notifications') : null;
const CHANNEL = 'account-alerts';

let ready = null;
function setup() {
  if (!Notifications) return Promise.resolve(false);
  if (!ready) {
    ready = (async () => {
      // Show the banner even while the app is open.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'Account alerts',
          importance: Notifications.AndroidImportance.HIGH, // heads-up banner
          vibrationPattern: [0, 120],
          lightColor: '#035C6C',
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    })().catch(() => false);
  }
  return ready;
}

/** `data.kind` routes a tap (see listenForNotificationTaps). */
export async function systemNotify(title, body = '', data = undefined) {
  try {
    if (!(await setup())) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false, ...(data ? { data } : null) },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
    return true;
  } catch (_) {
    return false;
  }
}

// Tapping a notification opens the screen it is about. Kinds:
//   SELL_QUOTES { sellOrderId } → Quotations Received for that sell order.
function openFromNotification(response) {
  const d = response?.notification?.request?.content?.data || {};
  if (d.kind === 'SELL_QUOTES' && d.sellOrderId && navigationRef.isReady()) {
    navigationRef.navigate('SellQuotesReceived', { sellOrderId: d.sellOrderId });
  }
}

let tapSub = null;
/** Call once the navigator is ready (App.js NavigationContainer onReady). */
export function listenForNotificationTaps() {
  if (!Notifications || tapSub) return;
  tapSub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
}
