// Device-bound session tokens (migration 116): 15-min access JWT + rotating
// refresh token capped at the 15-day OTP deadline. No API-client import
// (the client imports this), so plain fetch is used.
import { alertIfReplaced } from './sessionNotice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_BASE } from '../api/config';
import { getSession, getToken, saveSession } from '../auth/session';

const REFRESH_KEY = 'security.refresh';
import { Platform } from 'react-native';
import * as SecureStoreModule from 'expo-secure-store';

// Keystore / Keychain via expo-secure-store. A preview build made before the
// module was added has no native side: those calls throw and we fall back to
// AsyncStorage until the new build is installed.
const SecureStore = Platform.OS === 'web' ? null : SecureStoreModule;

export async function getDeviceRefreshToken() {
  if (SecureStore) {
    try {
      const v = await SecureStore.getItemAsync(REFRESH_KEY);
      if (v) return v;
    } catch (_) { /* no native module: fall back */ }
  }
  try { return await AsyncStorage.getItem(REFRESH_KEY); } catch (_) { return null; }
}
export async function setDeviceRefreshToken(t) {
  try {
    if (SecureStore) {
      try {
        if (t) await SecureStore.setItemAsync(REFRESH_KEY, t); else await SecureStore.deleteItemAsync(REFRESH_KEY);
        await AsyncStorage.removeItem(REFRESH_KEY); // never keep a plaintext copy
        return;
      } catch (_) { /* no native module: fall back */ }
    }
    if (t) await AsyncStorage.setItem(REFRESH_KEY, t); else await AsyncStorage.removeItem(REFRESH_KEY);
  } catch (_) {}
}

export function jwtExpiresSoon(token, aheadS = 60) {
  try {
    let b = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    const { exp } = JSON.parse(atob(b));
    return typeof exp === 'number' && exp - Date.now() / 1000 < aheadS;
  } catch (_) { return false; }
}

/** Single-flight refresh. Result: { token } | { dead } | { offline } | { none }. */
let inFlight = null;
export function refreshDeviceSession() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const profile = await getSession();
    const refreshToken = await getDeviceRefreshToken();
    if (!profile?.deviceSessionId || !refreshToken) return { none: true };
    let res;
    try {
      res = await fetch(`${String(AUTH_BASE).replace(/\/$/, '')}/auth/security/session/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken, accessToken: await getToken() }),
      });
    } catch (_) { return { offline: true }; }
    if (res.status === 401 || res.status === 400) { await alertIfReplaced(res); return { dead: true }; }
    if (!res.ok) return { offline: true };
    const data = await res.json().catch(() => null);
    if (!data?.accessToken) return { offline: true };
    await setDeviceRefreshToken(data.refreshToken);
    await saveSession({ ...((await getSession()) || {}), accessToken: data.accessToken });
    return { token: data.accessToken };
  })().finally(() => { setTimeout(() => { inFlight = null; }, 0); });
  return inFlight;
}
