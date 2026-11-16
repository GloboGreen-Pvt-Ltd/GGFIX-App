// Regression tests for pickup distance + 20 km eligibility.
// Run: node --test __tests__/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const babel = require('@babel/core');

// Load the ES module source through Babel so it runs under plain Node.
const { code } = babel.transformFileSync(path.join(__dirname, '../src/utils/pickupDistance.js'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const { eligiblePickupShops, verifiedCoords, haversineKm, PICKUP_MAX_KM } = mod.exports;

const SHOP = { lat: 11.745242, lng: 79.759311 }; // Globo Green (live)
const KM_PER_DEG_LAT = 6371 * Math.PI / 180;
const addrAt = (km) => ({ lat: SHOP.lat - km / KM_PER_DEG_LAT, lng: SHOP.lng }); // due south
const shop = { id: 'gg', pickupEnabled: true, latitude: String(SHOP.lat), longitude: String(SHOP.lng) };
const run = (km) => eligiblePickupShops([shop], addrAt(km));

test('5 km → visible with 5.0 km', () => { const r = run(5); assert.equal(r.length, 1); assert.equal(r[0].distanceKm.toFixed(1), '5.0'); });
test('19.9 km → visible', () => assert.equal(run(19.9).length, 1));
test('20.0 km → visible', () => assert.equal(run(20).length, 1));
test('20.1 km → hidden', () => assert.equal(run(20.1).length, 0));
test('50 km → hidden', () => assert.equal(run(50).length, 0));
test('max is 20 km', () => assert.equal(PICKUP_MAX_KM, 20));

test('missing / invalid shop coords → hidden, never 0 km', () => {
  const bad = [
    { latitude: null, longitude: null }, { latitude: '', longitude: '79.75' }, { latitude: '11.7', longitude: '' },
    { latitude: 0, longitude: 0 }, { latitude: 'abc', longitude: 79 }, { latitude: 120, longitude: 79 }, {},
  ];
  assert.equal(eligiblePickupShops(bad, addrAt(1)).length, 0);
});
test('missing pickup-address coords → no shops (no fallback origin)', () => {
  assert.equal(eligiblePickupShops([shop], null).length, 0);
  assert.equal(eligiblePickupShops([shop], { latitude: null, longitude: null }).length, 0);
});
test('pickup-disabled shop → hidden', () => assert.equal(eligiblePickupShops([{ ...shop, pickupEnabled: false }], addrAt(1)).length, 0));
test('same verified coords → 0.0 km', () => assert.equal(eligiblePickupShops([shop], SHOP)[0].distanceKm.toFixed(1), '0.0'));
test('lat/lng order: Cuddalore → Chennai ≈ 158 km', () => {
  assert.ok(Math.abs(haversineKm({ lat: 11.748, lng: 79.7714 }, { lat: 13.0827, lng: 80.2707 }) - 158) < 1);
});
test('607001 ↔ 607106 recalculates (no stale result)', () => {
  const pin607001 = { lat: 11.7562718, lng: 79.7621771 }; // Cuddalore
  const pin607106 = { lat: 11.7601514, lng: 79.5503705 }; // Panruti
  const a = eligiblePickupShops([shop], pin607001);
  const b = eligiblePickupShops([shop], pin607106);
  const c = eligiblePickupShops([shop], pin607001);
  assert.equal(a.length, 1); assert.ok(a[0].distanceKm > 0.5 && a[0].distanceKm < 3);
  assert.equal(b.length, 0); // ~22.8 km
  assert.deepEqual(c, a);
});
test('manual PIN search cannot override address eligibility', () => {
  // Shop is near the searched PIN but 50 km from the pickup address → still hidden.
  assert.equal(eligiblePickupShops([shop], addrAt(50)).length, 0);
});
test('sorted nearest first by the same computed distance', () => {
  const near = { ...shop, id: 'near' };
  const far = { id: 'far', latitude: SHOP.lat - 10 / KM_PER_DEG_LAT, longitude: SHOP.lng };
  const r = eligiblePickupShops([far, near], SHOP);
  assert.deepEqual(r.map((s) => s.id), ['near', 'far']);
});
test('verifiedCoords accepts numeric strings', () => assert.deepEqual(verifiedCoords({ latitude: '11.5', longitude: '79.5' }), { lat: 11.5, lng: 79.5 }));

test('stale/out-of-order response cannot restore old shops', async () => {
  const { createLatestGate } = mod.exports;
  const gate = createLatestGate();
  let shown = null;
  const fetchFor = (label, delay) => { const t = gate.next(); return new Promise((r) => setTimeout(r, delay)).then(() => { if (gate.isLatest(t)) shown = label; }); };
  const slowOld = fetchFor('607001 results', 30); // previous address, slow
  const fastNew = fetchFor('607106 results', 5);  // new address, fast
  await Promise.all([slowOld, fastNew]);
  assert.equal(shown, '607106 results');
  gate.invalidate(); // address cleared → in-flight responses ignored
  const t = gate.next(); gate.invalidate(); assert.equal(gate.isLatest(t), false);
});
