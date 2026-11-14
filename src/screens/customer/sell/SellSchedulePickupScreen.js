import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notify } from '../../../components/confirm';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Truck, Store, Calendar, Clock, MapPin, PencilLine, Navigation, Info, CheckCircle2, ChevronRight, Bike, Building2, X } from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { addressLine } from '../../../components/AddressPick';
import { rf, rlh } from '../../../utils/responsive';
import { useSellOrder, fmtPickup, SQ, cardShadow, PICKUP_KEY, quoteFulfilment } from './useSellOrder';

// Schedule Pickup / Shop Visit — after a quote is accepted: Home Pickup (the
// sell order's saved address, editable) or a visit to the chosen shop (its
// real address), a date and a time window. The server only stores a pickup
// schedule while the order is still editable, so saving after acceptance is
// not available yet: Confirm saves the choice on this phone (PICKUP_KEY) and
// the shop confirms the time by call.
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d) => `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

// "HH:mm[:ss]" / "10:00 AM" → minutes since midnight.
function toMin(t) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(String(t || '').trim());
  if (!m) return null;
  let h = Number(m[1]) % 24;
  if (m[3]) h = (h % 12) + (/PM/i.test(m[3]) ? 12 : 0);
  return h * 60 + Number(m[2]);
}
const hm = (min) => { const h = Math.floor(min / 60); return `${h % 12 || 12}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

// Two-hour windows inside the shop's pickup hours (10 AM – 6 PM when it has none).
function slotsFor(shop) {
  let from = toMin(shop?.pickupFromTime);
  let to = toMin(shop?.pickupToTime);
  if (from == null || to == null || to - from < 60) { from = 10 * 60; to = 18 * 60; }
  const out = [];
  for (let s = from; s + 60 <= to; s += 120) out.push(`${hm(s)} – ${hm(Math.min(s + 120, to))}`);
  return out;
}

// Tappable detail row: icon · label + value · trailing control.
function Row({ Icon, label, value, onPress, trailing, last }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1F2F4' }}>
      <Icon size={22} color={SQ.primary} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: rf(13), fontWeight: '800', color: SQ.navy }}>{label}</Text>
        <Text style={{ marginTop: 3, fontSize: rf(14), lineHeight: rlh(19), color: SQ.navy }}>{value}</Text>
      </View>
      {trailing || (onPress ? <ChevronRight size={20} color={SQ.navy} /> : null)}
    </Pressable>
  );
}

function PickSheet({ visible, title, options, selected, onPick, onClose, bottom }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottom + 10 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: SQ.line, marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ flex: 1, fontSize: rf(16), fontWeight: '800', color: SQ.navy }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X size={20} color={SQ.navy} /></Pressable>
          </View>
          {options.map((o, i) => {
            const on = i === selected;
            return (
              <Pressable key={o} onPress={() => { onPick(i); onClose(); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 12, marginTop: 6, borderRadius: 12, backgroundColor: on ? SQ.primarySoft : '#FFFFFF', borderWidth: 1, borderColor: on ? SQ.primary : SQ.line }}>
                <Text style={{ flex: 1, fontSize: rf(14), fontWeight: on ? '800' : '600', color: on ? SQ.primary : SQ.navy }}>{o}</Text>
                {on ? <CheckCircle2 size={18} color={SQ.primary} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SellSchedulePickupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const sellOrderId = route?.params?.sellOrderId;
  const { loading, error, order, quotes, shops, address, reload } = useSellOrder(sellOrderId);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);
  const [mode, setMode] = useState(null);   // 'pickup' | 'visit' (defaults from the shop)
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(null); // null → saved slot (or the first)
  const [sheet, setSheet] = useState(null); // 'day' | 'slot'
  const [saved, setSaved] = useState(null); // { mode, date, label, slot } kept on this phone

  useEffect(() => {
    let off = false;
    AsyncStorage.getItem(PICKUP_KEY).then((raw) => {
      const s = (JSON.parse(raw || '{}') || {})[sellOrderId];
      if (off || !s) return;
      setSaved(s);
      setMode(s.mode);
      const i = days.findIndex((d) => isoDay(d) === s.date);
      if (i >= 0) setDay(i);
    }).catch(() => {});
    return () => { off = true; };
  }, [sellOrderId, days]);

  if (loading) return <Loader label="Loading..." />;
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: SQ.page, justifyContent: 'center' }}>
        <EmptyState title="Couldn't load this order" description={error} actionLabel="Try again" onAction={reload} />
      </View>
    );
  }

  const shop = order?.shopId ? shops[order.shopId] : null;
  const chosen = quotes.find((q) => q.shopId && q.shopId === order?.shopId);
  const shopName = chosen?.shopName || shop?.name || 'the shop';
  // The quote's fulfilment (set by the shop) decides the default; the shop profile only when it's unknown.
  const method = quoteFulfilment(chosen);
  const current = mode || (method ? (method === 'SHOP_VISIT' ? 'visit' : 'pickup') : shop && shop.pickupEnabled === false ? 'visit' : 'pickup');
  const isPickup = current === 'pickup';
  const slots = slotsFor(shop);
  const slotIdx = slot != null ? Math.min(slot, slots.length - 1) : Math.max(0, slots.indexOf(saved?.slot));
  const scheduled = fmtPickup(order, saved) || null;
  const scheduledTitle = !order?.pickupDate && saved?.mode === 'visit' ? 'Visit scheduled' : 'Pickup scheduled';

  const onConfirm = async () => {
    const entry = { mode: current, date: isoDay(days[day]), label: dayLabel(days[day]), slot: slots[slotIdx] };
    try {
      const all = JSON.parse((await AsyncStorage.getItem(PICKUP_KEY)) || '{}') || {};
      all[sellOrderId] = entry;
      await AsyncStorage.setItem(PICKUP_KEY, JSON.stringify(all));
      setSaved(entry);
      notify(isPickup ? 'Pickup confirmed' : 'Visit confirmed', `${entry.label}, ${entry.slot}. ${shopName} will call to confirm.`, { preset: 'done' });
      navigation.navigate('SellOrderDetails', { sellOrderId, focus: 'progress' });
    } catch (_) {
      notify('Error', 'Could not save your schedule. Please try again.', { preset: 'error', haptic: 'error' });
    }
  };

  const ModeBtn = ({ k, Icon, text }) => {
    const on = current === k;
    return (
      <Pressable onPress={() => setMode(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? SQ.primary : SQ.primaryTint, borderWidth: 1, borderColor: on ? SQ.primary : SQ.line, ...(on ? cardShadow : null) }}>
        <Icon size={24} color={on ? '#FFFFFF' : SQ.navy} />
        <Text style={{ marginTop: 5, fontSize: rf(13.5), fontWeight: '700', color: on ? '#FFFFFF' : SQ.navy }}>{text}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: SQ.page }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
        {!order?.shopId ? (
          <View style={{ flexDirection: 'row', padding: 12, borderRadius: 14, backgroundColor: SQ.goldSoft, borderWidth: 1, borderColor: '#F5D9A8', marginBottom: 12 }}>
            <Info size={16} color="#B7791F" />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), color: '#7A5A14' }}>Accept a quote first — then choose pickup or a shop visit here.</Text>
          </View>
        ) : null}

        {scheduled ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: SQ.successSoft, borderWidth: 1, borderColor: `${SQ.success}40`, marginBottom: 12 }}>
            <CheckCircle2 size={18} color={SQ.success} />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), fontWeight: '700', color: SQ.success }}>{scheduledTitle}: {scheduled}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ModeBtn k="pickup" Icon={Truck} text="Home Pickup" />
          <ModeBtn k="visit" Icon={Store} text="Visit Shop" />
        </View>

        {isPickup && shop?.pickupEnabled ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: SQ.successSoft, borderWidth: 1, borderColor: `${SQ.success}33` }}>
            <View style={{ height: 46, width: 46, borderRadius: 12, backgroundColor: SQ.success, alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: rf(15), fontWeight: '800', color: SQ.navy }}>Free Pickup</Text>
              <Text style={{ fontSize: rf(12), lineHeight: rlh(17), color: SQ.muted, marginTop: 2 }}>{shopName} collects your device at the scheduled time.</Text>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: SQ.line, paddingHorizontal: 14, paddingVertical: 2, ...cardShadow }}>
          <Row Icon={Calendar} label={isPickup ? 'Pickup Date' : 'Visit Date'} value={dayLabel(days[day])} onPress={() => setSheet('day')} />
          <Row Icon={Clock} label={isPickup ? 'Pickup Time' : 'Visit Time'} value={slots[slotIdx]} onPress={() => setSheet('slot')} />
          {isPickup ? (
            <Row
              Icon={MapPin}
              label="Pickup Address"
              value={address ? addressLine(address) : 'No pickup address on this order'}
              last
              trailing={address ? (
                <Pressable onPress={() => navigation.navigate('AddressForm', { address })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit address" style={{ padding: 4 }}>
                  <PencilLine size={20} color={SQ.primary} />
                </Pressable>
              ) : null}
            />
          ) : (
            <Row
              Icon={Store}
              label="Shop Address"
              value={`${shopName}${shop?.address ? `\n${shop.address}` : ''}`}
              last
              trailing={shop?.latitude != null && shop?.longitude != null ? (
                <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Open in maps" style={{ padding: 4 }}>
                  <Navigation size={20} color={SQ.primary} />
                </Pressable>
              ) : null}
            />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: SQ.primaryTint, borderWidth: 1, borderColor: SQ.line }}>
          <Info size={18} color={SQ.primary} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: rf(12.5), lineHeight: rlh(17), color: SQ.navy }}>
            Your {isPickup ? 'pickup' : 'visit'} time is saved on this phone — {shopName} will call you to confirm it.
          </Text>
        </View>

        {/* Delivery illustration */}
        <View style={{ height: 120, marginTop: 16, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ position: 'absolute', left: 8, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', opacity: 0.35 }}>
            <Building2 size={46} color={SQ.primary} strokeWidth={1.3} />
            <Building2 size={34} color={SQ.primary} strokeWidth={1.3} />
          </View>
          <View style={{ position: 'absolute', right: 8, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', opacity: 0.35 }}>
            <Building2 size={34} color={SQ.primary} strokeWidth={1.3} />
            <Building2 size={50} color={SQ.primary} strokeWidth={1.3} />
          </View>
          <MapPin size={34} color={SQ.gold} fill={SQ.goldSoft} style={{ position: 'absolute', right: '30%', top: 0 }} />
          <View style={{ height: 70, width: 70, borderRadius: 35, backgroundColor: SQ.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Bike size={42} color={SQ.primary} strokeWidth={1.8} />
          </View>
          <View style={{ height: 2, alignSelf: 'stretch', backgroundColor: SQ.line, borderRadius: 1 }} />
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: SQ.line }}>
        <Pressable onPress={onConfirm} disabled={!order?.shopId} accessibilityRole="button" accessibilityState={{ disabled: !order?.shopId }} style={{ height: 54, borderRadius: 16, backgroundColor: order?.shopId ? SQ.primary : '#9ABEC4', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: rf(15.5), fontWeight: '800', color: '#FFFFFF' }}>{isPickup ? 'Confirm Pickup' : 'Confirm Visit'}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('SellOrderDetails', { sellOrderId, focus: 'progress' })} accessibilityRole="button" hitSlop={6} style={{ alignSelf: 'center', marginTop: 10 }}>
          <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: SQ.primary }}>Track your order →</Text>
        </Pressable>
      </View>

      <PickSheet visible={sheet === 'day'} title={isPickup ? 'Pickup Date' : 'Visit Date'} options={days.map((d, i) => (i === 0 ? `Today · ${dayLabel(d)}` : dayLabel(d)))} selected={day} onPick={setDay} onClose={() => setSheet(null)} bottom={Math.max(insets.bottom, 12)} />
      <PickSheet visible={sheet === 'slot'} title={isPickup ? 'Pickup Time' : 'Visit Time'} options={slots} selected={slotIdx} onPick={setSlot} onClose={() => setSheet(null)} bottom={Math.max(insets.bottom, 12)} />
    </View>
  );
}
