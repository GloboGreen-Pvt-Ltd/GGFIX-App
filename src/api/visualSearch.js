import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { File, UploadType } from 'expo-file-system';

/**
 * Visual-similarity signal for the shared product detector
 * (lib/productDetect/sources.js): a photo of the device goes to the existing
 * ggfix-visual-search-service
 * (POST /visual-search/device — CLIP image matching against the real
 * catalogue's product photos; see that service's README). Client wrapper only.
 *
 * Base URL: EXPO_PUBLIC_VISUAL_SEARCH_BASE when set; in a dev build it falls
 * back to the PC serving this bundle (same LAN host as Expo) on :8199, which is
 * where that service runs today. Empty → not configured (the scanner says so
 * instead of guessing). The login token is NOT sent — this service doesn't use it.
 */
const PATH = '/visual-search/device';
const TIMEOUT_MS = 30000;
const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

function devHost() {
  if (!__DEV__) return '';
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.location.hostname : '';
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || '';
  return String(hostUri).split(':')[0];
}

export const VISUAL_SEARCH_BASE = (() => {
  const explicit = trimSlash(process.env.EXPO_PUBLIC_VISUAL_SEARCH_BASE);
  if (explicit) return explicit;
  const h = devHost();
  return h ? `http://${h}:8199` : '';
})();

/**
 * photo: { uri, mimeType? } from expo-camera / expo-image-picker.
 * Resolves to { confidence: 'high'|'medium'|'low', bestMatch, matches } where a
 * match is { id, brand, model, modelCode, categoryName, imageUrl, similarity }.
 */
export async function visualSearchDevice(photo, { limit = 5, ocrText } = {}) {
  if (!VISUAL_SEARCH_BASE) {
    const err = new Error('Product recognition is not set up for this build.');
    err.notConfigured = true;
    throw err;
  }
  if (!photo?.uri) return { confidence: 'low', bestMatch: null, matches: [] };
  const url = `${VISUAL_SEARCH_BASE}${PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let status;
  let text;
  try {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(photo.uri)).blob();
      const form = new FormData();
      form.append('file', blob, blob.type === 'image/png' ? 'scan.png' : 'scan.jpg');
      form.append('limit', String(limit));
      if (ocrText) form.append('ocrText', ocrText);
      const res = await fetch(url, { method: 'POST', body: form, signal: controller.signal });
      status = res.status;
      text = await res.text();
    } else {
      const res = await new File(photo.uri).upload(url, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: 'file',
        mimeType: photo.mimeType || 'image/jpeg',
        parameters: { limit: String(limit), ...(ocrText ? { ocrText } : {}) },
        signal: controller.signal,
      });
      status = res.status;
      text = res.body;
    }
  } catch (e) {
    const err = new Error(e?.name === 'AbortError' ? 'Product recognition timed out.' : "Can't reach the product recognition service.");
    err.status = 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  if (status < 200 || status >= 300) {
    const err = new Error((json && (json.detail || json.message)) || `HTTP ${status}`);
    err.status = status;
    throw err;
  }
  return {
    confidence: json?.confidence || 'low',
    bestMatch: json?.bestMatch || null,
    matches: Array.isArray(json?.matches) ? json.matches : [],
    // Text the service read from the photo (newer service versions).
    ocrText: typeof json?.ocrText === 'string' ? json.ocrText : '',
  };
}
