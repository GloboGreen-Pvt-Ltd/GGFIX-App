import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Store, Phone, CalendarDays, Check, ChevronRight, Lightbulb } from 'lucide-react-native';
import { Card, CardTitle, Loader, BottomActionBar, Badge, useBottomBarInset } from '../../../components/rnr';
import { getShop, getShopPickupSlots } from '../../../api/shops';
import { getRepairBooking, rescheduleRepairBooking } from '../../../api/orders';
import { notify } from '../../../components/confirm';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';

function next7Days() {
  const days = [];
  const d0 = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(d0);
    d.setDate(d0.getDate() + i);
    days.push(d);
  }
  return days;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Compare slot times tolerant of "HH:mm" vs "HH:mm:ss" (booking stores seconds).
const sameSlot = (a, b) =>
  !!a && !!b &&
  (a.startTime || '').slice(0, 5) === (b.startTime || '').slice(0, 5) &&
  (a.endTime || '').slice(0, 5) === (b.endTime || '').slice(0, 5);

export default function RepairPickupSlotScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const params = route.params || {};
  useHideStackHeader(navigation);
  const rescheduleBookingId = params.rescheduleBookingId;
  const isReschedule = !!rescheduleBookingId;
  const days = next7Days();
  const [dayIdx, setDayIdx] = useState(1);
  const [slot, setSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const onConfirm = async () => {
    const pickupDate = days[dayIdx].toISOString().slice(0, 10);
    if (isReschedule) {
      setSaving(true);
      try {
        await rescheduleRepairBooking(rescheduleBookingId, {
          pickupDate,
          pickupSlotStart: slot?.startTime,
          pickupSlotEnd: slot?.endTime,
        });
        notify('Rescheduled', `Pickup moved to ${pickupDate}, ${(slot?.startTime || '').slice(0, 5)} - ${(slot?.endTime || '').slice(0, 5)}.`);
        navigation.goBack();
      } catch (e) {
        notify('Error', e?.message || 'Could not reschedule');
      } finally { setSaving(false); }
      return;
    }
    navigation.navigate('RepairCompleteOrder', {
      ...params,
      pickupDate,
      pickupSlotStart: slot?.startTime,
      pickupSlotEnd: slot?.endTime,
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // On reschedule we only get the bookingId, so resolve the shop from the
        // booking itself (it carries shopId) and prefill the current date/slot.
        let sid = params.shopId || null;
        if (!sid && rescheduleBookingId) {
          const bk = await getRepairBooking(rescheduleBookingId).catch(() => null);
          if (bk && !cancelled) {
            sid = bk.shopId || null;
            if (bk.pickupDate) {
              const d0 = String(bk.pickupDate).slice(0, 10);
              const idx = days.findIndex((d) => d.toISOString().slice(0, 10) === d0);
              if (idx >= 0) setDayIdx(idx);
            }
            if (bk.pickupSlotStart) setSlot({ startTime: bk.pickupSlotStart, endTime: bk.pickupSlotEnd });
          }
        }
        if (!sid) { if (!cancelled) setLoading(false); return; } // guard: never fetch /shops/undefined
        const [s, sl] = await Promise.all([
          getShop(sid).catch(() => null),
          getShopPickupSlots(sid).catch(() => []),
        ]);
        if (!cancelled) { setShop(s); setSlots(sl || []); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [params.shopId, rescheduleBookingId]);

  if (loading) return <Loader label="Loading slots..." />;

  // The shop's master pickup switch is off: its saved slots still exist on the
  // server but are not on offer, so nothing here may be booked. This has to be
  // checked before the fallback below — an empty slot list is exactly what a
  // pickup-off shop returns, and the fallback would otherwise invent five
  // bookable windows for a shop that is not taking pickups at all.
  // Strict `=== false`: a backend that predates the field sends undefined, and
  // reading that as "off" would block every pickup booking.
  const pickupOff = shop?.pickupEnabled === false;

  // Backend stores dayOfWeek as ISO 1..7 (Mon..Sun); null means any-day.
  // JS Date.getDay() is 0=Sun..6=Sat — convert to ISO before matching.
  const isoDow = ((days[dayIdx].getDay() + 6) % 7) + 1;
  const slotsForDay = slots.filter((s) => s.dayOfWeek == null || s.dayOfWeek === isoDow);
  const slotsToShow = pickupOff ? [] : (slotsForDay.length ? slotsForDay : (slots.length ? [] : [
    { startTime: '09:00', endTime: '11:00' },
    { startTime: '11:00', endTime: '13:00' },
    { startTime: '13:00', endTime: '15:00' },
    { startTime: '15:00', endTime: '17:00' },
    { startTime: '17:00', endTime: '19:00' },
  ]));

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <FlowDecor />
      <FlowHeader title="Select Pickup Slot" navigation={navigation} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bottomSpace }}>
        {/* Pickup from */}
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', ...cardShadow }}>
          <View style={{ height: 60, width: 60, borderRadius: 18, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Store size={27} color={FLOW.deep} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(10.5), color: FLOW.muted, letterSpacing: 1.6, fontWeight: '600' }}>PICKUP FROM</Text>
            <Text style={{ fontSize: rf(18), fontWeight: '800', color: FLOW.ink, marginTop: 2 }} numberOfLines={1}>{shop?.name || 'Your repair shop'}</Text>
            {(shop?.mobile || shop?.phone) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Phone size={15} color={FLOW.muted} />
                <Text style={{ fontSize: rf(13), color: FLOW.muted, marginLeft: 6 }}>{shop.mobile || shop.phone}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: pickupOff ? '#FEE2E2' : FLOW.mint }}>
            <View style={{ height: 8, width: 8, borderRadius: 4, marginRight: 6, backgroundColor: pickupOff ? '#DC2626' : '#12A150' }} />
            <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: pickupOff ? '#B91C1C' : FLOW.deep, letterSpacing: 0.6 }}>
              {pickupOff ? 'NO PICKUP' : 'OPEN'}
            </Text>
          </View>
          <ChevronRight size={18} color={FLOW.muted} style={{ marginLeft: 6 }} />
        </View>

        {/* Date */}
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, paddingTop: 14, paddingBottom: 12, marginBottom: 14, ...cardShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 }}>
            <View style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <CalendarDays size={20} color={FLOW.deep} />
            </View>
            <Text style={{ fontSize: rf(16.5), fontWeight: '800', color: FLOW.ink }}>Choose Pickup Date</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 4 }}>
            {days.map((d, i) => {
              const active = dayIdx === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => { setDayIdx(i); setSlot(null); }}
                  className="active:opacity-85"
                  style={{
                    width: 64, height: 88, borderRadius: 18, marginRight: 8, overflow: 'hidden',
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: active ? FLOW.deep : '#fff', borderWidth: 1, borderColor: active ? FLOW.deep : FLOW.border,
                    ...(active ? { shadowColor: FLOW.deep, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 } : {}),
                  }}
                >
                  {active ? (
                    <LinearGradient colors={['#0A8A6B', FLOW.deep]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  ) : null}
                  <Text style={{ fontSize: rf(11.5), fontWeight: '600', letterSpacing: 0.6, color: active ? 'rgba(255,255,255,0.9)' : FLOW.muted }}>
                    {WEEKDAY[d.getDay()].toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: rf(21), fontWeight: '800', marginTop: 2, color: active ? '#fff' : FLOW.ink }}>
                    {d.getDate()}
                  </Text>
                  <Text style={{ fontSize: rf(12), marginTop: 1, color: active ? 'rgba(255,255,255,0.9)' : FLOW.muted }}>
                    {d.toLocaleString('default', { month: 'short' })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Time slot */}
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, padding: 14, marginBottom: 14, ...cardShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Clock size={20} color={FLOW.deep} />
            </View>
            <Text style={{ fontSize: rf(16.5), fontWeight: '800', color: FLOW.ink }}>Pick a Time Slot</Text>
          </View>
          {pickupOff ? (
            <Text style={{ fontSize: rf(12.5), color: FLOW.muted, lineHeight: rf(18) }}>
              This shop has paused doorstep pickup, so there are no slots to book
              right now. Please choose another shop.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
            {slotsToShow.map((s, i) => {
              const label = `${(s.startTime || '').slice(0, 5)} - ${(s.endTime || '').slice(0, 5)}`;
              const active = sameSlot(slot, s);
              return (
                <View key={i} style={{ width: '50%', padding: 4 }}>
                  <Pressable
                    onPress={() => setSlot(s)}
                    className="active:opacity-85"
                    style={{
                      flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 16, paddingHorizontal: 10,
                      backgroundColor: active ? FLOW.tint : '#fff', borderWidth: active ? 1.5 : 1, borderColor: active ? FLOW.primary : FLOW.border,
                    }}
                  >
                    <Clock size={16} color={active ? FLOW.deep : FLOW.muted} />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(13.5), fontWeight: '700', color: FLOW.ink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
                    {active ? (
                      <View style={{ height: 24, width: 24, borderRadius: 12, backgroundColor: FLOW.deep, alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} color="#fff" strokeWidth={2.8} />
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* Pro tip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: FLOW.tint, borderWidth: 1, borderColor: '#CFEDE3', borderRadius: 22, padding: 14 }}>
          <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center' }}>
            <Lightbulb size={24} color={FLOW.primary} />
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#CFEDE3', marginHorizontal: 14 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(15), fontWeight: '800', color: FLOW.deep }}>Pro tip</Text>
            <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 3, lineHeight: rf(18) }}>Pickup is free & on-time guaranteed. Reschedule once for free before pickup.</Text>
          </View>
        </View>
      </ScrollView>

      <BottomActionBar>
        <FlowCta
          title={isReschedule ? 'Confirm Re-Schedule' : 'Continue to Review'}
          onPress={onConfirm}
          loading={saving}
          disabled={!slot || pickupOff}
        />
      </BottomActionBar>
    </View>
  );
}
