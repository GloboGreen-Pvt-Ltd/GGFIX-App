import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Loader, PrimaryButton, OutlineButton } from '../../../components/ui';
import { getShop, listNearbyShops } from '../../../api/shops';
import { isShopOpen } from '../../../utils/shopHours';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { rf } from '../../../utils/responsive';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { height: 200, backgroundColor: '#E5E7EB' },
  openTag: { position: 'absolute', left: 10, top: 10, backgroundColor: '#004C40', color: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontSize: rf(11), fontWeight: '700' },
  body: { padding: 16 },
  name: { fontSize: rf(20), fontWeight: '800', color: colors.text },
  addr: { fontSize: rf(13), color: colors.text, marginTop: 8 },
  row: { flexDirection: 'row', marginTop: 16 },
  serviceRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  serviceTile: { width: '46%', margin: '2%', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  serviceText: { marginLeft: 8, fontSize: rf(13), color: colors.text, fontWeight: '600' },
});

const WORKING_DAYS_LABEL = {
  MON_FRI: 'Monday - Friday',
  MON_SAT: 'Monday - Saturday',
  MON_SUN: 'All days',
};

export default function ShopDetailsScreen({ route, navigation }) {
  const { shopId } = route.params || {};
  const { lat, lng } = useCustomerLocation();
  const [shop, setShop] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Pass the customer's location so the server returns distanceKm and the
        // nearby feed actually populates — it returns [] without coords, which
        // is why this section used to be permanently empty.
        const [s, n] = await Promise.all([
          getShop(shopId, { lat, lng }),
          listNearbyShops({ lat, lng, radiusKm: 25 }).catch(() => []),
        ]);
        if (cancelled) return;
        setShop(s);
        setNearby((n || []).filter((x) => x.id !== shopId));
      } catch (_) {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shopId, lat, lng]);
  const openState = isShopOpen(shop); // true = open, false = closed, null = hours unknown
  if (loading) return <Loader />;
  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        {openState === true ? (
          <Text style={styles.openTag}>Open Now</Text>
        ) : openState === false ? (
          <Text style={[styles.openTag, { backgroundColor: '#DC2626' }]}>Closed</Text>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{shop?.name}</Text>
        <Text style={styles.addr}>Shop Address: {shop?.address}</Text>
        {(shop?.mobile || shop?.phone) ? <Text style={styles.addr}>Ph: {shop.mobile || shop.phone}</Text> : null}
        <View style={styles.row}>
          <PrimaryButton title="📞 Call Shop" style={{ flex: 1, marginRight: 6 }} onPress={() => Linking.openURL(`tel:${shop?.mobile || shop?.phone || ''}`)} />
          <OutlineButton
            title="📍 Get Directions"
            style={{ flex: 1, marginLeft: 6 }}
            onPress={() => {
              const { latitude, longitude, address, name } = shop || {};
              const url = (latitude != null && longitude != null)
                ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
                : (address || name)
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || name)}`
                  : null;
              if (url) Linking.openURL(url);
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(12), color: colors.textSecondary }}>Open</Text>
            <Text style={{ fontSize: rf(14), fontWeight: '700', color: colors.text }}>{WORKING_DAYS_LABEL[String(shop?.workingDays || '').toUpperCase()] || 'Monday - Saturday'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(12), color: colors.textSecondary }}>Timings</Text>
            <Text style={{ fontSize: rf(14), fontWeight: '700', color: colors.text }}>{(shop?.openingTime && shop?.closingTime) ? `${shop.openingTime} to ${shop.closingTime}` : (shop?.hoursText || '09:30 AM to 09:00 PM')}</Text>
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: rf(12), color: colors.textSecondary }}>Ratings</Text>
          {shop?.rating ? (
            <Text style={{ fontSize: rf(16), fontWeight: '700', color: colors.text }}>{Number(shop.rating).toFixed(1)} ★</Text>
          ) : (
            <Text style={{ fontSize: rf(14), fontWeight: '600', color: colors.textSecondary }}>Not rated yet</Text>
          )}
        </View>
        <Text style={{ marginTop: 16, fontWeight: '700', color: colors.text, fontSize: rf(14) }}>Services available</Text>
        <View style={styles.serviceRow}>
          {(shop?.services || ['REPAIR', 'BUY', 'SELL', 'PICKUP']).map((s) => (
            <View key={s} style={styles.serviceTile}>
              <Ionicons name="build-outline" size={18} color="#004C40" />
              <Text style={styles.serviceText}>{s}</Text>
            </View>
          ))}
        </View>
        <Text style={{ marginTop: 20, fontWeight: '700', color: colors.text }}>Nearest Service Shops</Text>
        {nearby.slice(0, 3).map((s) => (
          <TouchableOpacity key={s.id} style={{ padding: 10, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} onPress={() => navigation.replace('ShopDetails', { shopId: s.id })}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{s.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: rf(12) }}>{s.address}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
