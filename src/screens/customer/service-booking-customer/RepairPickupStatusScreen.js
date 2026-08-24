import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Check, Truck, MapPin, Hash } from 'lucide-react-native';
import {
  AppHeader, Card, Loader, ScreenContainer, StatusChip,
} from '../../../components/rnr';
import { tokens } from '../../../theme/colors';
import { getRepairBooking } from '../../../api/orders';
import { rf } from '../../../utils/responsive';

const PICKUP_STEPS = [
  { key: 'PICKUP_REQUESTED', label: 'Pickup Requested', aliases: ['ORDER_PLACED', 'BOOKING_CREATED_BY_SHOP'] },
  { key: 'PICKUP_ACCEPTED', label: 'Pickup Accepted', aliases: ['ORDER_SERVICE_CONFIRMED', 'SERVICE_ACCEPTED'] },
  { key: 'PICKUP_PERSON_ASSIGNED', label: 'Pickup Person Assigned', aliases: ['PICKUP_ASSIGNED', 'PICKUP_REASSIGNED'] },
  { key: 'PICKUP_ON_THE_WAY', label: 'Pickup Person On The Way', aliases: [] },
  { key: 'REACHED_CUSTOMER_LOCATION', label: 'Reached Customer Location', aliases: [] },
  { key: 'REPAIR_ESTIMATE_PROCESSING', label: 'Repair Estimate Processing', aliases: ['ESTIMATE_PROCESSING', 'ESTIMATE_SUBMITTED'] },
  { key: 'DEVICE_PICKED_UP', label: 'Device Picked Up', aliases: ['PICKED_UP', 'DEVICE_RECEIVED'] },
  { key: 'REACHED_SHOP', label: 'Reached Shop', aliases: ['DEVICE_DELIVERY_TO_SHOP'] },
];

function eventForStep(step, eventByStatus) {
  if (eventByStatus[step.key]) return eventByStatus[step.key];
  for (const a of (step.aliases || [])) {
    if (eventByStatus[a]) return eventByStatus[a];
  }
  return null;
}

const fmt = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};
const hashed = (n) => (n ? (String(n).startsWith('#') ? n : `#${n}`) : '');

export default function RepairPickupStatusScreen({ navigation, route }) {
  const { bookingId } = route.params || {};
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try { setB(await getRepairBooking(bookingId)); } catch (_) {}
  }, [bookingId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => { await load(); if (active) setLoading(false); })();
    timer.current = setInterval(load, 10000);
    return () => { active = false; if (timer.current) clearInterval(timer.current); };
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <Loader label="Loading pickup status..." />;

  const statusUpper = (b?.status || '').toUpperCase();
  const events = b?.events || [];
  const eventByStatus = {};
  events.forEach((e) => { eventByStatus[(e.status || '').toUpperCase()] = e; });

  let currentIdx = -1;
  for (let i = PICKUP_STEPS.length - 1; i >= 0; i -= 1) {
    if (eventForStep(PICKUP_STEPS[i], eventByStatus)) { currentIdx = i; break; }
  }
  if (currentIdx === -1) {
    currentIdx = PICKUP_STEPS.findIndex((s) => s.key === statusUpper || (s.aliases || []).includes(statusUpper));
  }
  if (currentIdx === -1) currentIdx = 0;
  const currentLabel = PICKUP_STEPS[currentIdx]?.label || (b?.status || '').replace(/_/g, ' ');

  return (
    <ScreenContainer>
      <AppHeader title="Pickup Status" subtitle="Live progress" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.primary} />}
      >
        <Card>
          <View className="flex-row items-center">
            <View className="h-12 w-12 rounded-2xl bg-accent-soft items-center justify-center mr-3">
              <Truck size={22} color={tokens.accent} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Hash size={11} color={tokens.textMuted} />
                <Text className="ml-1 text-text-muted" style={{ fontSize: rf(11) }}>{hashed(b?.bookingNumber)}</Text>
              </View>
              <Text className="font-extrabold text-text mt-0.5" style={{ fontSize: rf(15) }} numberOfLines={1}>{b?.modelName || 'Pickup'}</Text>
            </View>
            <StatusChip label={currentLabel} tone="pickup" size="sm" />
          </View>

          {b?.pickupAddress ? (
            <View className="mt-3 pt-3 border-t border-border flex-row items-start">
              <MapPin size={14} color={tokens.textMuted} />
              <Text className="ml-2 flex-1 text-text-muted leading-5" style={{ fontSize: rf(12) }} numberOfLines={3}>
                {b.pickupAddress}
              </Text>
            </View>
          ) : null}

          <Text className="text-text-subtle mt-3" style={{ fontSize: rf(10.5) }}>Live status from your shop. Pull to refresh.</Text>
        </Card>

        <View className="h-3" />
        <Card>
          {PICKUP_STEPS.map((step, i) => {
            const ev = eventForStep(step, eventByStatus);
            const reached = i <= currentIdx || !!ev;
            const isCurrent = i === currentIdx;
            const isLast = i === PICKUP_STEPS.length - 1;
            return (
              <View key={step.key} className="flex-row">
                <View className="items-center mr-3" style={{ width: 28 }}>
                  <View
                    className={`h-8 w-8 rounded-full items-center justify-center ${
                      isCurrent
                        ? 'bg-accent'
                        : reached
                        ? 'bg-primary'
                        : 'bg-card border-2 border-border'
                    }`}
                  >
                    {reached && !isCurrent ? (
                      <Check size={16} color="#fff" strokeWidth={2} />
                    ) : isCurrent ? (
                      <View className="h-3 w-3 rounded-full bg-white" />
                    ) : (
                      <View className="h-2 w-2 rounded-full bg-border-strong" />
                    )}
                  </View>
                  {!isLast ? <View className={`flex-1 w-1 my-1 rounded-full ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} /> : null}
                </View>
                <View className="flex-1 pb-5">
                  <Text className={` ${reached ? 'font-extrabold text-text' : 'text-text-muted'}`} style={{ fontSize: rf(14) }}>
                    {step.label}
                  </Text>
                  {isCurrent ? (
                    <View className="self-start mt-1 px-2 py-0.5 rounded-full bg-accent-soft">
                      <Text className="font-extrabold text-accent-dark" style={{ fontSize: rf(10) }}>CURRENT</Text>
                    </View>
                  ) : null}
                  {ev?.createdAt ? (
                    <Text className="text-text-muted mt-1" style={{ fontSize: rf(11) }}>{fmt(ev.createdAt)}</Text>
                  ) : null}
                  {ev?.note ? <Text className="text-text mt-1 leading-4" style={{ fontSize: rf(12) }}>{ev.note}</Text> : null}
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}
