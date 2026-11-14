import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { rf } from '../../../utils/responsive';
import { BookingSheet } from './DeviceSecurityLockSheet';

// Partner "Booking Time · Estimated & Delivery Time" block for the customer's
// Devices & Repair page. Booking time is
// when the page opened; the expected delivery (default +2 hr) is picked from
// date / time chips.
const ACCENT = '#035C6C';
const INK = '#111111';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const FIELD_BG = '#F9FAFB';

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const formatDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
export const formatTime = (d) => {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};
// "Today" / "Tomorrow" / "Wed, 04 Nov" relative to `now`.
export const dayWord = (d, now) => {
  const a = startOfDay(d).getTime();
  const t = startOfDay(now).getTime();
  return a === t ? 'Today' : a === t + 86400000 ? 'Tomorrow' : formatDate(d);
};
// "45 min" · "2 hr" · "2 hr 30 min" · "1 d 4 hr".
export const formatSpan = (mins) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h} hr ${m} min` : `${h} hr`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} hr` : `${d} d`;
};

const DAYS_AHEAD = 14;
// Half-hour slots from 8:00 AM to 9:00 PM.
const TIME_SLOTS = Array.from({ length: 27 }, (_, i) => ({ h: 8 + Math.floor(i / 2), m: (i % 2) * 30 }));

function Chip({ label, on, disabled, onPress, width }) {
  return (
    <View style={{ width, padding: 4 }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected: !!on, disabled: !!disabled }}
        className={disabled ? '' : 'active:opacity-80'}
        style={{
          minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
          borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : LINE, backgroundColor: on ? '#E5F3F5' : '#FFFFFF',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Text style={{ fontSize: rf(12.5), fontWeight: on ? '800' : '600', color: on ? ACCENT : INK, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
      </Pressable>
    </View>
  );
}

export default function BookingTimeSection({ now, delivery, onChangeDelivery }) {
  const [picker, setPicker] = useState(null); // 'date' | 'time' | null
  const spanMins = Math.max(0, Math.round((delivery - now) / 60000));

  // Keep the time when the day changes; never earlier than an hour from now.
  const pickDay = (day) => {
    const next = new Date(day);
    next.setHours(delivery.getHours(), delivery.getMinutes(), 0, 0);
    const floor = new Date(now.getTime() + 60 * 60000);
    onChangeDelivery(next < floor ? floor : next);
    setPicker(null);
  };
  const pickTime = ({ h, m }) => {
    const next = new Date(delivery);
    next.setHours(h, m, 0, 0);
    onChangeDelivery(next);
    setPicker(null);
  };
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => new Date(startOfDay(now).getTime() + i * 86400000));
  const sameDay = startOfDay(delivery).getTime() === startOfDay(now).getTime();

  const box = { flexDirection: 'row', alignItems: 'center', height: 46, borderWidth: 1, borderColor: LINE, borderRadius: 12, backgroundColor: FIELD_BG, paddingHorizontal: 10 };

  return (
    <View style={{ paddingTop: 16 }}>
      <Text style={{ fontSize: rf(14), fontWeight: '700', color: INK, marginBottom: 8 }}>Booking Time</Text>
      <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name="event-available" size={rf(19)} color={INK} />
        <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(13), color: MUTED }}>Booking Time</Text>
        <Text style={{ fontSize: rf(13.5), fontWeight: '700', color: INK }} numberOfLines={1}>{dayWord(now, now)}, {formatTime(now)}</Text>
      </View>

    </View>
  );
}
