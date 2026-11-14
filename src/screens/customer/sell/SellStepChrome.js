import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Check, ChevronLeft } from 'lucide-react-native';
import { rf, rlh } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { cardShadow } from '../service-booking-customer/FlowChrome';

// Sell wizard chrome after Device Details: "Sell Device" header with the
// 3-step progress (Device Condition → Accessories & Photos → Address & Review),
// the section card and the editing banner shared by the three steps.
const STEPS = ['Device\nCondition', 'Accessories\n& Photos', 'Address\n& Review'];
const SUBTITLES = ['Device condition & working status', 'Accessories, warranty & device photos', 'Pickup address & review'];
const GREY = '#E5E7EB';
const MUTED = '#8A93A3';

export function SellStepHeader({ step, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, paddingBottom: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF0F3' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={{ height: 40, width: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E8EAEE', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...cardShadow }}>
          <ChevronLeft size={22} color={BRAND.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: rf(19), fontWeight: '800', color: BRAND.ink }}>Sell Device</Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: rf(12.5), color: BRAND.muted }}>{SUBTITLES[step - 1]}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, paddingHorizontal: 8 }}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const on = n === step;
          return (
            <React.Fragment key={label}>
              {i ? <View style={{ flex: 1, marginTop: 13, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: done || on ? BRAND.green : '#CDD2DA' }} /> : null}
              <View style={{ width: 96, alignItems: 'center' }}>
                <View style={{ height: 28, width: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: done || on ? BRAND.green : GREY }}>
                  {done ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : <Text style={{ fontSize: rf(13), fontWeight: '800', color: on ? '#FFFFFF' : MUTED }}>{n}</Text>}
                </View>
                <Text style={{ marginTop: 4, textAlign: 'center', fontSize: rf(11), lineHeight: rlh(14), fontWeight: on ? '800' : '600', color: on ? BRAND.green : done ? BRAND.body : MUTED }}>{label}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

/** White section card with an icon tile + title (and optional subtitle). */
export function SellCard({ Icon, title, subtitle, right, children, style }) {
  return (
    <View style={[{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8EAEE', padding: 12, marginTop: 10, ...cardShadow }, style]}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          {Icon ? (
            <View style={{ height: 32, width: 32, borderRadius: 9, backgroundColor: BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Icon size={17} color={BRAND.green} />
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(16), fontWeight: '800', color: BRAND.ink }}>{title}</Text>
            {subtitle ? <Text style={{ fontSize: rf(11.5), color: BRAND.muted, marginTop: 1 }}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function EditBanner({ text }) {
  return (
    <View style={{ backgroundColor: BRAND.yellowSoft, borderColor: BRAND.yellowLine, borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name="create-outline" size={16} color={BRAND.ink} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={{ fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.5 }}>EDITING ORDER</Text>
        <Text style={{ fontSize: rf(12), color: BRAND.ink, fontWeight: '600', marginTop: 2 }}>{text}</Text>
      </View>
    </View>
  );
}

/** A selectable tile's tick badge (top-right). */
export function TickBadge() {
  return (
    <View style={{ position: 'absolute', top: 5, right: 5, height: 18, width: 18, borderRadius: 9, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center' }}>
      <Check size={11} color="#FFFFFF" strokeWidth={3} />
    </View>
  );
}

/** Bottom action bar holding the step's CTA. */
export function SellStepBar({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF0F3' }}>
      {children}
    </View>
  );
}
