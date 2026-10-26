import {
  AUTH_BASE,
  MASTER_BASE,
  TICKET_BASE,
  TECHNICIAN_BASE,
  SHOP_BASE,
  INVENTORY_BASE,
  MARKETPLACE_BASE,
  PICKUP_BASE,
  ORDER_BASE,
  USER_BASE,
} from './config';
import { getToken, clearSession, notifyAuthExpired, isTokenExpired } from '../auth/session';
import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';

// RN's fetch has NO default timeout. Against this 12-service backend a single
// down/hung service would otherwise leave every awaiting screen stuck on a
// spinner forever. Abort after a bounded wait so callers get a real error to
// surface. Uploads get a longer budget than plain JSON calls.
const REQUEST_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 60000;

// Behind the TLS edge a base carries a routing prefix (`https://api.ggfix.in/auth`).
// `new URL(path, base)` would treat a leading-"/" path as root-relative and throw
// that prefix away, so join the two by CONCATENATION instead. Bases are stored
// without a trailing slash (see config.js); normalise here so a stray one from a
// deploy variable can't produce a double slash.
function resolveBase(baseUrlOrNull) {
  const base = baseUrlOrNull && typeof baseUrlOrNull === 'string' ? baseUrlOrNull.trim() : '';
  if (!base || !base.startsWith('http')) return AUTH_BASE.replace(/\/+$/, '');
  return base.replace(/\/+$/, '');
}

function joinUrl(base, path) {
  const p = String(path || '');
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

async function request(baseUrlOrNull, method, path, { query, body, headers, skipAuthExpiry, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const base = resolveBase(baseUrlOrNull);
  const url = new URL(joinUrl(base, path));
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const token = await getToken();
  if (token && !skipAuthExpiry && isTokenExpired(token)) {
    await clearSession();
    notifyAuthExpired();
    const err = new Error('Your session has expired. Please log in again.');
    err.status = 401;
    err.authRejected = true;
    throw err;
  }
  const urlString = url.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(urlString, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e?.name === 'AbortError';
    const baseHint =
      baseUrlOrNull && typeof baseUrlOrNull === 'string' && baseUrlOrNull.includes('localhost')
        ? ' (note: localhost on a phone means the phone itself)'
        : '';
    const msg = timedOut
      ? `Request timed out after ${Math.round(timeoutMs / 1000)}s — the server may be down or unreachable.`
      : (e?.message || 'Network request failed');
    const err = new Error(`Network request failed${baseHint}. URL: ${urlString}. ${msg}`);
    err.status = 0;
    err.timeout = timedOut;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    // A 401 only means "session is dead, log in again" when it comes from the
    // AUTH service — that service is the authority on token validity. A 401 from
    // any OTHER microservice means THAT service can't validate the token (its
    // JWT_SECRET has drifted from auth-service, or it's running an older build);
    // that must NOT clear the session and bounce the whole app to Login. A 403
    // is a real per-resource authorization failure and never clears the session.
    const isAuthService = base === AUTH_BASE;
    if (res.status === 401 && token && !skipAuthExpiry && isAuthService) {
      await clearSession();
      notifyAuthExpired();
    }
    const message = res.status === 401 && token && isAuthService
      ? 'Your session has expired. Please log in again.'
      : (json && (json.message || json.error)) || text || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = json;
    // The login itself was refused (expired / invalid token): a 401 from any
    // service, or the empty-bodied 403 user / auth services send for it.
    err.authRejected = !!token && (res.status === 401 || (res.status === 403 && !text));
    throw err;
  }

  return json;
}

// Multipart file upload. `file` is an expo-image-picker asset { uri, name,
// type } (or an equivalent object built elsewhere).
//
// This used to branch on Platform.OS: web read the uri into a real Blob via
// fetch(uri).blob(), native passed the classic RN `{ uri, name, type }`
// shorthand straight to FormData. Both are bridge-era RN patterns that break
// under the New Architecture (this app runs newArchEnabled=true, RN 0.86):
// the native shorthand throws "Unsupported FormDataPart implementation"
// (the New Architecture's rewritten Networking module doesn't recognise it),
// and Expo SDK 56+'s global `expo/fetch` makes Response.blob() fall back to
// routing bytes through React Native's OWN legacy Blob module (never
// migrated to TurboModules — see its own "TODO: use turbomodules" comment),
// which is unreliable enough to corrupt the bytes silently.
//
// expo-file-system's `File` is Expo's own New-Architecture-native
// implementation, with a purpose-built multipart upload task — no JS
// FormData/Blob bridging at all. `mimeType` is set explicitly rather than
// left to whatever a blob happened to infer, and `parameters` covers the
// extra form fields (`fields`) the old FormData path used to carry.
async function uploadRequest(baseUrlOrNull, path, { uri, name: _name, type, fields } = {}) {
  const base = resolveBase(baseUrlOrNull);
  const urlString = joinUrl(base, path);

  const parameters = {};
  if (fields) Object.entries(fields).forEach(([k, v]) => { if (v != null) parameters[k] = String(v); });

  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let result;
  try {
    if (Platform.OS === 'web') {
      // expo-file-system's File.upload() is native-only; the browser's own
      // fetch + FormData is the reliable multipart path on web.
      const blob = await fetch(uri).then((r) => r.blob());
      const form = new FormData();
      form.append('file', blob, _name || 'upload');
      Object.entries(parameters).forEach(([k, v]) => form.append(k, v));
      const res = await fetch(urlString, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form,
        signal: controller.signal,
      });
      result = { status: res.status, body: await res.text() };
    } else {
      const file = new File(uri);
      result = await file.upload(urlString, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: 'file',
        // The server validates the file's own magic bytes, not this header —
        // but an absent/wrong Content-Type still trips its declared-vs-actual
        // cross-check, so this needs to be the real type, not a guess.
        mimeType: type || 'image/jpeg',
        parameters,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
      });
    }
  } catch (e) {
    const timedOut = e?.name === 'AbortError';
    const msg = timedOut
      ? `Upload timed out after ${Math.round(UPLOAD_TIMEOUT_MS / 1000)}s.`
      : (e?.message || 'Network request failed');
    const err = new Error(`Upload failed. URL: ${urlString}. ${msg}`);
    err.status = 0;
    err.timeout = timedOut;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const { status, body: text } = result;
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (status < 200 || status >= 300) {
    // Same rule as request(): only an auth-service 401 ends the session.
    if (status === 401 && token && base === AUTH_BASE) { await clearSession(); notifyAuthExpired(); }
    const message = (json && (json.message || json.error)) || text || `HTTP ${status}`;
    const err = new Error(message);
    err.status = status;
    throw err;
  }
  return json;
}

function createClient(baseUrl) {
  return {
    get: (path, opts) => request(baseUrl, 'GET', path, opts),
    post: (path, opts) => request(baseUrl, 'POST', path, opts),
    put: (path, opts) => request(baseUrl, 'PUT', path, opts),
    patch: (path, opts) => request(baseUrl, 'PATCH', path, opts),
    del: (path, opts) => request(baseUrl, 'DELETE', path, opts),
    upload: (path, opts) => uploadRequest(baseUrl, path, opts),
  };
}

export const authApi = createClient(AUTH_BASE);
export const masterApi = createClient(MASTER_BASE);
export const ticketApi = createClient(TICKET_BASE);
export const technicianApi = createClient(TECHNICIAN_BASE);
export const shopApi = createClient(SHOP_BASE);
export const inventoryApi = createClient(INVENTORY_BASE);
export const marketplaceApi = createClient(MARKETPLACE_BASE);
export const pickupApi = createClient(PICKUP_BASE);
export const orderApi = createClient(ORDER_BASE);
export const userApi = createClient(USER_BASE);
