import React, { useLayoutEffect } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import PageHeader from '../../../components/PageHeader';
import { HEADER_SUBTITLES } from '../../../navigation/headerSubtitles';

// Shared presentation for the repair-booking and sell flow screens: palette,
// the app-wide page header, soft mint curves and the sticky CTA button.
// Purely visual — callers keep their own handlers.

export const FLOW = {
  primary: '#035C6C',
  deep: '#035C6C',
  ink: '#1C3053',
  muted: '#606e87',
  mint: '#E5F3F5',
  softMint: '#E5F3F5',
  tint: '#F0F8F9',
  border: '#E8EAEE',
  bg: '#F0F8F9',
  disabled: '#9ABEC4',
  decor1: 'rgba(3,92,108,0.07)',
  decor2: 'rgba(3,92,108,0.05)',
};

export const cardShadow = {
  shadowColor: '#1C3053', shadowOpacity: 0.05, shadowRadius: 12,
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

// ── Partner-app booking chrome (service-booking-shop BookingSteps + the
// Devices & Repair header) used by the customer repair booking screens.
const BK_ACCENT = '#035C6C';
const BK_INK = '#111111';
const BK_MUTED = '#6B7280';
const BK_LINE = '#E5E7EB';
const BK_PAGE = '#F3F4F6';
// Partner labels. The customer is the signed-in user, so "Customer" (0) is
// always done: device / repair / photos pages are step 1, the review step 2.
export const BOOKING_STEPS = ['Customer', 'Devices', 'Confirm'];

// Compact 3-step progress row; `active` is the current step's index (done
// steps show a tick) — same as the Partner app's StepProgress.
export function StepProgress({ active = 0, steps = BOOKING_STEPS }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8 }}>
      {steps.map((label, i) => {
        const on = i === active;
        const done = i < active;
        return (
          <React.Fragment key={label}>
            {i > 0 ? <View style={{ flex: 1, height: 2, borderRadius: 1, marginHorizontal: 6, backgroundColor: done || on ? BK_ACCENT : BK_LINE }} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on || done ? BK_ACCENT : '#FFFFFF', borderWidth: 1.5, borderColor: on || done ? BK_ACCENT : BK_LINE,
                }}
              >
                {done ? <Check size={11} color="#FFFFFF" strokeWidth={3} /> : (
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: on ? '#FFFFFF' : BK_MUTED }}>{i + 1}</Text>
                )}
              </View>
              <Text style={{ marginLeft: 5, fontSize: 12, fontWeight: on ? '800' : '600', color: on || done ? BK_ACCENT : BK_MUTED }}>{label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// White booking header: back circle · centred title + subtitle, then the step
// row on a hairline-bordered strip. `step` null hides the step row.
export function BookingHeader({ title, subtitle, navigation, onBack, step = null, steps }) {
  const insets = useSafeAreaInsets();
  const col = { width: '100%', maxWidth: 720, alignSelf: 'center' };
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: BK_LINE }}>
      <View style={{ paddingTop: insets.top + 6, paddingBottom: 6, paddingHorizontal: 14 }}>
        <View style={[{ flexDirection: 'row', alignItems: 'center' }, col]}>
          <Pressable
            onPress={onBack || (() => navigation.goBack())}
            hitSlop={6}
            className="items-center justify-center active:opacity-70"
            style={{ height: 36, width: 36, borderRadius: 18, backgroundColor: BK_PAGE, borderWidth: 1, borderColor: BK_LINE }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={18} color={BK_INK} strokeWidth={2} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8, alignItems: 'center' }}>
            <Text style={{ color: BK_INK, fontSize: 17, fontWeight: '800', textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontSize: 11, color: BK_MUTED, marginTop: 1, textAlign: 'center' }} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
          <View style={{ width: 36 }} />
        </View>
      </View>
      {step != null ? (
        <View style={col}>
          <StepProgress active={step} steps={steps} />
        </View>
      ) : null}
    </View>
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
