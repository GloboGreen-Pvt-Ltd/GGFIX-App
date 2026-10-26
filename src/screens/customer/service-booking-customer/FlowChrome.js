import React, { useLayoutEffect } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import PageHeader from '../../../components/PageHeader';
import { HEADER_SUBTITLES } from '../../../navigation/headerSubtitles';

// Shared presentation for the repair-booking and sell flow screens: palette,
// the app-wide page header, soft mint curves and the sticky CTA button.
// Purely visual — callers keep their own handlers.

export const FLOW = {
  primary: '#00795F',
  deep: '#005C49',
  ink: '#07142F',
  muted: '#657895',
  mint: '#DDFBF2',
  softMint: '#E9FBF6',
  tint: '#F4FCF9',
  border: '#E5EBEF',
  bg: '#FAFCFC',
  disabled: '#8FC5B8',
  decor1: 'rgba(0,168,120,0.07)',
  decor2: 'rgba(0,168,120,0.05)',
};

export const cardShadow = {
  shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 }, elevation: 2,
};

// Hides the stack's default header for the calling screen (this component
// draws its own). Route + title are unchanged.
export function useHideStackHeader(navigation) {
  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);
}

// Soft translucent mint curves in the upper-right corner. Never takes touches.
// `palette` (FLOW-shaped, e.g. BRAND_FLOW) recolours it; defaults to FLOW.
export function FlowDecor({ height = 220, palette = FLOW }) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width, right: -width * 0.5, top: -width * 0.55, backgroundColor: palette.decor1 }} />
      <View style={{ position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: width, right: -width * 0.42, top: -width * 0.18, backgroundColor: palette.decor2 }} />
    </View>
  );
}

// Header: the app-wide PageHeader (back · title + subtitle · optional action).
// The subtitle defaults to this route's entry in HEADER_SUBTITLES; `onBack`
// defaults to navigation.goBack().
export function FlowHeader({ title, subtitle, navigation, onBack, right }) {
  const route = useRoute();
  return (
    <PageHeader
      title={title}
      subtitle={subtitle ?? HEADER_SUBTITLES[route.name]}
      onBack={onBack || (() => navigation.goBack())}
      right={right}
    />
  );
}

// Large rounded CTA used inside BottomActionBar's children slot.
// NOTE: plain style objects only — NativeWind's cssInterop drops function-form
// `style={({ pressed }) => ...}` on native.
export function FlowCta({ title, onPress, disabled, loading, palette = FLOW }) {
  const P = palette;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      className={off ? '' : 'active:opacity-90'}
      style={{
        height: 58, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: off ? P.disabled : P.deep,
        shadowColor: P.deep, shadowOpacity: off ? 0 : 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
        elevation: off ? 0 : 3,
      }}
    >
      <Text style={{ color: off ? 'rgba(255,255,255,0.85)' : '#fff', fontSize: rf(16), fontWeight: '800', marginRight: 6 }}>
        {loading ? 'Please wait…' : title}
      </Text>
      {loading ? null : <ChevronRight size={20} color={off ? 'rgba(255,255,255,0.85)' : '#fff'} />}
    </Pressable>
  );
}
