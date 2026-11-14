/**
 * App theme tokens. Mirrored in tailwind.config.js — use the palette in
 * NativeWind className strings (e.g. `bg-primary text-white`). The named
 * default exports are kept for screens that still use StyleSheet.
 *
 * Palette: GGShopIndia colour system —
 *   Primary Teal #035C6C — primary buttons, header, key UI, navigation
 *   Navy        #1C3053 — headings, navigation, text
 *   Bright Blue #0788C9 — links, secondary buttons, icons
 *   Green       #609138 — success, in stock, positive states
 *   Orange      #FAA700 — offers, CTA highlights (navy text on it)
 *   Red         #F32C26 — sale badges, discounts, alerts
 *   White       #FFFFFF — page background, cards, content
 *   Light Gray  #F3F4F6 — section backgrounds, borders, dividers
 *   Black       #111111 — body text, icons, high contrast
 * Light tints (selected states, soft badges) are these colours blended with
 * white. light/dark aliases resolve to the same colour.
 */
export const palette = {
  teal: '#035C6C',
  navy: '#1C3053',
  blue: '#0788C9',
  green: '#609138',
  orange: '#FAA700',
  red: '#F32C26',
  white: '#FFFFFF',
  lightGray: '#F3F4F6',
  black: '#111111',
};

const tokens = {
  // Primary — teal
  primary: palette.teal,
  primaryLight: palette.teal,
  primaryDark: palette.teal,
  primarySoft: '#E5F3F5',

  // Accent — orange (offers, highlights)
  accent: palette.orange,
  accentLight: palette.orange,
  accentDark: palette.orange,
  accentSoft: '#FFF4D6',

  // Surfaces
  background: palette.white,
  card: palette.white,
  surface: palette.white,
  surfaceMuted: palette.lightGray,

  // Text — navy text / headings, black for high-contrast body copy
  text: palette.navy,
  ink: palette.black,
  textMuted: '#606E87',
  textSubtle: '#8E97A9',

  // Lines
  border: '#E8EAEE',
  borderStrong: '#D2D6DD',

  // Status
  success: palette.green,
  warning: palette.orange,
  danger: palette.red,
  error: palette.red,
  info: palette.blue,
  link: palette.blue,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  '2xl': 22,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: '#1C3053',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bar: {
    shadowColor: '#1C3053',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export default {
  ...tokens,

  // Legacy aliases used by older screens — keep them mapped to the new palette
  secondary: tokens.accent,
  backgroundCard: tokens.card,
  inputBg: tokens.surfaceMuted,
  textSecondary: tokens.textMuted,
  headerBg: tokens.card,
  headerText: tokens.text,
  tabBarBg: tokens.card,
  tabBarActive: tokens.primary,
  tabBarInactive: tokens.textMuted,
  backButtonBg: tokens.surfaceMuted,
  backButtonIcon: tokens.text,
};

export { tokens };
