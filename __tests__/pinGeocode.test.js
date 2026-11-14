// Web-safe PIN resolution + address-pin trust check (network: Nominatim).
// Run: node --test __tests__/pinGeocode.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const babel = require('@babel/core');

const load = (rel, deps) => {
  const { code } = babel.transformFileSync(path.join(__dirname, rel), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  const m = { exports: {} };
  new Function('module', 'exports', 'require', code)(m, m.exports, (id) => deps[id] || require(id));
  return m.exports;
};
const dist = load('../src/utils/pickupDistance.js', {});
// Simulate web: expo-location's geocoder always throws there.
const webLocation = { geocodeAsync: async () => { throw new Error('GeocoderError (web)'); } };
const geo = load('../src/utils/pinGeocode.js', { 'expo-location': webLocation, './pickupDistance': dist });

// Browsers send a User-Agent automatically; Node fetch does not (Nominatim requires one).
const _fetch = global.fetch;
global.fetch = (u, o = {}) => _fetch(u, { ...o, headers: { ...(o.headers || {}), 'User-Agent': 'Mozilla/5.0 (test)' } });

const SHOP = { latitude: 11.745242, longitude: 79.759311 }; // Globo Green (live API)

test('607106 address with saved pin AT the shop → untrusted, shop not eligible', async () => {
  const addr = { pincode: '607106', ...SHOP }; // GPS captured at the shop
  const r = await geo.checkAddressLocation(addr);
  assert.ok(r.pinArea, 'PIN resolved on web via Nominatim');
  const km = dist.haversineKm(r.coords, r.pinArea);
  console.log(`  607106 PIN area ${r.pinArea.lat.toFixed(4)},${r.pinArea.lng.toFixed(4)}; saved pin is ${km.toFixed(1)} km from it`);
  assert.equal(r.trusted, false);
  const fromArea = dist.eligiblePickupShops([{ ...SHOP, name: 'Globo Green' }], r.pinArea);
  console.log(`  Globo Green from 607106 area: ${dist.haversineKm(r.pinArea, { lat: SHOP.latitude, lng: SHOP.longitude }).toFixed(1)} km → ${fromArea.length ? 'shown' : 'hidden'}`);
  assert.equal(fromArea.length, 0);
});

test('607001 address with a genuine local pin → trusted, shop shown with real km', async () => {
  const addr = { pincode: '607001', latitude: 11.7562718, longitude: 79.7621771 };
  const r = await geo.checkAddressLocation(addr);
  assert.equal(r.trusted, true);
  const e = dist.eligiblePickupShops([{ ...SHOP, name: 'Globo Green' }], r.coords);
  console.log(`  Globo Green from 607001 address: ${e[0].distanceKm.toFixed(1)} km → shown`);
  assert.equal(e.length, 1);
  assert.ok(e[0].distanceKm > 0.5);
});

test('missing address coords → not trusted, no distance', async () => {
  const r = await geo.checkAddressLocation({ pincode: '607001', latitude: null, longitude: null });
  assert.equal(r.coords, null); assert.equal(r.trusted, false);
});

test('invalid PIN → null area (no default location)', async () => {
  assert.equal(await geo.resolvePinArea('12ab'), null);
});
