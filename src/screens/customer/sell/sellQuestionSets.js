// Pure: per-category condition/functional question sets + draft answer pruning.
// The server filters by deviceCategoryId but also returns global rows (no category),
// which are phone-oriented; these sets keep only rows that fit the picked category.

const KEYS = [
  ['WATCH', /WATCH|WEARABLE|BAND/],
  ['TABLET', /TABLET|IPAD|TAB\b/],
  ['LAPTOP', /LAPTOP|NOTEBOOK|MACBOOK|COMPUTER/],
  ['AUDIO', /AUDIO|HEADPHONE|EARBUD|EARPHONE|SPEAKER|HEADSET|TWS/],
  ['MOBILE', /SMARTPHONE|MOBILE|PHONE/],
];

/** Category key from the picked category (code first, then name); null = unknown → existing behaviour. */
export function categoryKey(device, params) {
  const raw = [device?.categoryCode, params?.categoryCode, device?.categoryName, params?.categoryName]
    .filter(Boolean).join(' ').toUpperCase();
  if (!raw) return null;
  for (const [k, re] of KEYS) if (re.test(raw)) return k;
  return null;
}

// Area → keywords an issue name/code must contain.
const AREA = {
  Screen: /screen|display|lcd|oled|dead pixel|line/, Display: /screen|display|lcd|oled|dead pixel|line/,
  Touch: /touch(?!\s*id)/, Battery: /battery/, Camera: /camera|flash/, Speaker: /speaker|sound|audio/,
  Speakers: /speaker|sound|audio/, Microphone: /mic/, Charging: /charg|port/, Buttons: /button|key/,
  Network: /network|sim|signal/, 'Wi-Fi/Connectivity': /wi-?fi|bluetooth|connect|network/,
  Keyboard: /keyboard|key/, Trackpad: /trackpad|touchpad/, Ports: /port|usb|hdmi/,
  Performance: /performance|slow|hang|heat|ram|storage|boot/, Sensors: /sensor|heart|gps|strap/,
  Connectivity: /wi-?fi|bluetooth|connect|pair/, 'Sound Quality': /sound|audio|noise|volume/,
  'Bluetooth/Connectivity': /bluetooth|connect|pair|wi-?fi/,
};

export const QUESTION_SETS = {
  MOBILE: ['Screen', 'Touch', 'Battery', 'Camera', 'Speaker', 'Microphone', 'Charging', 'Buttons', 'Network'],
  TABLET: ['Display', 'Touch', 'Battery', 'Charging', 'Camera', 'Speakers', 'Wi-Fi/Connectivity'],
  LAPTOP: ['Display', 'Keyboard', 'Trackpad', 'Battery', 'Charging', 'Ports', 'Performance'],
  WATCH: ['Display', 'Touch', 'Battery', 'Charging', 'Sensors', 'Connectivity'],
  AUDIO: ['Sound Quality', 'Speakers', 'Microphone', 'Battery', 'Charging', 'Bluetooth/Connectivity'],
};

const FALLBACK_NAMES = {
  TABLET: ['Display not working', 'Touch not working', 'Battery issue', 'Charging Port not working', 'Camera not working', 'Speakers not working', 'Wi-Fi or Bluetooth not working'],
  LAPTOP: ['Display not working', 'Keyboard not working', 'Trackpad not working', 'Battery issue', 'Charging not working', 'Ports (USB/HDMI) not working', 'Performance issue (slow / overheating)'],
  WATCH: ['Display not working', 'Touch not working', 'Battery issue', 'Charging not working', 'Sensors not working', 'Bluetooth / Connectivity issue'],
  AUDIO: ['Sound Quality issue', 'Speakers not working', 'Microphone not working', 'Battery issue', 'Charging not working', 'Bluetooth / Connectivity issue'],
};

const text = (it) => `${it?.name || ''} ${it?.code || ''} ${it?.question || ''}`.toLowerCase();
const fits = (it, key) => (QUESTION_SETS[key] || []).some((a) => AREA[a]?.test(text(it)));

/**
 * Functional issues for a category. Category-specific rows (deviceCategoryId set) always stay;
 * global rows stay only when they fit the category's areas. Unknown category / MOBILE → list unchanged.
 * `fallback` = the screen's existing default names (used for MOBILE / unknown when the list is empty).
 */
export function issuesFor(list, key, fallback = []) {
  const all = Array.isArray(list) ? list : [];
  const mk = (names) => names.map((n, i) => ({ id: `f${i}`, name: n }));
  if (!key || key === 'MOBILE' || !QUESTION_SETS[key]) return all.length ? all : mk(fallback);
  const kept = all.filter((it) => it?.deviceCategoryId || fits(it, key));
  return kept.length ? kept : mk(FALLBACK_NAMES[key]);
}

/** Drop draft answers whose keys aren't in the current question set (null ids = unknown → keep). */
export function pruneMap(map, ids) {
  if (!map || !ids) return map || {};
  const ok = new Set(ids.map(String));
  return Object.fromEntries(Object.entries(map).filter(([k]) => ok.has(String(k))));
}
export const pruneList = (arr, ids) => (!ids ? arr || [] : (arr || []).filter((x) => ids.map(String).includes(String(x))));
