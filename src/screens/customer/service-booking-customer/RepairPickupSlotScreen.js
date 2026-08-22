import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Clock, Store, Phone } from 'lucide-react-native';
import { Card, CardTitle, Loader, BottomActionBar, Badge, useBottomBarInset } from '../../../components/rnr';
import { getShop, getShopPickupSlots } from '../../../api/shops';
import { getRepairBooking, rescheduleRepairBooking } from '../../../api/orders';
import { notify } from '../../../components/confirm';
import { rf } from '../../../utils/responsive';

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
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
        <Card className="rounded-2xl mb-3">
          <View className="flex-row items-center">
            <View className="h-12 w-12 rounded-2xl bg-primary/10 items-center justify-center mr-3">
              <Store size={22} color="#00008B" />
            </View>
            <View className="flex-1">
              <Text className="text-text-muted uppercase tracking-widest" style={{ fontSize: rf(11) }}>Pickup From</Text>
              <Text className="font-extrabold text-text mt-0.5" style={{ fontSize: rf(15) }}>{shop?.name || 'Your repair shop'}</Text>
              {(shop?.mobile || shop?.phone) ? (
                <View className="flex-row items-center mt-0.5">
                  <Phone size={11} color="#64748B" />
                  <Text className="text-text-muted ml-1" style={{ fontSize: rf(11) }}>{shop.mobile || shop.phone}</Text>
                </View>
              ) : null}
            </View>
            <Badge variant={pickupOff ? 'softDanger' : 'softSuccess'}>
              {pickupOff ? 'NO PICKUP' : 'OPEN'}
            </Badge>
          </View>
        </Card>

        <Card className="rounded-2xl mb-3">
          <CardTitle className="mb-2">Choose Pickup Date</CardTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
            {days.map((d, i) => {
              const active = dayIdx === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => { setDayIdx(i); setSlot(null); }}
                  className={`mr-2 px-4 py-2.5 rounded-2xl border min-w-[64px] items-center ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                >
                  <Text className={` font-bold tracking-widest ${active ? 'text-white/85' : 'text-text-muted'}`} style={{ fontSize: rf(10) }}>
                    {WEEKDAY[d.getDay()].toUpperCase()}
                  </Text>
                  <Text className={` font-extrabold mt-0.5 ${active ? 'text-white' : 'text-text'}`} style={{ fontSize: rf(18) }}>
                    {d.getDate()}
                  </Text>
                  <Text className={` mt-0.5 ${active ? 'text-white/85' : 'text-text-muted'}`} style={{ fontSize: rf(10) }}>
                    {d.toLocaleString('default', { month: 'short' })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>

        <Card className="rounded-2xl mb-3">
          <View className="flex-row items-center mb-2">
            <Clock size={16} color="#00008B" />
            <CardTitle className="ml-2">Pick a Time Slot</CardTitle>
          </View>
          {pickupOff ? (
            <Text className="text-text-muted" style={{ fontSize: rf(12) }}>
              This shop has paused doorstep pickup, so there are no slots to book
              right now. Please choose another shop.
            </Text>
          ) : null}
          <View className="flex-row flex-wrap -mx-1">
            {slotsToShow.map((s, i) => {
              const label = `${(s.startTime || '').slice(0, 5)} - ${(s.endTime || '').slice(0, 5)}`;
              const active = sameSlot(slot, s);
              return (
                <View key={i} style={{ width: '50%' }} className="p-1">
                  <Pressable
                    onPress={() => setSlot(s)}
                    className={`px-3 py-3 rounded-2xl border items-center ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                  >
                    <Text className={` font-bold ${active ? 'text-white' : 'text-text'}`} style={{ fontSize: rf(13) }}>{label}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Card>

        <View className="bg-primary/5 border border-primary/10 rounded-2xl p-3">
          <Text className="text-primary font-bold" style={{ fontSize: rf(12) }}>Pro tip</Text>
          <Text className="text-text-muted mt-1" style={{ fontSize: rf(11) }}>Pickup is free & on-time guaranteed. Reschedule once for free before pickup.</Text>
        </View>
      </ScrollView>

      <BottomActionBar
        title={isReschedule ? 'Confirm Re-Schedule' : 'Continue to Review'}
        onPress={onConfirm}
        loading={saving}
        disabled={!slot || pickupOff}
      />
    </View>
  );
}

