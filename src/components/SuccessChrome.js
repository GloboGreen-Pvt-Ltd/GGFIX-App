import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Clock, Leaf } from 'lucide-react-native';
import { rf } from '../utils/responsive';
import { BRAND } from '../theme/brand';

// Compact success-page pieces shared by Buy · Sell · Repair "submitted" pages
// (palette: 09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23).
export const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
export const MINT = '#EAF8EC';
export const LINE = '#E6E6E6';
export const YELLOW_SOFT = '#FEF6DA';
export const MUTED = '#6B6B6B';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 };

const CONFETTI = [
  [-62, -12, MINT, 6], [-48, -42, BRAND.yellow, 5], [-26, -58, '#FFFFFF', 4], [32, -58, MINT, 5],
  [56, -34, '#FFFFFF', 4], [64, 4, BRAND.yellow, 6], [50, 38, MINT, 4], [-58, 30, '#FFFFFF', 4],
];

// Green hero: logo · check disc with confetti · title · subtitle · chips.
// chips: [{ icon?: Component, text, selectable? }]
export function SuccessHero({ title, subtitle, chips = [] }) {
  const RING = 104;
  return (
    <LinearGradient colors={['#078F23', '#09AD2A', '#22B843']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 44, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, right: -100, top: -90, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, left: -110, bottom: -70, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Leaf size={96} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', right: -6, bottom: 30, transform: [{ rotate: '-25deg' }] }} />
        <Leaf size={64} color="rgba(255,255,255,0.07)" style={{ position: 'absolute', left: 12, top: 96, transform: [{ rotate: '30deg' }] }} />
      </View>
      <SafeAreaView edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 26, height: 26, borderRadius: 7 }} resizeMode="cover" />
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: rf(14), marginLeft: 7, letterSpacing: 0.6 }}>GGFIX</Text>
        </View>
        <View style={{ alignItems: 'center', paddingTop: 4, paddingHorizontal: 20 }}>
          <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <View style={{ position: 'absolute', width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <View style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.16)' }} />
            {CONFETTI.map(([x, y, c, s], i) => (
              <View key={i} style={{ position: 'absolute', left: RING / 2 + x, top: RING / 2 + y, width: s, height: s, borderRadius: i % 2 ? s / 2 : 1.5, backgroundColor: c, transform: [{ rotate: `${i * 35}deg` }] }} />
            ))}
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 }}>
              <Check size={28} color={BRAND.green} strokeWidth={3.2} />
            </View>
          </View>
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: rf(20), marginTop: 4, textAlign: 'center', letterSpacing: -0.3 }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: rf(12), marginTop: 4, textAlign: 'center', paddingHorizontal: 14, lineHeight: rf(17) }}>{subtitle}</Text>
          ) : null}
          {chips.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
              {chips.map((c) => {
                const Icon = c.icon;
                return (
                  <View key={c.text} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, margin: 3, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' }}>
                    {Icon ? <Icon size={13} color={BRAND.yellow} style={{ marginRight: 5 }} /> : null}
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(11.5), letterSpacing: 0.3 }} selectable={!!c.selectable}>{c.text}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// White card with a small green icon disc + title (+ optional right node).
export function SuccessCard({ icon: Icon, title, right, children, raised }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 11, marginBottom: 9,
        ...(raised ? { shadowColor: BRAND.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 } : cardShadow),
      }}
    >
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          {Icon ? (
            <View style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Icon size={14} color="#FFFFFF" />
            </View>
          ) : null}
          <Text style={{ flex: 1, fontSize: rf(14), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

// Small status pill (yellow by default) for a card header.
export function StatusPill({ icon: Icon, text, tone = 'yellow' }) {
  const bg = tone === 'green' ? MINT : YELLOW_SOFT;
  const fg = tone === 'green' ? GREEN_TEXT : BRAND.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '52%' }}>
      {Icon ? <Icon size={11} color={tone === 'green' ? GREEN_TEXT : BRAND.yellow} /> : null}
      <Text style={{ fontSize: rf(10), fontWeight: '800', color: fg, marginLeft: Icon ? 4 : 0 }} numberOfLines={1}>{text}</Text>
    </View>
  );
}

// Compact label/value row with a mint icon disc.
export function InfoRow({ icon: Icon, label, value, sub, last }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: last ? 0 : 1, borderBottomColor: BRAND.line }}>
      <View style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
        {Icon ? <Icon size={14} color={GREEN_TEXT} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: rf(9), color: MUTED, letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink, marginTop: 1, lineHeight: rf(17) }}>{value || '-'}</Text>
        {sub ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1, lineHeight: rf(15) }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// "What happens next" timeline. steps: [{ icon, title, sub, state: 'done'|'wait'|'todo' }]
export function NextSteps({ title = 'What happens next', steps }) {
  return (
    <SuccessCard title={title}>
      <View style={{ marginTop: 6 }}>
        {steps.map((s, i) => {
          const Icon = s.icon;
          const done = s.state === 'done';
          const wait = s.state === 'wait';
          return (
            <View key={s.title}>
              {i > 0 ? <View style={{ height: 8, marginLeft: 16, borderLeftWidth: 1.5, borderStyle: 'dashed', borderLeftColor: done || wait ? 'rgba(9,173,42,0.45)' : '#D6D6D6' }} /> : null}
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 7, paddingHorizontal: 8,
                  backgroundColor: done ? '#F4FBF5' : BRAND.bg, borderWidth: 1, borderColor: done ? 'rgba(9,173,42,0.22)' : BRAND.line,
                }}
              >
                <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: wait ? YELLOW_SOFT : MINT, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                  <Icon size={16} color={wait ? BRAND.yellow : GREEN_TEXT} />
                  {done || wait ? (
                    <View style={{ position: 'absolute', right: -2, bottom: -2, height: 15, width: 15, borderRadius: 8, backgroundColor: done ? BRAND.green : BRAND.yellow, borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                      {done ? <Check size={8} color="#FFFFFF" strokeWidth={3.5} /> : <Clock size={8} color={BRAND.ink} strokeWidth={3} />}
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{s.title}</Text>
                  {s.sub ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }} numberOfLines={2}>{s.sub}</Text> : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </SuccessCard>
  );
}

// Sticky two-button footer. Each: { label, icon?, trailing?, onPress, flex? }
// NOTE: Pressables take plain style objects only (NativeWind drops function styles on native).
export function SuccessActions({ secondary, primary }) {
  const insets = useSafeAreaInsets();
  const SIcon = secondary?.icon;
  const PIcon = primary?.icon;
  const PTrail = primary?.trailing;
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: LINE, paddingBottom: Math.max(insets.bottom, 10) + 6, shadowColor: BRAND.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
      {secondary ? (
        <Pressable
          onPress={secondary.onPress}
          accessibilityRole="button"
          className="active:opacity-85"
          style={{ flex: secondary.flex || 1, marginRight: 5, height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: BRAND.green, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          {SIcon ? <SIcon size={16} color={GREEN_TEXT} /> : null}
          <Text style={{ color: GREEN_TEXT, fontWeight: '800', fontSize: rf(13.5), marginLeft: SIcon ? 6 : 0 }} numberOfLines={1}>{secondary.label}</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={primary.onPress}
        accessibilityRole="button"
        className="active:opacity-90"
        style={{ flex: primary.flex || 1.4, marginLeft: secondary ? 5 : 0, height: 46, borderRadius: 14, backgroundColor: BRAND.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: BRAND.green, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
      >
        {PIcon ? <PIcon size={16} color="#FFFFFF" /> : null}
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(13.5), marginLeft: PIcon ? 6 : 0, marginRight: PTrail ? 3 : 0 }} numberOfLines={1}>{primary.label}</Text>
        {PTrail ? <PTrail size={16} color="#FFFFFF" /> : null}
      </Pressable>
    </View>
  );
}
