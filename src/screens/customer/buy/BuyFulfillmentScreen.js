import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProduct } from '../../../api/marketplace';
import { fulfilmentOf } from '../../../api/buyOrders';
import { rf } from '../../../utils/responsive';

/**
 * Select Fulfillment — Home Delivery or Visit Shop & Buy, offered only when the
 * listing allows it (server fulfilmentOptions). Continue → Place Order.
 * route.params: { items } (same as BuyPlaceOrder)
 */
const GREEN = '#01AC77';
const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';

export default function BuyFulfillmentScreen({ navigation, route }) {
  const items = route.params?.items || [];
  const insets = useSafeAreaInsets();
  const [fresh, setFresh] = useState(null);
  const [mode, setMode] = useState(null);

  // Current listing data decides what is offered (not the cached card).
  useEffect(() => {
    let off = false;
    Promise.all(items.map((it) => getProduct(it.product?.id || it.productId).catch(() => it.product)))
      .then((rows) => { if (!off) setFresh(rows); });
    return () => { off = true; };
  }, [items]);

  const canHome = !!fresh && fresh.every((p) => fulfilmentOf(p).home);
  const canShop = !!fresh && fresh.every((p) => fulfilmentOf(p).shop);
  useEffect(() => { if (fresh && !mode) setMode(canHome ? 'HOME_DELIVERY' : canShop ? 'VISIT_SHOP' : null); }, [fresh]);

  const options = [
    { key: 'HOME_DELIVERY', icon: 'home', title: 'Home Delivery', sub: 'Get it at your address\n(Estimated: 1–2 days)', ok: canHome },
    { key: 'VISIT_SHOP', icon: 'storefront-outline', title: 'Visit Shop & Buy', sub: 'Buy directly at the shop', ok: canShop },
  ];

  return (
    <View style={styles.page}>
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={styles.lead}>Choose how you want to receive</Text>
        {!fresh ? <ActivityIndicator color={TEAL} style={{ marginTop: 30 }} /> : options.map((o) => {
          const on = mode === o.key;
          return (
            <Pressable key={o.key} onPress={() => o.ok && setMode(o.key)} disabled={!o.ok} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !o.ok }}
              style={[styles.card, on && styles.cardOn, !o.ok && { opacity: 0.5 }]}>
              <View style={[styles.icon, on && { backgroundColor: GREEN }]}>
                <Ionicons name={o.icon} size={22} color={on ? '#FFFFFF' : TEAL} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>{o.title}</Text>
                <Text style={styles.sub}>{o.ok ? o.sub : 'Not offered for this product'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <Pressable onPress={() => navigation.navigate('BuyPlaceOrder', { ...route.params, mode })} disabled={!mode}
          accessibilityRole="button" style={[styles.cta, !mode && { opacity: 0.5 }]}>
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  lead: { fontSize: rf(13), color: MUTED, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF' },
  cardOn: { borderColor: GREEN, borderWidth: 2, backgroundColor: '#F2FBF7' },
  icon: { height: 44, width: 44, borderRadius: 12, backgroundColor: '#E6F4F2', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: rf(14.5), fontWeight: '800', color: INK },
  sub: { fontSize: rf(12), color: MUTED, marginTop: 2, lineHeight: rf(17) },
  bar: { padding: 14, borderTopWidth: 1, borderTopColor: LINE },
  cta: { height: 50, borderRadius: 14, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: rf(15), fontWeight: '800' },
});
