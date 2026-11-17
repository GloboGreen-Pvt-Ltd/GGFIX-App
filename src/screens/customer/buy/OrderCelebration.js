import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Brand palette (BRAND teal/yellow + tints/shades).
const COLORS = ['#035C6C', '#FAA700', '#0A8A9E', '#5FC3CF', '#FFD166', '#F09406'];
const W = 300;
const H = 150;
const CX = W / 2;
const CY = H / 2;
const N = 36;

// Deterministic pseudo-random so pieces are stable across renders.
const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

const PIECES = Array.from({ length: N }, (_, i) => {
  const left = i % 2 === 0;
  const ang = (left ? Math.PI : 0) + (left ? 1 : -1) * (-0.9 + rnd(i, 1) * 1.5); // fan up/out
  const dist = 60 + rnd(i, 2) * 80;
  const kind = ['rect', 'ribbon', 'dot', 'star'][i % 4];
  return {
    kind,
    color: COLORS[i % COLORS.length],
    dx: Math.cos(ang) * dist,
    dy: Math.sin(ang) * dist * 0.6 - 10,
    fall: 25 + rnd(i, 3) * 35,
    spin: (rnd(i, 4) > 0.5 ? 1 : -1) * (360 + rnd(i, 5) * 540),
    rot0: rnd(i, 6) * 180,
    delay: rnd(i, 7) * 180,
    // static (reduced-motion / final) placement: a soft ring around the check
    sx: Math.cos(ang) * (55 + rnd(i, 8) * 70),
    sy: Math.sin(ang) * (35 + rnd(i, 9) * 30),
  };
});

function Piece({ p, t, still }) {
  const shape = p.kind === 'rect' ? { width: 8, height: 4, borderRadius: 1 }
    : p.kind === 'ribbon' ? { width: 14, height: 3, borderRadius: 2 }
    : p.kind === 'dot' ? { width: 5, height: 5, borderRadius: 3 } : null;
  const body = shape
    ? <View style={[shape, { backgroundColor: p.color }]} />
    : <Ionicons name="sparkles" size={11} color={p.color} />;
  if (still) {
    return <View style={{ position: 'absolute', left: CX + p.sx, top: CY + p.sy, opacity: 0.85, transform: [{ rotate: `${p.rot0}deg` }] }}>{body}</View>;
  }
  const tx = t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.dx, p.dx * 1.1] });
  const ty = t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.dy, p.dy + p.fall] });
  const rot = t.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot0}deg`, `${p.rot0 + p.spin}deg`] });
  const flip = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.3, 1, 0.3, 1] });
  const op = t.interpolate({ inputRange: [0, 0.05, 0.7, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View style={{ position: 'absolute', left: CX - 4, top: CY - 3, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }, { scaleY: flip }] }}>
      {body}
    </Animated.View>
  );
}

// Teal check disc with brand glow; optional one-shot party-popper burst.
export default function OrderCelebration({ celebrate, onPlayed }) {
  const t = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(celebrate ? 0.6 : 1)).current;
  const glow = useRef(new Animated.Value(celebrate ? 0 : 1)).current;
  const [mode, setMode] = React.useState(celebrate ? 'pending' : 'static');
  const anim = useRef(null);

  useEffect(() => {
    if (!celebrate) return undefined;
    let alive = true;
    onPlayed?.();
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (!alive) return;
      if (reduce) { pop.setValue(1); glow.setValue(1); setMode('static'); return; }
      setMode('burst');
      anim.current = Animated.parallel([
        Animated.timing(t, { toValue: 1, duration: 2500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(pop, { toValue: 1.1, duration: 220, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
          Animated.timing(pop, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1.6, duration: 300, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]);
      anim.current.start(({ finished }) => { if (finished && alive) setMode('static'); });
    });
    return () => { alive = false; anim.current?.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const glowScale = glow.interpolate({ inputRange: [0, 1, 1.6], outputRange: [0.8, 1, 1.18] });
  const glowOp = glow.interpolate({ inputRange: [0, 1, 1.6], outputRange: [0, 1, 0.7] });
  const pieces = useMemo(() => PIECES, []);

  return (
    <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden' }}>
        {mode === 'pending' ? null : pieces.map((p, i) => <Piece key={i} p={p} t={t} still={mode === 'static'} />)}
      </View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFD166', opacity: Animated.multiply(glowOp, 0.22), transform: [{ scale: glowScale }] }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#E5F3F5', opacity: glowOp, transform: [{ scale: glowScale }] }} />
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#5FC3CF', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#035C6C', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={40} color="#FFFFFF" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
