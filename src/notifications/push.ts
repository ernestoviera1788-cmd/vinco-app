import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { registerPushDevice, unregisterPushDevice } from '../api/actions';

const STORED_PUSH_TOKEN_KEY = 'vinco.push.expoToken';

// Foreground chat polling owns the in-app sound. The OS alert is for background
// or closed-app delivery, so don't show a duplicate banner while VINCÓ is active.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

function getEasProjectId(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined
  );
}

/** Ask permission and register this installation. Safe to call after each login. */
export async function registerPushNotifications(sessionToken: string): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const projectId = getEasProjectId();
  // A real EAS project ID is required to obtain a project-scoped Expo push token.
  // Do not prompt users until the app has been linked/configured for push.
  if (!projectId) {
    console.warn('[push] Registration skipped: configure the EAS project ID first.');
    return;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'message.wav',
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;

    const expoPushToken = (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;
    const platform = Platform.OS as 'ios' | 'android';

    await registerPushDevice(sessionToken, expoPushToken, platform);
    await SecureStore.setItemAsync(STORED_PUSH_TOKEN_KEY, expoPushToken);
  } catch (error) {
    // Push is optional; transient registration failures must not block sign-in.
    console.warn(
      '[push] Device registration failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}

/** Best-effort unregister before sign-out; preserve the token locally if RPC fails. */
export async function unregisterPushNotifications(sessionToken: string): Promise<void> {
  const expoPushToken = await SecureStore.getItemAsync(STORED_PUSH_TOKEN_KEY);
  if (!expoPushToken) return;
  try {
    await unregisterPushDevice(sessionToken, expoPushToken);
    await SecureStore.deleteItemAsync(STORED_PUSH_TOKEN_KEY);
  } catch (error) {
    console.warn(
      '[push] Device unregistration failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}
