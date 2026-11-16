// Regression: booking photos must reach Pickup View Details.
// Run: node --test __tests__/bookingPhotos.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const complete = read('src/screens/customer/service-booking-customer/RepairCompleteOrderScreen.js');
const details = read('src/screens/customer/service-booking-customer/PickupDetailsScreen.js');

test('booking never silently drops Front/Back/Video uploads', () => {
  // The old bug: uploadMedia(...).catch(() => null) created the booking without its photos.
  for (const slot of ['front', 'back', 'video']) {
    const silent = new RegExp(`uploadMedia\\(m\\.${slot}[^\\n]*\\.catch\\(\\(\\) => null\\)`);
    assert.equal(silent.test(complete), false, `${slot} upload must not swallow errors`);
  }
  assert.match(complete, /mustUpload\(m\.front, 'front'/);
  assert.match(complete, /mustUpload\(m\.back, 'back'/);
  assert.match(complete, /mustUpload\(m\.video, 'video'/);
});

test('uploaded URLs are sent as the booking media fields', () => {
  assert.match(complete, /frontImageUrl,\s*\n\s*backImageUrl,\s*\n\s*videoUrl,/);
});

test('Pickup View Details reads the booking\'s own Front/Back/Video fields (not array positions)', () => {
  assert.match(details, /slot: 'front', url: b\.frontImageUrl/);
  assert.match(details, /slot: 'back', url: b\.backImageUrl/);
  assert.match(details, /slot: 'video', url: b\.videoUrl/);
  assert.equal(/pickupEventPhotos/.test(details), false, 'no status-event images mixed into Device Photos');
});

test('mustUpload retries once then fails loudly', async () => {
  const body = complete.slice(complete.indexOf('const mustUpload'), complete.indexOf('const [frontImageUrl'));
  let calls = 0;
  const uploadMedia = async () => { calls += 1; if (calls === 1) throw new Error('network'); return 'https://cdn.neargfix.com/Devicefiles/front-1.jpg'; };
  const mustUpload = new Function('uploadMedia', `${body}; return mustUpload;`)(uploadMedia);
  assert.equal(await mustUpload({ uri: 'file:///a.jpg' }, 'front', 'Front Side photo'), 'https://cdn.neargfix.com/Devicefiles/front-1.jpg');
  assert.equal(calls, 2);
  const failing = new Function('uploadMedia', `${body}; return mustUpload;`)(async () => { throw new Error('403'); });
  await assert.rejects(() => failing({ uri: 'file:///b.jpg' }, 'back', 'Back Side photo'), /Back Side photo/);
  assert.equal(await mustUpload(null, 'video', 'Full Coverage Video'), null); // nothing picked → nothing uploaded
});

test('thumbnail <Image> has explicit numeric size + Android resize (not absolute-fill only)', () => {
  const tile = details.slice(details.indexOf('function PhotoTile'), details.indexOf('// "02 Nov 2026'));
  assert.equal(/style=\{StyleSheet\.absoluteFillObject\}/.test(tile), false);
  assert.match(tile, /width: box\?\.w \|\| 104, height: box\?\.h \|\| height \|\| 104/);
  assert.match(tile, /resizeMode="cover" resizeMethod="resize"/);
});
