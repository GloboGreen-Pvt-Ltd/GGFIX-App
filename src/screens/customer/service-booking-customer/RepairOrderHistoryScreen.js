import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, CardTitle, Loader, Badge } from '../../../components/rnr';
import { getRepairBooking } from '../../../api/orders';
import { ServiceHistoryTimeline, getCurrentPhaseLabel } from '../../common/serviceHistoryPhases';
import { rf } from '../../../utils/responsive';

const hashed = (n) => (n ? (String(n).startsWith('#') ? n : `#${n}`) : '');

export default function RepairOrderHistoryScreen({ route }) {
  const { bookingId } = route.params || {};
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try { setB(await getRepairBooking(bookingId)); } catch (_) {}
  }, [bookingId]);

  // Refetch on focus + poll every 10s so shop status updates appear in near
  // real time without the customer having to reopen the app.
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => { await load(); if (active) setLoading(false); })();
    timer.current = setInterval(load, 10000);
    return () => { active = false; if (timer.current) clearInterval(timer.current); };
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <Loader label="Loading history..." />;

  const events = b?.events || [];
  const currentLabel = getCurrentPhaseLabel(events, b?.status);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00008B" />}
    >
      <Card className="rounded-2xl mb-3">
        <Text className="text-text-muted uppercase tracking-widest" style={{ fontSize: rf(10) }}>Tracking ID</Text>
        <Text className="font-extrabold text-text mt-0.5" style={{ fontSize: rf(15) }}>{hashed(b?.bookingNumber)}</Text>
        <View className="flex-row items-center mt-2">
          <Text className="text-text-muted mr-1" style={{ fontSize: rf(11) }}>Current:</Text>
          <Badge variant="softSuccess">{currentLabel || 'Booking placed'}</Badge>
        </View>
        <Text className="text-text-muted mt-1" style={{ fontSize: rf(10) }}>Live status from your shop. Pull to refresh.</Text>
      </Card>

      <Card className="rounded-2xl">
        <CardTitle className="mb-2">Service History</CardTitle>
        <ServiceHistoryTimeline events={events} status={b?.status} />
      </Card>
    </ScrollView>
  );
}
