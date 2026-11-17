import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Loader } from '../../../components/ui';
import { getMyOrder } from '../../../api/orders';
import { getProduct } from '../../../api/marketplace';
import { getShop } from '../../../api/shops';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { StaticTabBar } from '../../../navigation/CustomTabBar';

/**
 * Buy Order Details & Tracking — GET /customer-orders/{id}. Every step comes
 * from the order's own status (set by the backend); nothing advances on its
 * own. Payment shows only when the order carries a payment record, and only
 * the pickup stages apply (buy orders are collected from the shop).
 */
const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';
const RED = '#F32C26';

const up = (v) => String(v ?? '').trim().toUpperCase();
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
// "Today, 11:02 AM" / "02 Nov 2026, 11:02 AM"
const when = (v) => {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  if (new Date().toDateString() === d.toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${time}`;
};

// Backend status → how far the order has got (0 placed … 5 completed).
const RANK = {};
[
  [0, 'PENDING', 'PLACED', 'CREATED', 'NEW'],
  [2, 'CONFIRMED', 'ACCEPTED', 'PROCESSING', 'IN_PROGRESS', 'PREPARING', 'PACKED'],
  [3, 'READY', 'READY_FOR_PICKUP', 'DISPATCHED', 'SHIPPED', 'OUT_FOR_DELIVERY'],
  [4, 'PICKED_UP', 'DELIVERED', 'COLLECTED'],
  [5, 'COMPLETED', 'CLOSED', 'FULFILLED'],
].forEach(([r, ...names]) => names.forEach((n) => { RANK[n] = r; }));
const CANCELLED = /CANCEL|REJECT|DECLIN|EXPIRE/;

export default function BuyOrderDetailsScreen({ navigation, route }) {
  const id = route.params?.orderId;
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState({});
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Order Details',
      subtitle: '',
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Notifications" style={{ padding: 6 }}>
          <Ionicons name="notifications-outline" size={22} color={INK} />
        </Pressable>
      ),
    });
  }, [navigation, order?.orderNumber]);

  const load = useCallback(async () => {
    try {
      const o = await getMyOrder(id);
      setOrder(o);
      setError(null);
      const ids = [...new Set((o?.payload?.items || []).map((it) => it.productId).filter(Boolean))];
      const rows = await Promise.all(ids.map((pid) => getProduct(pid).catch(() => null)));
      const map = Object.fromEntries(ids.map((pid, i) => [pid, rows[i]]).filter(([, p]) => p));
      setProducts(map);
      const shopId = o?.shopId || Object.values(map).find((p) => p?.shopId)?.shopId;
      if (shopId) setShop({ id: shopId, ...((await getShop(shopId).catch(() => null)) || {}) });
    } catch (e) {
      setError(e?.message || 'Could not load this order.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Loader />;
  if (!order) {
    return (
      <View style={[styles.page, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={32} color={RED} />
        <Text style={[styles.title, { marginTop: 8 }]}>Couldn't load this order</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>{error || 'Please try again.'}</Text>
        <Pressable onPress={() => { setLoading(true); load(); }} style={[styles.outline, { marginTop: 12, paddingHorizontal: 24 }]}><Text style={styles.outlineText}>Retry</Text></Pressable>
      </View>
    );
  }

  const status = up(order.status);
  const cancelled = CANCELLED.test(status);
  const rank = RANK[status] ?? 0;
  const p = order.payload || {};
  // Pickup-only flow (this order type has no delivery stages). Payment is not shown as a step.
  const steps = [
    { key: 'placed', label: 'Placed', icon: 'cube-outline', done: true },
    { key: 'confirmed', label: 'Confirmed', icon: 'storefront-outline', done: rank >= 2 },
    { key: 'ready', label: 'Ready for Pickup', icon: 'bag-handle-outline', done: rank >= 3 },
    { key: 'collected', label: 'Collected', icon: 'hand-left-outline', done: rank >= 4 },
  ];
  const current = cancelled ? -1 : steps.findIndex((s) => !s.done);
  const lines = Array.isArray(p.items) ? p.items : [];
  const shopPhone = shop?.phone || shop?.mobile;
  const otp = order.handoverOtp || order.otp || p.otp || p.pickupOtp;
  const payMethodRaw = up(p.paymentMethod || order.paymentMethod);
  const payMethod = payMethodRaw === 'COD' ? 'Cash on delivery' : payMethodRaw && payMethodRaw !== 'PAY_AT_SHOP' ? payMethodRaw.replace(/_/g, ' ') : 'Pay at shop';
  const contactShop = () => {
    if (shopPhone) Linking.openURL(`tel:${String(shopPhone).replace(/\s+/g, '')}`);
    else if (shop?.id) navigation.navigate('ShopChat', { shopId: shop.id });
  };
  const kv = (k, v) => (v ? (
    <View key={k} style={[styles.row, { alignItems: 'flex-start', paddingVertical: 3 }]}>
      <Text style={styles.kvKey}>{k}</Text><Text style={styles.kvColon}>:</Text><Text style={styles.kvVal}>{v}</Text>
    </View>
  ) : null);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 20, width: '100%', maxWidth: 640, alignSelf: 'center' }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TEAL} colors={[TEAL]} />}>
        {/* Order Summary */}
        <Section icon="document-text-outline" title="Order Summary">
          {kv('Order ID', order.orderNumber ? `#${String(order.orderNumber).replace(/^#/, '')}` : null)}
          {kv('Placed on', when(order.createdAt))}
          {kv('Payment', payMethod)}
          {kv('Total', inr(order.totalAmount))}
        </Section>

        {/* Product details */}
        <Section icon="phone-portrait-outline" title="Product Details">
          {lines.map((it, i) => {
            const prod = products[it.productId];
            const img = resolveDeviceImageSource({ url: prod?.imageUrl });
            return (
              <Pressable key={`${it.productId}-${i}`} onPress={() => it.productId && navigation.navigate('BuyProductDetails', { productId: it.productId })} style={[styles.row, i ? { marginTop: 10 } : null]}>
                <View style={styles.thumb}>
                  {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={22} color={TEAL} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <Text style={styles.title} numberOfLines={2}>{it.title || prod?.title || 'Product'}</Text>
                  <Text style={styles.muted}>{[prod?.conditionLabel, prod?.color, prod?.storageLabel].filter(Boolean).join(' · ')}{(it.quantity || 1) > 1 ? `  × ${it.quantity}` : ''}</Text>
                </View>
                <Text style={styles.price}>{inr((Number(it.price) || 0) * (it.quantity || 1))}</Text>
              </Pressable>
            );
          })}
        </Section>

        {/* Pickup OTP — only when the backend provides one */}
        {otp && !cancelled && rank < 4 ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={styles.title}>Shop pickup OTP</Text>
            <Text style={styles.otp}>{otp}</Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>Share it only after you receive the product and pay {inr(order.totalAmount)}.</Text>
          </View>
        ) : null}

        {/* Order Status */}
        <Section icon="cube-outline" title="Order Status">
          {cancelled ? (
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: RED, textAlign: 'center' }}>Cancelled</Text>
          ) : (
            <View style={styles.row}>
              {steps.map((s, i) => {
                const isCur = i === current;
                const on = s.done || isCur;
                return (
                  <View key={s.key} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={[styles.row, { width: '100%' }]}>
                      <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : on ? TEAL : LINE }} />
                      <View style={[styles.dot, s.done ? { backgroundColor: TEAL, borderColor: TEAL } : isCur ? { backgroundColor: '#E5F3F5', borderColor: TEAL } : null]}>
                        <Ionicons name={s.done ? 'checkmark' : s.icon} size={18} color={s.done ? '#FFFFFF' : isCur ? TEAL : '#7A8596'} />
                      </View>
                      <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? 'transparent' : steps[i + 1].done || i + 1 === current ? TEAL : LINE }} />
                    </View>
                    <Text style={{ fontSize: rf(10.5), fontWeight: on ? '800' : '600', color: on ? INK : '#9AA4B2', marginTop: 6, textAlign: 'center' }} numberOfLines={2}>{s.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Section>

        {/* Shop */}
        {shop ? (
          <Section icon="storefront-outline" title="Shop Details" right={(
            <Pressable onPress={() => navigation.navigate('ShopChat', { shopId: shop.id })} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: TEAL }}>Chat with shop</Text>
            </Pressable>
          )}>
            <Text style={styles.title}>{shop.name || products[lines[0]?.productId]?.shopName || 'Seller shop'}</Text>
            {shop.address || shop.city ? <Text style={styles.muted}>{[shop.address, shop.city].filter(Boolean).join(', ')}</Text> : null}
            <Text style={styles.muted}>Pickup from shop · pay on collection</Text>
          </Section>
        ) : null}
      </ScrollView>

      {shop ? (
        <View style={styles.bar}>
          <Pressable onPress={contactShop} style={styles.outline} accessibilityRole="button">
            <Ionicons name={shopPhone ? 'call' : 'chatbubbles-outline'} size={17} color={TEAL} />
            <Text style={styles.outlineText}>Contact Shop</Text>
          </Pressable>
        </View>
      ) : null}
      <StaticTabBar navigation={navigation} active="Buy" />
    </View>
  );
}

// Rounded white section: teal icon + title header (same as BuyFixedOrderScreen).
function Section({ icon, title, right, children }) {
  return (
    <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
      <View style={[styles.row, { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }]}>
        <Ionicons name={icon} size={18} color={TEAL} />
        <Text style={[styles.title, { flex: 1, marginLeft: 8, fontSize: rf(14.5) }]}>{title}</Text>
        {right}
      </View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginBottom: 8, shadowColor: INK, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F4F2FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: rf(14), fontWeight: '800', color: INK },
  muted: { fontSize: rf(12), color: MUTED, marginTop: 2 },
  price: { fontSize: rf(13.5), fontWeight: '800', color: TEAL, marginLeft: 8 },
  otp: { fontSize: rf(30), fontWeight: '800', color: TEAL, letterSpacing: 8, marginVertical: 6 },
  kvKey: { width: 104, fontSize: rf(12.5), color: MUTED },
  kvColon: { width: 14, fontSize: rf(12.5), color: MUTED, textAlign: 'center' },
  kvVal: { flex: 1, fontSize: rf(12.5), fontWeight: '700', color: INK },
  dot: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#C9D0DA', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#FFFFFF' },
  outline: { height: 48, borderRadius: 999, borderWidth: 1.5, borderColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  outlineText: { fontSize: rf(15), fontWeight: '800', color: TEAL },
});
