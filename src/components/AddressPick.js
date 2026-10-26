import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus, Home, Briefcase, MapPin, ChevronRight } from 'lucide-react-native';
import { rf } from '../utils/responsive';
import { BRAND } from '../theme/brand';

// Compact address picker pieces shared by the Sell and Repair "Select Address"
// pages (palette: 09AD2A · 1E1E1E · F8F8F8 · F3F3F3).
const GREEN_TEXT = '#078F23';
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const GREEN_LINE = 'rgba(9,173,42,0.45)';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

function iconFor(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('home')) return Home;
  if (l.includes('work') || l.includes('office')) return Briefcase;
  return MapPin;
}

// Door no. → Area → Taluk → District → State → Pincode, falling back to the
// legacy columns (locality / city) on older rows.
export function addressLine(a) {
  return [a.addressLine, a.area || a.locality, a.taluk, a.district || a.city, a.state, a.pincode]
    .filter(Boolean).join(', ');
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
export function AddAddressRow({ onPress, subtitle = 'Save a new address' }) {
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-85"
      accessibilityRole="button"
      accessibilityLabel="Add new address"
      style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4FBF5',
        borderWidth: 1, borderStyle: 'dashed', borderColor: GREEN_LINE, borderRadius: 14,
        paddingVertical: 8, paddingHorizontal: 10, marginBottom: 9,
      }}
    >
      <View style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
        <Plus size={16} color={GREEN_TEXT} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: rf(13), fontWeight: '800', color: GREEN_TEXT }} numberOfLines={1}>Add new address</Text>
        <Text style={{ fontSize: rf(10.5), color: BRAND.muted, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text>
      </View>
      <ChevronRight size={16} color={GREEN_TEXT} />
    </Pressable>
  );
}

export function AddressOptionCard({ a, active, onPress }) {
  const Icon = iconFor(a.label);
  const line = addressLine(a);
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-90"
      accessibilityRole="radio"
      accessibilityState={{ checked: !!active }}
      accessibilityLabel={a.label || 'Address'}
      style={{
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: active ? '#F7FCF8' : '#FFFFFF', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, marginBottom: 8,
        borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : LINE,
        ...cardShadow,
      }}
    >
      <View style={{ height: 32, width: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9, backgroundColor: active ? BRAND.green : MINT }}>
        <Icon size={15} color={active ? '#FFFFFF' : GREEN_TEXT} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flexShrink: 1, fontSize: rf(13), fontWeight: '800', color: BRAND.ink, marginRight: 6 }} numberOfLines={1}>{a.label || 'Address'}</Text>
          {a.isDefault ? (
            <View style={{ backgroundColor: MINT, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1.5 }}>
              <Text style={{ fontSize: rf(8.5), fontWeight: '800', color: GREEN_TEXT, letterSpacing: 0.5 }}>DEFAULT</Text>
            </View>
          ) : null}
        </View>
        {(a.fullName || a.mobile) ? (
          <Text style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 2 }} numberOfLines={1}>{a.fullName}{a.mobile ? `${a.fullName ? ' · ' : ''}${a.mobile}` : ''}</Text>
        ) : null}
        {line ? (
          <Text style={{ fontSize: rf(11.5), color: BRAND.body, marginTop: 2, lineHeight: rf(16) }} numberOfLines={2}>{line}</Text>
        ) : null}
      </View>
      <View style={{ height: 18, width: 18, borderRadius: 9, borderWidth: 2, borderColor: active ? BRAND.green : '#C9C9C9', alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginTop: 7 }}>
        {active ? <View style={{ height: 9, width: 9, borderRadius: 5, backgroundColor: BRAND.green }} /> : null}
      </View>
    </Pressable>
  );
}
