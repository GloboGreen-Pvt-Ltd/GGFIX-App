import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { rf } from '../utils/responsive';
import { getSizeClass } from './dashboard/theme';

const CARD_TEXT = '#1C3053';   // navy category names

/** Label typography for a category card `width` dp wide — the one source every
 * category card (Home, Repair / Sell / Buy tabs) reads its name style from. */
export function categoryLabelStyle(width) {
  // Scales with the card width (≈14.5%), clamped to 10.5–14.
  const fontSize = rf(Math.max(10.5, Math.min(14, width * 0.145)));
  return { fontSize, lineHeight: Math.round(fontSize * 1.28), fontWeight: '800' };
}

// Home's page frame (HomeScreen reads these too): content width cap and side
// padding per size class.
export const HOME_MAX_W = 720;
export function homePad(windowW) {
  const sc = getSizeClass(windowW);
  return sc === 'tablet' ? 24 : sc === 'large' ? 19 : 16;
}
/** Width of a Home rail card on a screen `windowW` dp wide. */
export function homeRailCardWidthFor(windowW) {
  return homeRailCardWidth(Math.min(windowW, HOME_MAX_W), homePad(windowW));
}

// Home's Repair / Sell / Buy rails: 4 cards per row.
const HOME_RAIL_COLS = 4;
export function homeRailGap(contentW) { return contentW >= 600 ? 12 : 8; }
/** Width of one Home rail card, from the rail's content width and side padding. */
export function homeRailCardWidth(contentW, pad) {
  return Math.min(150, Math.floor((contentW - pad * 2 - homeRailGap(contentW) * (HOME_RAIL_COLS - 1)) / HOME_RAIL_COLS));
}

const SUB_TEXT = '#6B7280';

// Category grid card shared by the Repair, Sell and Buy tabs: a pastel card
// (`tone` = { bg, border } from theme/categoryTints) with the category art
// large and centred, the name in navy below and an optional one-line subtitle.
// `Icon` is shown when there's no image (or it fails), in a white circle.
//
// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native; press feedback
// uses the `active:` className.
//
// `uniform`: every card in the set is exactly the same size — a fixed height
// and a two-line label box, so a long name (Smartwatch, Audio Device) shrinks
// / wraps inside the card instead of changing it. Used for Home's 5-per-row
// rails, where cards are narrow.
// `labelForWidth`: take the name typography of a card that wide (e.g. a Home
// rail card) while this card keeps its own size.
// `labelFont`: a loaded app font for the name (e.g. Inter ExtraBold) — it
// replaces fontWeight, which custom fonts on Android can't synthesise.
export default function CategoryGridCard({ name, subtitle, uri, Icon, iconColor = '#035C6C', width, tone, active, uniform, labelForWidth, labelFont, onPress }) {
  const [broken, setBroken] = useState(false);
  const small = width < 80;
  const padH = small ? 4 : 6;
  const padV = small ? 7 : 10;
  // Large artwork: ~84% of the card width (max 140 dp, never wider than the
  // card's inner width), a little wider than tall — the same box on every card.
  const artW = Math.max(24, Math.min(140, Math.round(width * 0.84), width - padH * 2));
  const artH = Math.round(artW * 0.86);
  const well = Math.round(artH * 0.82);
  const label = categoryLabelStyle(labelForWidth || width);
  // The label box keeps this card's own line height, so the card's size never
  // depends on whose typography it borrows.
  const lineH = Math.max(categoryLabelStyle(width).lineHeight, label.lineHeight);
  const labelGap = small ? 5 : 8;
  const labelLines = uniform ? 2 : 1;
  // Fixed height (border-box, so the thickest border is budgeted in).
  const height = uniform ? padV * 2 + artH + labelGap + lineH * labelLines + 4 : undefined;
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${name}${subtitle ? `, ${subtitle}` : ''}`}
      accessibilityState={active ? { selected: true } : undefined}
      style={{
        width, height, alignItems: 'center', paddingTop: padV, paddingBottom: padV, paddingHorizontal: padH,
        borderRadius: 14, backgroundColor: tone.bg, borderWidth: active ? 2 : 1.2, borderColor: active ? iconColor : tone.border,
        shadowColor: tone.border, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
      }}
    >
      <View style={{ width: artW, height: artH, alignItems: 'center', justifyContent: 'center' }}>
        {uri && !broken ? (
          <Image resizeMethod="resize" source={{ uri }} resizeMode="contain" onError={() => setBroken(true)} style={{ width: artW, height: artH }} />
        ) : Icon ? (
          <View style={{ width: well, height: well, borderRadius: well / 2, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={Math.round(well * 0.5)} color={iconColor} strokeWidth={1.8} />
          </View>
        ) : null}
      </View>
      {/* One-line labels (Repair / Sell / Buy tab grids) get a minimum, not a
          fixed, height: Android's adjustsFontSizeToFit ignores minimumFontScale,
          and a box the line (plus font padding) can't fit made it shrink the
          name to almost nothing. Home's uniform two-line box stays fixed. */}
      <View style={{ marginTop: labelGap, [uniform ? 'height' : 'minHeight']: lineH * labelLines, justifyContent: 'center', alignSelf: 'stretch' }}>
        <Text
          numberOfLines={labelLines}
          adjustsFontSizeToFit
          minimumFontScale={uniform ? 0.7 : 0.8}
          // One-line labels render at full size: Android's extra font padding
          // overflows the line box, and adjustsFontSizeToFit then shrinks the
          // name even when it fits across.
          style={{
            ...label, color: CARD_TEXT, textAlign: 'center',
            ...(!uniform ? { includeFontPadding: false, textAlignVertical: 'center' } : null),
            // The font's own line height (a fixed one kept the shrink loop going).
            ...(labelFont ? { fontFamily: labelFont, fontWeight: 'normal', lineHeight: undefined } : null),
          }}
        >
          {name}
        </Text>
      </View>
      {subtitle ? (
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: rf(10), lineHeight: rf(13), color: SUB_TEXT, textAlign: 'center', alignSelf: 'stretch' }}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
