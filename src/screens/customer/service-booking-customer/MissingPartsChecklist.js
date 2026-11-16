import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, useWindowDimensions } from 'react-native';
import {
  Smartphone, Layers, CreditCard, CircleDot, Zap, Camera, Volume2, X,
} from 'lucide-react-native';

/**
 * Missing / Damaged Parts checklist — ported from the Partner app's
 * service-booking-shop/MissingPartsChecklist (same parts, pills and colours).
 * Controlled: `value` is { [partId]: { missing, damage, detail } } and
 * `onChange` receives a state updater.
 */
// GGFIX palette.
const ACCENT = '#035C6C';
const MINT = '#E5F3F5';
const WHITE = '#FFFFFF';
const INK = '#111111';
const MUTED = '#9CA3AF';
const SUB = '#6B7280';
const LINE = '#E5E7EB';
const HAIR = '#F3F4F6';

// Semantic colours for the flag pills: Missing = yellow, Damaged = red.
const MISSING = '#F3BF23';
const MISSING_TEXT = '#8A6A00';
const MISSING_BG = '#FFF8E1';
const DAMAGE = '#F84141';
const DAMAGE_TEXT = '#D63232';
const DAMAGE_BG = '#FEECEC';

export const PARTS = [
  { id: 'DISPLAY', name: 'Display', icon: Smartphone },
  { id: 'BACK_PANEL', name: 'Back Panel', icon: Layers },
  { id: 'SIM_TRAY', name: 'SIM Card Tray', icon: CreditCard },
  { id: 'BUTTONS', name: 'Buttons', icon: CircleDot },
  { id: 'CHARGING_PORT', name: 'Charging Port', icon: Zap },
  { id: 'CAMERA', name: 'Camera', icon: Camera },
  { id: 'SPEAKER', name: 'Speaker', icon: Volume2 },
];

// Prefill list → state map. Older drafts could carry both flags; keep Damaged.
export const seedMissingParts = (prefill) => {
  const seed = {};
  for (const p of Array.isArray(prefill) ? prefill : []) {
    const key = p.partId || p.id;
    if (!key) continue;
    seed[key] = { missing: !!p.missing && !p.damage, damage: !!p.damage, detail: p.detail || '' };
  }
  return seed;
};

// State map → flagged list ({ partId, partName, missing, damage, detail }).
export const flaggedMissingParts = (state) => PARTS
  .filter((p) => state[p.id]?.missing || state[p.id]?.damage)
  .map((p) => ({
    partId: p.id,
    partName: p.name,
    missing: !!state[p.id].missing,
    damage: !!state[p.id].damage,
    detail: state[p.id].detail || null,
  }));

// Flagged list → one readable line: "Display (Damaged – cracked), SIM Card Tray (Missing)".
export const missingPartsText = (list) => (Array.isArray(list) ? list : [])
  .map((p) => `${p.partName} (${p.damage ? 'Damaged' : 'Missing'}${p.detail ? ` – ${String(p.detail).trim()}` : ''})`)
  .join(', ');

export default function MissingPartsChecklist({ value, onChange }) {
  const { width: winW } = useWindowDimensions();
  const isTablet = winW >= 600;
  const [width, setWidth] = useState(0);

  const setField = (id, key, v) =>
    onChange((p) => ({ ...p, [id]: { ...(p[id] || {}), [key]: v } }));

  // Missing and Damaged are either/or for a part: turning one on turns the
  // other off; tapping the active one clears it.
  const setFlag = (id, key) =>
    onChange((p) => {
      const row = p[id] || {};
      const on = !row[key];
      return { ...p, [id]: { ...row, missing: key === 'missing' && on, damage: key === 'damage' && on } };
    });

  // 2 cards per row on phones, 3 on tablets.
  const gridGap = 8;
  const gridCols = isTablet ? 3 : 2;
  const cardW = width ? Math.floor((width - gridGap * (gridCols - 1)) / gridCols) : 0;

  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gridGap }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {cardW ? PARTS.map((p) => {
        const row = value[p.id] || {};
        const anyFlag = row.missing || row.damage;
        const flagColor = row.damage ? DAMAGE : (row.missing ? MISSING : null);
        const flagBg = row.damage ? DAMAGE_BG : (row.missing ? MISSING_BG : null);
        const Icon = p.icon;
        return (
          <View
            key={p.id}
            style={{
              width: cardW,
              borderRadius: 14,
              padding: 10,
              backgroundColor: anyFlag ? flagBg : WHITE,
              borderWidth: anyFlag ? 1.5 : 1,
              borderColor: anyFlag ? flagColor : HAIR,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{ height: 32, width: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: anyFlag ? WHITE : MINT }}
              >
                <Icon size={16} color={anyFlag ? flagColor : ACCENT} strokeWidth={2} />
              </View>
              <Text style={{ flex: 1, marginLeft: 8, fontSize: 13, fontWeight: '800', color: INK }} numberOfLines={2}>
                {p.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
              <FlagPill
                label="Missing"
                active={!!row.missing}
                tint={MISSING}
                tintText={MISSING_TEXT}
                tintBg={MISSING_BG}
                onPress={() => setFlag(p.id, 'missing')}
              />
              <FlagPill
                label="Damaged"
                active={!!row.damage}
                tint={DAMAGE}
                tintText={DAMAGE_TEXT}
                tintBg={DAMAGE_BG}
                onPress={() => setFlag(p.id, 'damage')}
              />
            </View>

            {anyFlag ? (
              <TextInput
                placeholder="Add details…"
                placeholderTextColor={MUTED}
                value={row.detail || ''}
                onChangeText={(v) => setField(p.id, 'detail', v)}
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                style={{
                  marginTop: 8,
                  borderRadius: 10,
                  paddingHorizontal: 9,
                  paddingVertical: 7,
                  fontSize: 12,
                  color: INK,
                  backgroundColor: WHITE,
                  borderWidth: 1,
                  borderColor: LINE,
                }}
              />
            ) : null}
          </View>
        );
      }) : null}
    </View>
  );
}

function FlagPill({ label, active, tint, tintText, tintBg, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      className="active:opacity-80"
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 30,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: active ? tintBg : WHITE,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? tint : LINE,
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!active }}
      accessibilityLabel={label}
    >
      {active ? <X size={10} color={tintText} strokeWidth={2.75} style={{ marginRight: 2 }} /> : null}
      <Text style={{ flexShrink: 1, fontSize: 11, fontWeight: '700', color: active ? tintText : SUB }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Text>
    </Pressable>
  );
}
