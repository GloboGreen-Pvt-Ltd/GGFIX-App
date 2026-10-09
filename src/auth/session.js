import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';

export async function saveSession(session) {
  await AsyncStorage.setItem(TOKEN_KEY, session?.accessToken || '');
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(session || {}));
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function getToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function getSession() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Lets the API client notify the app when a token is rejected (expired/invalid)
// so it can clear state and route back to Login.
let authExpiredHandler = null;
export function setAuthExpiredHandler(fn) { authExpiredHandler = fn; }
export function notifyAuthExpired() {
  try { if (authExpiredHandler) authExpiredHandler(); } catch (_) {}
}

// Expiry (seconds since epoch) read from a JWT access token; null when the token
// isn't a JWT or carries no `exp`. Never throws.
export function tokenExpiry(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part || typeof atob !== 'function') return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))?.exp;
    return typeof exp === 'number' ? exp : null;
  } catch (_) {
    return null;
  }
}

// True only when the token says it has expired (30 s early, for clock skew).
export function isTokenExpired(token) {
  const exp = tokenExpiry(token);
  return exp != null && exp * 1000 <= Date.now() + 30000;
}

// User-confirmed "Log in again": drop the stored session and show Login.
export async function forceRelogin() {
  await clearSession();
  notifyAuthExpired();
}
