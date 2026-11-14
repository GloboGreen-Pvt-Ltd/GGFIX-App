import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Check, X, Ticket, Search, Home } from 'lucide-react-native';
import colors from '../../../theme/colors';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

// "Sale Request Submitted" popup, shown over the Complete Order page itself:
// it bursts in (card pop, confetti bursting out of the tick), then closes on
// its own and reveals that page. Also exports the pieces the page reuses.
export const SUCCESS = colors.success;    // palette green — tick, ribbon
const SUCCESS_DEEP = '#4A7A26';           // ribbon tails
const TEAL = BRAND.green;                  // buttons, request id
const TEAL_SOFT = 'rgba(3,92,108,0.06)';
const LINE = '#E8EAEE';
const TICK = 66;
const TICK_CENTER_Y = 18 + TICK / 2;       // card top padding + half the tick
const BURST_MS = 900;
const AUTO_CLOSE_MS = 2500;

// Confetti that bursts out of the tick and settles either side of it:
// alternating left / right, spread across the tick's height.
const CONFETTI_COLORS = ['#EC4899', '#FACC15', SUCCESS, TEAL];
const PIECES = Array.from({ length: 16 }, (_, i) => {
  const side = i % 2 ? 1 : -1;
  const t = Math.floor(i / 2) / 7;
  return {
    dx: side * (58 + ((i * 37) % 96)),
    dy: -34 + t * 44,
    rot: ((i * 53) % 160) - 80,
    w: i % 3 ? 4 : 3,
    h: i % 2 ? 10 : 12,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  };
});

function Ribbon() {
  const tail = (side) => (
    <View style={{
      width: 22, height: 26, backgroundColor: SUCCESS_DEEP, borderRadius: 3,
      [side === 'left' ? 'marginRight' : 'marginLeft']: -10,
      transform: [{ translateY: 6 }, { skewY: side === 'left' ? '-12deg' : '12deg' }],
    }} />
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 38 }}>
      {tail('left')}
      <View style={{ height: 38, justifyContent: 'center', paddingHorizontal: 18, backgroundColor: SUCCESS, borderRadius: 6, zIndex: 1 }}>
        <Text style={{ fontSize: rf(16), fontWeight: '800', color: '#FFFFFF' }} numberOfLines={1}>Sale Request Submitted</Text>
      </View>
      {tail('right')}
    </View>
  );
}

export function SuccessTick({ size = TICK }) {
  const inner = size - 10;
  return (
    <View style={{ alignSelf: 'center', height: size, width: size, borderRadius: size / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: SUCCESS, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
      <View style={{ height: inner, width: inner, borderRadius: inner / 2, backgroundColor: SUCCESS, alignItems: 'center', justifyContent: 'center' }}>
        <Check size={inner * 0.57} color="#FFFFFF" strokeWidth={3.4} />
      </View>
    </View>
  );
}

export function RequestIdChip({ sellNo, style }) {
  if (!sellNo) return null;
  return (
    <View style={[{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.2, borderStyle: 'dashed', borderColor: 'rgba(96,145,56,0.55)', backgroundColor: TEAL_SOFT, paddingHorizontal: 16, paddingVertical: 10 }, style]}>
      <Ticket size={18} color={SUCCESS} />
      <Text style={{ marginLeft: 8, fontSize: rf(12.5), color: BRAND.ink }}>Request ID</Text>
      <View style={{ width: 1, height: 18, backgroundColor: LINE, marginHorizontal: 14 }} />
      <Text selectable style={{ fontSize: rf(16), fontWeight: '800', color: TEAL }}>{sellNo}</Text>
    </View>
  );
}

export function SubmittedActions({ onTrack, onHome }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={onTrack}
        accessibilityRole="button"
        style={{ flex: 1, height: 48, marginRight: 6, borderRadius: 14, borderWidth: 1.5, borderColor: TEAL, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      >
        <Search size={17} color={TEAL} strokeWidth={2.4} />
        <Text style={{ marginLeft: 7, fontSize: rf(13.5), fontWeight: '700', color: TEAL }} numberOfLines={1}>Track Request</Text>
      </Pressable>
      <Pressable
        onPress={onHome}
        accessibilityRole="button"
        style={{ flex: 1, height: 48, marginLeft: 6, borderRadius: 14, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      >
        <Home size={17} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={{ marginLeft: 7, fontSize: rf(13.5), fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

/**
 * Small centred popup — tick burst, ribbon and message only. It closes itself
 * after AUTO_CLOSE_MS (or on Close / Back) and reveals the Complete Order page,
 * which carries the device details, Request ID and Track / Home actions.
 *
 * @param visible  open the popup (right after the sale is created)
 * @param onClose  popup finished — hide it
 */
export default function SellSubmittedPopup({ visible, onClose }) {
  const pop = useRef(new Animated.Value(0)).current;    // card entrance / exit
  const burst = useRef(new Animated.Value(0)).current;  // tick bounce, ring pulse, confetti
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(pop, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => onClose?.());
  };

  useEffect(() => {
    if (!visible) return undefined;
    closing.current = false;
    pop.setValue(0);
    burst.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(burst, { toValue: 1, duration: BURST_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(close, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  const cardScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const cardOpacity = pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] });
  const tickScale = burst.interpolate({ inputRange: [0, 0.35, 0.6, 1], outputRange: [0.3, 1.18, 0.95, 1] });
  const ringScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.1] });
  const ringOpacity = burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] });

  return (
    <Modal visible={!!visible} transparent statusBarTranslucent animationType="fade" onRequestClose={close}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24, opacity: cardOpacity }}>
        <Animated.View style={{
          width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 26, overflow: 'hidden',
          transform: [{ scale: cardScale }],
          shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 16,
        }}>
          {/* Soft green waves along the bottom edge */}
          <Svg width="100%" height={44} viewBox="0 0 400 70" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <Path d="M0 30 C 90 70, 170 0, 260 30 S 360 40, 400 10 V70 H0 Z" fill="rgba(96,145,56,0.12)" />
            <Path d="M0 50 C 100 20, 180 75, 280 45 S 370 40, 400 30 V70 H0 Z" fill="rgba(96,145,56,0.22)" />
          </Svg>

          {/* Burst: a pulse ring and confetti flying out of the tick, then settling */}
          <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: TICK_CENTER_Y, width: 0, height: 0 }}>
            <Animated.View style={{
              position: 'absolute', left: -TICK / 2, top: -TICK / 2, width: TICK, height: TICK, borderRadius: TICK / 2,
              backgroundColor: SUCCESS, opacity: ringOpacity, transform: [{ scale: ringScale }],
            }} />
            {PIECES.map((c, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute', left: -c.w / 2, top: -c.h / 2, width: c.w, height: c.h, borderRadius: 2, backgroundColor: c.color,
                  opacity: burst.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1] }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, c.dx] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, c.dy - 12, c.dy] }) },
                    { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.rot + 360}deg`] }) },
                    { scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.25, 1] }) },
                  ],
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, height: 34, width: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color={BRAND.ink} strokeWidth={2.4} />
          </Pressable>

          <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34 }}>
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <SuccessTick />
            </Animated.View>
            <View style={{ alignSelf: 'center', marginTop: -6 }}>
              <Ribbon />
            </View>
            <Text style={{ marginTop: 12, fontSize: rf(13), color: BRAND.body, textAlign: 'center', lineHeight: rf(19), paddingHorizontal: 8 }}>
              Your device sale request has been submitted successfully.
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
