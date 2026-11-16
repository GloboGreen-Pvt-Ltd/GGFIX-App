// Single source of truth for pickup distance + 20 km eligibility.
// Used for filtering, sorting, the km badge and booking eligibility.

export const PICKUP_MAX_KM = 20;

// Valid { lat, lng } from an object with latitude/longitude (numbers or
// numeric strings). Missing, blank, out-of-range or 0,0 → null (never 0 km).
export function verifiedCoords(o) {
  if (!o) return null;
  const rawLa = o.latitude ?? o.lat;
  const rawLn = o.longitude ?? o.lng;
  if (rawLa == null || rawLn == null || String(rawLa).trim() === '' || String(rawLn).trim() === '') return null;
  const la = Number(rawLa);
  const ln = Number(rawLn);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

// Great-circle distance in km (Haversine).
export function haversineKm(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2
    + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Shops eligible for pickup from `origin` (the selected pickup address):
// verified shop coords, distance computed here, <= maxKm, sorted nearest first.
// Shops without verified coords are dropped — never shown as 0 km.
export function eligiblePickupShops(list, origin, maxKm = PICKUP_MAX_KM) {
  const o = verifiedCoords(origin);
  if (!o) return [];
  return (list || [])
    .map((s) => {
      if (s && s.pickupEnabled === false) return null;
      const c = verifiedCoords(s);
      if (!c) return null;
      const d = haversineKm(o, c);
      return Number.isFinite(d) ? { ...s, distanceKm: d } : null;
    })
    .filter((s) => s && s.distanceKm <= maxKm + 1e-9)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// Out-of-order guard: next() returns a token; isLatest(token) is true only for
// the most recent call, so a slow old response can never restore stale shops.
export function createLatestGate() {
  let seq = 0;
  return { next: () => ++seq, isLatest: (t) => t === seq, invalidate: () => { seq += 1; } };
}
