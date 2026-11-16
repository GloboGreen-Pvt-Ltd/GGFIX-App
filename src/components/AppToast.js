import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react-native';
import { systemNotify } from '../utils/systemNotify';

/**
 * Floating bottom toast — white rounded card, coloured icon, short title +
 * message, slides in, auto-dismisses after 3 s. <ToastHost /> is mounted once
 * at the app root (above the navigator), so a toast stays on screen while
 * login / logout swap the whole navigation tree underneath it.
 *
 *   showToast({ type: 'success', title: 'Logged in', message: 'OTP verified.' })
 *   type: 'success' (green) · 'error' (red) · 'warning' (orange) · 'info' (blue)
 *
 * The same toast fired again while it is still showing is ignored (no
 * stacking / duplicates); a different one replaces it.
 */
const TONES = {
  success: { color: '#609138', soft: '#EEF5E8', Icon: CircleCheck },
  error: { color: '#F32C26', soft: '#FEEBEA', Icon: CircleX },
  warning: { color: '#FAA700', soft: '#FFF4D6', Icon: TriangleAlert },
  info: { color: '#0788C9', soft: '#E6F3FA', Icon: Info },
};
const DURATION = 3000;

let push = null; // set by the mounted ToastHost
let current = null; // key of the toast on screen
let lastSystem = { key: null, at: 0 }; // last phone notification (dedupe window)

// Shown as a phone notification (heads-up banner); the in-app toast below is
// the fallback when notifications aren't available or allowed.
export function showToast({ type = 'info', title, message = '' } = {}) {
  if (!title) return;
  const key = `${type}|${title}|${message}`;
  if (key === current) return; // already showing — no duplicate
  if (lastSystem.key === key && Date.now() - lastSystem.at < DURATION) return;
  lastSystem = { key, at: Date.now() };
  systemNotify(title, message).then((posted) => {
    if (!posted) push?.({ key, type: TONES[type] ? type : 'info', title, message });
  });
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hide = () => {
    clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(({ finished }) => { if (finished) { current = null; setToast(null); } });
  };

  useEffect(() => {
    push = (t) => {
      current = t.key;
      clearTimeout(timer.current);
      setToast(t);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      timer.current = setTimeout(hide, DURATION);
    };
    return () => { push = null; clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!toast) return null;
  const tone = TONES[toast.type];
  const Icon = tone.Icon;
  return (
    // Bottom, clear of the tab bar / sticky buttons (~72 dp) and the home indicator.
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 72, left: 0, right: 0, alignItems: 'center', zIndex: 2000, elevation: 2000 }}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{
          width: '92%', maxWidth: 480,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        }}
      >
        <Pressable
          onPress={hide}
          accessibilityLabel={`${toast.title}. ${toast.message}`}
          style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16,
            paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEF0F2',
            borderLeftWidth: 4, borderLeftColor: tone.color,
            shadowColor: '#111111', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
          }}
        >
          <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: tone.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={19} color={tone.color} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#111111' }} numberOfLines={1}>{toast.title}</Text>
            {toast.message ? (
              <Text style={{ fontSize: 12.5, color: '#6B7280', marginTop: 1 }} numberOfLines={2}>{toast.message}</Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
