import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Loader, Empty } from '../../../components/ui';
import { getSellOrder, getSellOrderQuotations } from '../../../api/orders';
import { rf } from '../../../utils/responsive';

const GREEN = '#004C40';
const MINT = '#E8F7F2';
const BORDER = '#DCE7E2';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: rf(15), fontWeight: '800', color: colors.text, marginBottom: 2 },
  sub: { fontSize: rf(12), color: colors.textSecondary, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10 },
  cardChosen: { borderColor: GREEN, borderWidth: 2, backgroundColor: '#F4FBF8' },
  row: { flexDirection: 'row', alignItems: 'center' },
  shop: { fontSize: rf(15), fontWeight: '800', color: colors.text, flex: 1 },
  price: { fontSize: rf(17), fontWeight: '900', color: GREEN },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaText: { fontSize: rf(12.5), color: colors.textSecondary, marginLeft: 6 },
  note: { fontSize: rf(12.5), color: colors.text, marginTop: 8, lineHeight: rf(18) },
  chosenPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: MINT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  chosenText: { color: GREEN, fontWeight: '800', fontSize: rf(11), marginLeft: 4 },
  statusText: { fontSize: rf(11), color: colors.textSecondary, marginTop: 6 },
  banner: { backgroundColor: MINT, borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  bannerText: { flex: 1, marginLeft: 8, color: GREEN, fontWeight: '700', fontSize: rf(12.5) },
  bottom: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: 1 },
  cta: { height: 54, borderRadius: 18, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: rf(15), marginRight: 6 },
});

// Statuses a backend might use for the accepted quotation. The order's own
// shopId is the primary signal; these only cover a status-only response.
const CHOSEN_STATUSES = new Set(['ACCEPTED', 'SELECTED', 'CHOSEN', 'APPROVED']);

export default function SellQuotationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const sellOrderId = route?.params?.sellOrderId;
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refetch on focus so a quotation chosen on SellSelectShop shows here too.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const so = await getSellOrder(sellOrderId).catch(() => null);
        const q = Array.isArray(so?.quotations) ? so.quotations : await getSellOrderQuotations(sellOrderId);
        if (!cancelled) { setOrder(so); setItems(q || []); }
      } catch (_) {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sellOrderId]));

  if (loading) return <Loader />;

  const status = String(order?.status || '').toUpperCase();
  const isChosen = (q) => (order?.shopId ? q.shopId === order.shopId : CHOSEN_STATUSES.has(String(q.status || '').toUpperCase()));
  const chosen = items.find(isChosen);
  // Only offer choosing while no shop is assigned and the order is still open.
  const canChoose = items.length > 0 && !order?.shopId && !chosen && status !== 'CANCELLED';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={styles.title}>Total Quotation : {items.length}</Text>
        <Text style={styles.sub}>{order?.sellNumber ? `Sell order #${String(order.sellNumber).replace(/^#+/, '')}` : 'Offers from verified shops'}</Text>

        {chosen ? (
          <View style={styles.banner}>
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
            <Text style={styles.bannerText}>
              You chose {chosen.shopName || 'a shop'}
              {order?.finalPrice != null && Number(order.finalPrice) > 0 ? ` · ₹${Number(order.finalPrice).toLocaleString('en-IN')}` : ''}
            </Text>
          </View>
        ) : null}

        {items.length === 0 ? <Empty text="No quotations yet" /> : items.map((q, i) => {
          const picked = isChosen(q);
          return (
            <View key={q.id} style={[styles.card, picked && styles.cardChosen]}>
              <View style={styles.row}>
                <Text style={styles.shop} numberOfLines={2}>{i + 1}. {q.shopName || 'Shop'}</Text>
                <Text style={styles.price}>₹{Number(q.quotationPrice || 0).toLocaleString('en-IN')}</Text>
              </View>
              {q.shopCity ? (
                <View style={styles.meta}>
                  <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{q.shopCity}</Text>
                </View>
              ) : null}
              {q.shopPhone ? (
                <View style={styles.meta}>
                  <Ionicons name="call-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{q.shopPhone}</Text>
                </View>
              ) : null}
              {q.note ? <Text style={styles.note}>{q.note}</Text> : null}
              {picked ? (
                <View style={styles.chosenPill}>
                  <Ionicons name="checkmark" size={13} color={GREEN} />
                  <Text style={styles.chosenText}>SELECTED</Text>
                </View>
              ) : q.status ? (
                <Text style={styles.statusText}>Status: {String(q.status).replace(/_/g, ' ')}</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {canChoose ? (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <TouchableOpacity activeOpacity={0.9} style={styles.cta} onPress={() => navigation.navigate('SellSelectShop', { sellOrderId })}>
            <Text style={styles.ctaText}>Choose a Shop</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
