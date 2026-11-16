import * as Location from 'expo-location';
import { haversineKm, verifiedCoords, PICKUP_MAX_KM } from './pickupDistance';

// Approximate centre of an Indian 6-digit PIN code. Device geocoder first;
// on web (where expo-location's geocoder always throws) or on failure, falls
// back to OpenStreetMap Nominatim. Returns null when it cannot be resolved —
// never a default location. Cached per PIN.
const cache = new Map();

async function nominatimPin(pin) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=India&format=json&limit=1`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return verifiedCoords({ latitude: j?.[0]?.lat, longitude: j?.[0]?.lon });
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolvePinArea(pin) {
  const p = String(pin || '').trim();
  if (!/^\d{6}$/.test(p)) return null;
  if (cache.has(p)) return cache.get(p);
  let c = null;
  try {
    const g = (await Location.geocodeAsync(`${p}, India`))?.[0];
    c = verifiedCoords(g);
  } catch (_) { /* web / no geocoder → Nominatim */ }
  if (!c) c = await nominatimPin(p);
  if (c) cache.set(p, c);
  return c;
}

// A saved address pin is trusted only if it lies within PICKUP_MAX_KM of its
// own PIN area (catches GPS captured at another place, e.g. at the shop).
// Returns { coords, trusted, pinArea }.
export async function checkAddressLocation(addr) {
  const coords = verifiedCoords(addr);
  const pinArea = await resolvePinArea(addr?.pincode);
  const trusted = !!coords && (!pinArea || haversineKm(coords, pinArea) <= PICKUP_MAX_KM);
  return { coords, trusted, pinArea };
}
