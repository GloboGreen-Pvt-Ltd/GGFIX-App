// Device-session / MPIN / TPIN calls (auth-service /auth/security/*, migration 116).
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';
import { getSession, getToken, saveSession } from '../auth/session';
import { setDeviceRefreshToken } from './deviceTokens';

export const APP_TYPE = 'CUSTOMER';
const DEVICE_KEY = 'security.deviceId';

import * as SecureStoreModule from 'expo-secure-store';

const SecureStore = Platform.OS === 'web' ? null : SecureStoreModule;

function randomId() {
  const b = new Uint8Array(32);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i += 1) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Per-install random device id kept in Keystore/Keychain (reinstall → new device). */
export async function getDeviceId() {
  let id = null;
  try { if (SecureStore) id = await SecureStore.getItemAsync(DEVICE_KEY); } catch (_) { /* old build */ }
  if (!id) { try { id = await AsyncStorage.getItem(DEVICE_KEY); } catch (_) {} }
  if (!id) {
    id = randomId();
    let saved = false;
    try { if (SecureStore) { await SecureStore.setItemAsync(DEVICE_KEY, id); saved = true; } } catch (_) { /* old build */ }
    if (!saved) { try { await AsyncStorage.setItem(DEVICE_KEY, id); } catch (_) {} }
  }
  return id;
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

/** Starts the single-device session with a fresh OTP-login token. Throws err.status 409 + payload on DEVICE_LIMIT. */
export async function startDeviceSession({ replaceExisting = false } = {}) {
  const token = await getToken();
  const res = await authApi.post('/auth/security/session/start', {
    headers: bearer(token),
    skipAuthExpiry: true,
    body: {
      deviceId: await getDeviceId(),
      deviceName: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Platform.OS,
      platform: Platform.OS,
      replaceExisting,
    },
  });
  await setDeviceRefreshToken(res.refreshToken);
  const profile = (await getSession()) || {};
  await saveSession({
    ...profile,
    accessToken: res.accessToken,
    deviceSessionId: res.sessionId,
    otpExpiresAt: res.otpExpiresAt,
    lockTimeoutSeconds: res.lockTimeoutSeconds,
  });
  return res;
}

export const sessionStatus = () => authApi.get('/auth/security/session');
export const logoutDeviceSession = () => authApi.post('/auth/security/session/logout', { skipAuthExpiry: true });
export const setBiometricPreference = (enabled) => authApi.post('/auth/security/biometric', { body: { enabled } });
export const createPin = (type, pin) => authApi.post(`/auth/security/pin/${type}`, { body: { pin } });
export const verifyMpin = (pin) => authApi.post('/auth/security/mpin/verify', { body: { pin } });
export const resetPin = (type, { otpToken, newPin, verificationMethod }) =>
  authApi.post(`/auth/security/pin/${type}/reset`, { body: { otpToken, newPin, verificationMethod } });

/**
 * Fresh OTP proof for PIN reset without replacing the stored session:
 * re-runs the existing OTP login and returns only its token.
 */
export async function otpProofToken({ identifier, otp, shopLogin }) {
  const body = String(identifier).includes('@') ? { email: identifier, otp } : { mobile: identifier, otp };
  const data = await authApi.post('/auth/customer-login', { body, skipAuthExpiry: true });
  return data?.accessToken;
}

export function sendResetOtp({ identifier, shopLogin }) {
  const body = String(identifier).includes('@') ? { email: identifier } : { mobile: identifier };
  return authApi.post('/auth/customer/otp/send', { body });
}

/** Human message for server PIN errors. */
export function pinErrorMessage(e) {
  const m = String(e?.devMessage || e?.message || '');
  const left = m.match(/WRONG_PIN:(\d+)/);
  if (left) return `Incorrect PIN. ${left[1]} attempt(s) left.`;
  if (/PIN_LOCKED/.test(m)) return 'Too many wrong attempts. Try again in 15 minutes.';
  if (/check in first/i.test(m)) return 'Please check in first to use your TPIN.';
  if (/too simple/i.test(m)) return 'PIN is too simple. Avoid repeated or sequential digits.';
  if (/SESSION_EXPIRED|SESSION_REVOKED/.test(m)) return 'Session expired. Please log in again.';
  return e?.message || 'Something went wrong. Please try again.';
}
