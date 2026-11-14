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
const GREEN = '#01AC77';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';
const TINT = '#E6F4F2';
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

// Status card copy for each stage.
const HEAD = {
  0: ['Order Placed', 'Waiting for the shop to confirm'],
  2: ['In Progress', 'Your order is being processed'],
  3: ['Ready for Pickup', 'Collect your device from the shop'],
  4: ['Picked Up', 'You collected your device'],
  5: ['Completed', 'Your order is complete'],
};

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
  const paidAt = p.paidAt || p.payment?.paidAt;
  const paid = !!paidAt || /^(PAID|SUCCESS|CAPTURED)$/.test(up(p.paymentStatus || p.payment?.status));
  const steps = [
    { key: 'placed', label: 'Order Placed', done: true, at: order.createdAt },
    ...(paid ? [{ key: 'paid', label: 'Payment Completed', done: true, at: paidAt }] : []),
    { key: 'preparing', label: 'Preparing for Pickup', note: 'Your order will be ready soon', done: rank >= 3, active: rank === 2 },
    { key: 'ready', label: 'Ready for Pickup', note: 'Collect it from the shop', done: rank >= 4, active: rank === 3 },
    { key: 'picked', label: 'Picked Up from Shop', done: rank >= 4 },
    { key: 'completed', label: 'Completed', done: rank >= 5 },
  ];
  // The latest status change is the order's updatedAt — put it on the furthest done step.
  const lastDone = steps.reduce((n, s, i) => (s.done ? i : n), 0);
  if (lastDone > 0 && !steps[lastDone].at) steps[lastDone].at = order.updatedAt;
  const lines = Array.isArray(p.items) ? p.items : [];
  const [headTitle, headSub] = cancelled ? ['Cancelled', 'This order was cancelled'] : HEAD[rank] || HEAD[0];
  const shopPhone = shop?.phone || shop?.mobile;
  const contactShop = () => {
    if (shopPhone) Linking.openURL(`tel:${String(shopPhone).replace(/\s+/g, '')}`);
    else if (shop?.id) navigation.navigate('ShopChat', { shopId: shop.id });
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 20, width: '100%', maxWidth: 640, alignSelf: 'center' }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TEAL} colors={[TEAL]} />}>
        {/* Status */}
        <View style={[styles.status, cancelled ? { backgroundColor: '#FEEBEA', borderColor: '#FBD0CE' } : null]}>
          <View style={[styles.statusIcon, cancelled ? { backgroundColor: RED } : null]}>
            <Ionicons name={cancelled ? 'close' : rank >= 5 ? 'checkmark-done' : 'bag-handle-outline'} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.statusTitle, cancelled ? { color: RED } : null]}>{headTitle}</Text>
            <Text style={styles.muted}>{headSub}</Text>
          </View>
        </View>

        {/* Tracking timeline */}
        <View style={{ marginTop: 14 }}>
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            const current = !cancelled && s.active;
            return (
              <View key={s.key} style={{ flexDirection: 'row' }}>
                <View style={{ alignItems: 'center', width: 30 }}>
                  <View style={[styles.dot, s.done ? { backgroundColor: GREEN, borderColor: GREEN } : current ? { borderColor: TEAL, borderWidth: 3 } : null]}>
                    {s.done ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : current ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL }} /> : null}
                  </View>
                  {!last ? <View style={[styles.rail, { backgroundColor: s.done ? GREEN : '#D9DEE5' }]} /> : null}
                </View>
                <View style={[styles.stepBody, current ? styles.stepCurrent : null]}>
                  <Text style={[styles.stepText, { color: s.done || current ? INK : '#8E97A9' }]}>{s.label}</Text>
                  {s.done && when(s.at) ? <Text style={styles.muted}>{when(s.at)}</Text> : current && s.note ? <Text style={styles.muted}>{s.note}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Order items */}
        <View style={[styles.card, { marginTop: 14 }]}>
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
          <View style={[styles.row, { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: LINE }]}>
            <Text style={[styles.title, { flex: 1 }]}>Total Amount</Text>
            <Text style={[styles.title, { color: TEAL }]}>{inr(order.totalAmount)}</Text>
          </View>
        </View>

        {/* Shop */}
        {shop ? (
          <View style={styles.card}>
            <Text style={styles.title}>{shop.name || products[lines[0]?.productId]?.shopName || 'Seller shop'}</Text>
            {shop.address || shop.city ? <Text style={styles.muted}>{[shop.address, shop.city].filter(Boolean).join(', ')}</Text> : null}
            <View style={[styles.row, { marginTop: 6 }]}>
              <Text style={[styles.muted, { flex: 1, marginTop: 0 }]}>Pickup from shop · pay on collection</Text>
              <Pressable onPress={() => navigation.navigate('ShopChat', { shopId: shop.id })} hitSlop={8} accessibilityRole="button">
                <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: TEAL }}>Chat with shop</Text>
              </Pressable>
            </View>
          </View>
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

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginBottom: 8, shadowColor: INK, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: TINT, borderWidth: 1, borderColor: '#CDE9E3' },
  statusIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: rf(16), fontWeight: '800', color: TEAL },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F4F2FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: rf(14), fontWeight: '800', color: INK },
  muted: { fontSize: rf(12), color: MUTED, marginTop: 2 },
  price: { fontSize: rf(13.5), fontWeight: '800', color: TEAL, marginLeft: 8 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#C5CBD3', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  rail: { width: 3, flex: 1, minHeight: 18, marginVertical: 2, borderRadius: 2 },
  stepBody: { flex: 1, marginLeft: 10, marginBottom: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  stepCurrent: { backgroundColor: TINT, paddingVertical: 8 },
  stepText: { fontSize: rf(14), fontWeight: '800' },
  bar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#FFFFFF' },
  outline: { height: 48, borderRadius: 999, borderWidth: 1.5, borderColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  outlineText: { fontSize: rf(15), fontWeight: '800', color: TEAL },
});
