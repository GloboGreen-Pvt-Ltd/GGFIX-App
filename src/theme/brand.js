// Brand palette (F84141 · 09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23) plus
// tints derived from it. Used by the Sell flow and the Your Device screen.
export const BRAND = {
  green: '#09AD2A',
  red: '#F84141',
  ink: '#1E1E1E',
  bg: '#F8F8F8',
  line: '#F3F3F3',
  yellow: '#F3BF23',
  card: '#FFFFFF',
  muted: 'rgba(30,30,30,0.55)',
  body: 'rgba(30,30,30,0.80)',
  ring: 'rgba(30,30,30,0.25)',
  hairline: 'rgba(30,30,30,0.14)',
  inkSoft: 'rgba(30,30,30,0.06)',
  greenDeep: '#0D9028', // #09AD2A shaded 20% toward ink — gradients, green text on tints
  greenSoft: 'rgba(9,173,42,0.10)',
  greenFaint: 'rgba(9,173,42,0.05)',
  greenLine: 'rgba(9,173,42,0.45)',
  divider: 'rgba(30,30,30,0.08)',
  redSoft: 'rgba(248,65,65,0.10)',
  yellowSoft: 'rgba(243,191,35,0.18)',
  yellowLine: 'rgba(243,191,35,0.45)',
};

// Same keys as FlowChrome's FLOW, so the shared header / CTA / decor can be
// drawn in the brand palette by passing `palette={BRAND_FLOW}`.
export const BRAND_FLOW = {
  primary: BRAND.green,
  deep: BRAND.green,
  ink: BRAND.ink,
  muted: BRAND.muted,
  mint: BRAND.greenSoft,
  softMint: BRAND.greenSoft,
  tint: BRAND.greenSoft,
  border: BRAND.line,
  bg: BRAND.bg,
  disabled: '#90DA9F', // 45% #09AD2A on white
  decor1: 'rgba(9,173,42,0.06)',
  decor2: 'rgba(9,173,42,0.04)',
};
