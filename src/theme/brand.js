// Brand palette (GGShopIndia: teal 035C6C · red F32C26 · black 111111 · light gray F3F4F6 · orange FAA700) plus
// tints derived from it. Used by the Sell flow and the Your Device screen.
export const BRAND = {
  green: '#035C6C',
  red: '#F32C26',
  ink: '#111111',
  bg: '#F3F4F6',
  line: '#F3F4F6',
  yellow: '#FAA700',
  card: '#FFFFFF',
  muted: 'rgba(17,17,17,0.55)',
  body: 'rgba(17,17,17,0.80)',
  ring: 'rgba(17,17,17,0.25)',
  hairline: 'rgba(17,17,17,0.14)',
  inkSoft: 'rgba(17,17,17,0.06)',
  greenDeep: '#035C6C', // #035C6C shaded 20% toward ink — gradients, green text on tints
  greenSoft: 'rgba(3,92,108,0.10)',
  greenFaint: 'rgba(3,92,108,0.05)',
  greenLine: 'rgba(3,92,108,0.45)',
  divider: 'rgba(17,17,17,0.08)',
  redSoft: 'rgba(243,44,38,0.10)',
  yellowSoft: 'rgba(250,167,0,0.18)',
  yellowLine: 'rgba(250,167,0,0.45)',
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
  disabled: '#9ABEC4', // 45% #035C6C on white
  decor1: 'rgba(3,92,108,0.06)',
  decor2: 'rgba(3,92,108,0.04)',
};
