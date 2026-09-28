import React, { useLayoutEffect } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';

// Shared presentation for the repair-booking flow screens (Service Options,
// Pickup Shops, Select Address, Pickup Slot): palette, a header with a round
// mint back button + centred title over soft mint curves, and the sticky CTA
// button. Purely visual — callers keep their own handlers.

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
export function FlowDecor({ height = 220 }) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width, right: -width * 0.5, top: -width * 0.55, backgroundColor: 'rgba(0,168,120,0.07)' }} />
      <View style={{ position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: width, right: -width * 0.42, top: -width * 0.18, backgroundColor: 'rgba(0,168,120,0.05)' }} />
    </View>
  );
}

// Header: round mint back button · centred title (centred on the screen, not
// the remaining space). `onBack` defaults to navigation.goBack().
export function FlowHeader({ title, navigation, onBack, backStyle = 'mint' }) {
  const white = backStyle === 'white';
  return (
    <SafeAreaView edges={['top']}>
      <View style={{ height: 60, justifyContent: 'center', paddingHorizontal: 16 }}>
        <Text
          numberOfLines={1}
          style={{ position: 'absolute', left: 70, right: 70, textAlign: 'center', fontSize: rf(18), fontWeight: '800', color: FLOW.ink }}
        >
          {title}
        </Text>
        <Pressable
          onPress={onBack || (() => navigation.goBack())}
          accessibilityLabel="Back"
          hitSlop={6}
          className="active:opacity-80"
          style={{
            height: 46, width: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
            backgroundColor: white ? '#fff' : FLOW.softMint,
            ...(white ? cardShadow : {}),
          }}
        >
          <ArrowLeft size={21} color={FLOW.ink} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Large rounded CTA used inside BottomActionBar's children slot.
// NOTE: plain style objects only — NativeWind's cssInterop drops function-form
// `style={({ pressed }) => ...}` on native.
export function FlowCta({ title, onPress, disabled, loading }) {
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
        backgroundColor: off ? FLOW.disabled : FLOW.deep,
        shadowColor: FLOW.deep, shadowOpacity: off ? 0 : 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
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
