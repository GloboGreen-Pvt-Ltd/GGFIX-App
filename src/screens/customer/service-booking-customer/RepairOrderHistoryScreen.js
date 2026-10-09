import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, CardTitle, Loader, Badge } from '../../../components/rnr';
import { getRepairBooking } from '../../../api/orders';
import { ServiceHistoryTimeline, getCurrentPhaseLabel } from '../../common/serviceHistoryPhases';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const cardStyle = { padding: 12, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: LINE, shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

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
      className="flex-1"
      style={{ backgroundColor: BRAND.bg }}
      contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#09AD2A" colors={['#09AD2A']} />}
    >
      <Card className="rounded-2xl" style={cardStyle}>
        <Text className="uppercase tracking-widest" style={{ fontSize: rf(9.5), color: GREEN_TEXT, fontWeight: '800' }}>Tracking ID</Text>
        <Text className="font-extrabold mt-0.5" style={{ fontSize: rf(15), color: BRAND.ink }}>{hashed(b?.bookingNumber)}</Text>
        <View className="flex-row items-center mt-2">
          <Text className="text-text-muted mr-1.5" style={{ fontSize: rf(11) }}>Current:</Text>
          <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: MINT }}>
            <Text style={{ fontSize: rf(11), fontWeight: '800', color: GREEN_TEXT }}>{currentLabel || 'Booking placed'}</Text>
          </View>
        </View>
        <Text className="text-text-muted mt-1" style={{ fontSize: rf(10) }}>Live status from your shop. Pull to refresh.</Text>
      </Card>

      <Card className="rounded-2xl" style={cardStyle}>
        <CardTitle className="mb-2" style={{ color: BRAND.ink }}>Service History</CardTitle>
        <ServiceHistoryTimeline events={events} status={b?.status} />
      </Card>
    </ScrollView>
  );
}
