// Soft per-category tile tint behind category artwork (Buy + Sell tabs). Each
// is a palette colour blended with white (teal, blue, orange, green, red).
const CODE_TINT = {
  MOBILE: '#E5F3F5', SMARTPHONE: '#E5F3F5',
  LAPTOP: '#E6F3FA',
  TABLET: '#FFF4D6',
  SMARTWATCH: '#EFF4EB', SMARTWATCHES: '#EFF4EB', WATCH: '#EFF4EB',
  AUDIO: '#FEEBEA', AUDIO_DEVICE: '#FEEBEA', AUDIO_DEVICES: '#FEEBEA',
};
const DEFAULT_TINT = '#F3F4F6';

export function tintFor(code) {
  return CODE_TINT[String(code || '').toUpperCase()] || DEFAULT_TINT;
}

// Category cards (Home Repair · Sell · Buy rails and the Repair tab): a soft
// pastel fill with a matching, slightly deeper border.
export const CARD_PASTEL = {
  teal: { bg: '#E3F5F4', border: '#8FD3CD' },
  blue: { bg: '#E6F2FD', border: '#9CCAF0' },
  green: { bg: '#ECF7E4', border: '#ABD78E' },
  orange: { bg: '#FFF4E1', border: '#F4C871' },
  pink: { bg: '#FDEDF0', border: '#F1A9B8' },
  purple: { bg: '#F2ECFC', border: '#C6AEEE' },
  mint: { bg: '#E6F8F1', border: '#93DABF' },
  yellow: { bg: '#FFF8E2', border: '#EFD27D' },
};
// Next colours for a second card of the same kind in one row.
export const CARD_PASTEL_CYCLE = ['teal', 'blue', 'green', 'orange', 'pink'];
const kindOf = (code) => (/WATCH/.test(code) ? 'watch' : /AUDIO|HEAD|EAR/.test(code) ? 'audio' : /LAPTOP/.test(code) ? 'laptop' : /TABLET/.test(code) ? 'tablet' : 'mobile');
// Pastel per section: 0 Repair · 1 Sell · 2 Buy.
const SECTION_PASTELS = [
  { mobile: 'teal', laptop: 'blue', tablet: 'green', watch: 'orange', audio: 'pink' },
  { mobile: 'green', laptop: 'pink', tablet: 'blue', watch: 'purple', audio: 'mint' },
  { mobile: 'blue', laptop: 'yellow', tablet: 'pink', watch: 'green', audio: 'blue' },
];
/** Pastel name for a category card — `code` is the category code or name. */
export function cardPastelName(section, code) {
  return SECTION_PASTELS[section % 3][kindOf(String(code || '').toUpperCase())];
}
/** Tones for a row of category codes in one section; a repeated colour takes
 * the next unused one. `taken` = pastel names already used in that row. */
export function cardPastels(section, codes, taken = []) {
  const seen = Object.fromEntries(taken.map((n) => [n, true]));
  return codes.map((code, i) => {
    let name = cardPastelName(section, code);
    if (seen[name]) name = CARD_PASTEL_CYCLE.find((n) => !seen[n]) || CARD_PASTEL_CYCLE[i % CARD_PASTEL_CYCLE.length];
    seen[name] = true;
    return CARD_PASTEL[name];
  });
}
