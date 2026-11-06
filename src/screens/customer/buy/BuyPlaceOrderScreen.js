import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Loader } from '../../../components/ui';
import { notify } from '../../../components/confirm';
import { clearCart, getProduct, removeCartItem } from '../../../api/marketplace';
import { fulfilmentOf, placeBuyOrder } from '../../../api/buyOrders';
import { getShop } from '../../../api/shops';
import { selectSession } from '../../../store/authSlice';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { notifyShopsOfBuyOrder } from '../../../utils/buyOrderNotify';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { StaticTabBar } from '../../../navigation/CustomTabBar';

/**
 * Place Order — the step between Product Details / My Cart and Order Placed.
 * route.params: { items: [{ product: { id, title, price, imageUrl, shopId, shopName, ... }, quantity }], fromCart }
 *
 * Each item is placed with POST /customer/buy-orders: the server prices it,
 * reserves stock and is idempotent per key (one key per item per visit).
 * Home delivery (COD) is offered only when every item's listing allows it;
 * otherwise Visit Shop & Buy (pay at shop). No online payment yet.
 */
const TEAL = '#035C6C';
const GREEN = '#01AC77';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';
const TINT = '#E9F6F3';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const hm = (min) => { const h = Math.floor(min / 60); return `${h % 12 || 12}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
// Two-hour windows, 10 AM – 6 PM (same rule as Sell's Schedule Pickup when a shop lists no hours).
const SLOTS = [600, 720, 840, 960].map((s) => `${hm(s)} – ${hm(s + 120)}`);

export default function BuyPlaceOrderScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const session = useSelector(selectSession);
  const { lat, lng } = useCustomerLocation();
  const items = useMemo(() => (route.params?.items || []).filter((it) => it?.product?.id || it?.productId), [route.params?.items]);
  const fromCart = !!route.params?.fromCart;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);

  const [shops, setShops] = useState({});
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(0);
  const [sheet, setSheet] = useState(null); // 'date' | 'time'
  const [placing, setPlacing] = useState(false);
  const [fresh, setFresh] = useState({}); // productId -> current listing (price, stock, fulfilment)
  const [mode, setMode] = useState(null); // 'HOME_DELIVERY' | 'VISIT_SHOP'
  const [address, setAddress] = useState(session?.address || '');
  const lock = useRef(false); // a double tap can't place two orders
  const keys = useRef({}); // idempotency key per product for this visit
  const placed = useRef({}); // productId -> order already created (partial-failure retry)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Notifications" style={{ padding: 6 }}>
          <Ionicons name="notifications-outline" size={22} color={INK} />
        </Pressable>
      ),
    });
  }, [navigation]);

  // Seller shop(s) — with distance once the customer's location is known.
  useEffect(() => {
    let off = false;
    (async () => {
      const ids = [...new Set(items.map((it) => it.product?.shopId).filter(Boolean))];
      const loc = lat != null && lng != null ? { lat, lng } : {};
      const pids = [...new Set(items.map((it) => it.product?.id || it.productId))];
      const [rows, prods] = await Promise.all([
        Promise.all(ids.map((id) => getShop(id, loc).catch(() => null))),
        Promise.all(pids.map((id) => getProduct(id).catch(() => null))),
      ]);
      if (off) return;
      setShops(Object.fromEntries(ids.map((id, i) => [id, rows[i]]).filter(([, s]) => s)));
      setFresh(Object.fromEntries(pids.map((id, i) => [id, prods[i]]).filter(([, p]) => p)));
      setLoading(false);
    })();
    return () => { off = true; };
  }, [items, lat, lng]);

  const cur = (it) => fresh[it.product?.id || it.productId] || it.product || {};
  const priceOf = (it) => Number(cur(it).price) || 0;
  const stockOf = (it) => {
    const p = cur(it);
    return p.quantity == null ? null : Math.max(0, Number(p.quantity) - Number(p.soldQuantity || 0));
  };
  const canHome = items.length > 0 && items.every((it) => fulfilmentOf(cur(it)).home);
  const canShop = items.length > 0 && items.every((it) => fulfilmentOf(cur(it)).shop);
  const chosen = mode || (canHome ? 'HOME_DELIVERY' : canShop ? 'VISIT_SHOP' : null);
  const outOfStock = items.some((it) => stockOf(it) != null && stockOf(it) < (it.quantity || 1));
  const total = items.reduce((s, it) => s + priceOf(it) * (it.quantity || 1), 0);
  const shopList = Object.entries(shops).map(([id, s]) => ({ id, ...s }));
  const pickupWhen = `${DAYS[days[day].getDay()]}, ${dateLabel(days[day])}, ${SLOTS[slot]}`;

  const place = async () => {
    if (lock.current || !items.length || !chosen) return;
    if (chosen === 'HOME_DELIVERY' && !address.trim()) {
      notify('Address needed', 'Enter the delivery address.', { preset: 'error' });
      return;
    }
    lock.current = true;
    setPlacing(true);
    try {
      const home = chosen === 'HOME_DELIVERY';
      const orders = [];
      for (const it of items) {
        const pid = it.product?.id || it.productId;
        if (!placed.current[pid]) {
          keys.current[pid] = keys.current[pid] || `${pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          placed.current[pid] = await placeBuyOrder({
            productId: pid,
            quantity: it.quantity || 1,
            expectedUnitPrice: priceOf(it),
            fulfilmentType: chosen,
            paymentMethod: home ? 'COD' : 'PAY_AT_SHOP',
            deliveryAddress: home ? address.trim() : undefined,
            customerPhone: session?.mobile || undefined,
            idempotencyKey: keys.current[pid],
          });
          if (fromCart && it.id) await removeCartItem(it.id).catch(() => {});
        }
        orders.push(placed.current[pid]);
      }
      const created = orders[0];
      const notifiedShops = await notifyShopsOfBuyOrder({
        order: created,
        cartItems: items,
        buyer: { fullName: session?.fullName, mobile: session?.mobile },
        fulfilment: home
          ? ['Fulfilment: Home delivery', `Address: ${address.trim()}`, 'Payment: Cash on delivery']
          : ['Fulfilment: Visit shop & buy', `Preferred visit: ${pickupWhen}`, 'Payment: at the shop'],
      }).catch(() => []);
      if (fromCart) await clearCart().catch(() => {});
      const snapshot = items.map((it) => ({
        id: it.id || it.product?.id,
        title: it.product?.title,
        price: priceOf(it),
        quantity: it.quantity || 1,
        imageUrl: resolveDeviceImageSource({ url: it.product?.imageUrl }) || null,
        storageLabel: it.product?.storageLabel,
        color: it.product?.color,
      }));
      navigation.replace('BuyOrderSuccess', { order: created || {}, items: snapshot, total, notifiedShops, fixed: true });
    } catch (e) {
      lock.current = false;
      // Re-read price/stock so the screen shows what the server just enforced.
      const pids = items.map((it) => it.product?.id || it.productId);
      Promise.all(pids.map((id) => getProduct(id).catch(() => null)))
        .then((ps) => setFresh(Object.fromEntries(pids.map((id, i) => [id, ps[i]]).filter(([, p]) => p))));
      notify('Order failed', e?.message || 'Could not place the order. Please try again.', { preset: 'error' });
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 20, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        {/* Selected device(s) */}
        {items.map((it, i) => {
          const img = resolveDeviceImageSource({ url: it.product?.imageUrl });
          return (
            <View key={it.id || it.product?.id || i} style={[styles.card, styles.row]}>
              <View style={styles.thumb}>
                {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={26} color={TEAL} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                <Text style={styles.title} numberOfLines={2}>{it.product?.title || 'Product'}</Text>
                {it.product?.conditionLabel || it.product?.color ? (
                  <Text style={styles.sub} numberOfLines={1}>
                    {it.product?.conditionLabel ? <Text style={{ color: GREEN, fontWeight: '700' }}>{it.product.conditionLabel}</Text> : null}
                    {it.product?.conditionLabel && it.product?.color ? '  ·  ' : ''}
                    {it.product?.color || ''}
                  </Text>
                ) : null}
                {stockOf(it) != null ? (
                  <Text style={[styles.sub, stockOf(it) < (it.quantity || 1) ? { color: '#D92D20', fontWeight: '700' } : null]}>
                    {stockOf(it) < (it.quantity || 1) ? 'Out of stock' : `${stockOf(it)} in stock`}
                  </Text>
                ) : null}
                <Text style={styles.price}>{inr(priceOf(it) * (it.quantity || 1))}{(it.quantity || 1) > 1 ? <Text style={styles.sub}>  × {it.quantity}</Text> : null}</Text>
              </View>
            </View>
          );
        })}

        {/* Delivery / pickup */}
        <Text style={styles.section}>Delivery / Pickup</Text>
        <Pressable
          onPress={() => canHome && setMode('HOME_DELIVERY')}
          disabled={!canHome}
          style={[styles.option, chosen === 'HOME_DELIVERY' ? styles.optionOn : null, !canHome ? { opacity: 0.55 } : null]}
          accessibilityRole="radio"
          accessibilityState={{ selected: chosen === 'HOME_DELIVERY', disabled: !canHome }}
        >
          <Ionicons name={chosen === 'HOME_DELIVERY' ? 'radio-button-on' : 'radio-button-off'} size={22} color={chosen === 'HOME_DELIVERY' ? GREEN : MUTED} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.optTitle}>Home Delivery</Text>
            <Text style={styles.sub}>{canHome ? 'Shop employee delivers · Cash on delivery' : 'Not offered for this product'}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => canShop && setMode('VISIT_SHOP')}
          disabled={!canShop}
          style={[styles.option, chosen === 'VISIT_SHOP' ? styles.optionOn : null, !canShop ? { opacity: 0.55 } : null]}
          accessibilityRole="radio"
          accessibilityState={{ selected: chosen === 'VISIT_SHOP', disabled: !canShop }}
        >
          <Ionicons name={chosen === 'VISIT_SHOP' ? 'radio-button-on' : 'radio-button-off'} size={22} color={chosen === 'VISIT_SHOP' ? GREEN : MUTED} />
          <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <Text style={styles.optTitle}>Visit Shop & Buy</Text>
            {shopList.length ? shopList.map((s) => (
              <Text key={s.id} style={styles.sub} numberOfLines={2}>
                {s.name || items[0]?.product?.shopName || 'Seller shop'}
                {s.distanceKm != null ? `\n${Number(s.distanceKm).toFixed(1)} km away` : s.city ? `\n${s.city}` : ''}
              </Text>
            )) : <Text style={styles.sub}>{items[0]?.product?.shopName || 'The seller shop'}</Text>}
          </View>
        </Pressable>

        {chosen === 'HOME_DELIVERY' ? (
          <>
            <Text style={styles.section}>Delivery Address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="House no, street, area, city, pincode"
              placeholderTextColor={MUTED}
              multiline
              style={[styles.card, { minHeight: 70, textAlignVertical: 'top', fontSize: rf(13), color: INK }]}
            />
          </>
        ) : null}

        {/* Preferred visit time — sent to the shop with the order */}
        {chosen === 'VISIT_SHOP' ? <Text style={styles.section}>Visit Details</Text> : null}
        {chosen === 'VISIT_SHOP' ? <View style={styles.card}>
          <Pressable onPress={() => setSheet('date')} style={[styles.row, styles.pickRow]} accessibilityRole="button" accessibilityLabel="Select date">
            <Ionicons name="calendar-outline" size={20} color={TEAL} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.optTitle}>Select Date</Text>
              <Text style={styles.sub}>{day === 0 ? `Today, ${dateLabel(days[0])}` : dateLabel(days[day])}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </Pressable>
          <View style={{ height: 1, backgroundColor: LINE }} />
          <Pressable onPress={() => setSheet('time')} style={[styles.row, styles.pickRow]} accessibilityRole="button" accessibilityLabel="Select time">
            <Ionicons name="time-outline" size={20} color={TEAL} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.optTitle}>Select Time</Text>
              <Text style={styles.sub}>{SLOTS[slot]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </Pressable>
        </View> : null}

        {/* Payment — only what the server verifies today */}
        <Text style={styles.section}>Payment Method</Text>
        <View style={[styles.option, styles.optionOn]} accessibilityRole="radio" accessibilityState={{ selected: true }}>
          <Ionicons name="radio-button-on" size={22} color={GREEN} />
          <Text style={[styles.optTitle, { marginLeft: 10, flex: 1 }]}>{chosen === 'HOME_DELIVERY' ? 'Cash on Delivery (COD)' : 'Pay at Shop'}</Text>
        </View>
        <View style={[styles.option, { opacity: 0.55 }]} accessibilityRole="radio" accessibilityState={{ selected: false, disabled: true }}>
          <Ionicons name="radio-button-off" size={22} color={MUTED} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.optTitle}>UPI / Card</Text>
            <Text style={styles.sub}>Coming soon</Text>
          </View>
        </View>

        {/* Price details */}
        <Text style={styles.section}>Price Details</Text>
        <View style={styles.card}>
          <View style={styles.kv}>
            <Text style={styles.kvKey}>Product Price</Text>
            <Text style={styles.kvVal}>{inr(total)}</Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.kvKey}>{chosen === 'HOME_DELIVERY' ? 'Delivery Charges' : 'Pickup Charges'}</Text>
            <Text style={[styles.kvVal, { color: GREEN }]}>{inr(0)}</Text>
          </View>
          <View style={[styles.kv, { borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10, marginTop: 8 }]}>
            <Text style={[styles.title, { flex: 1 }]}>Total Amount</Text>
            <Text style={[styles.title, { color: TEAL, fontSize: rf(16) }]}>{inr(total)}</Text>
          </View>
        </View>
        <Text style={[styles.sub, { marginTop: 8 }]}>{chosen === 'HOME_DELIVERY' ? 'Pay the delivery person in cash and share your order OTP on delivery.' : 'Pay at the shop and show your order OTP to collect the device.'}</Text>
      </ScrollView>

      <View style={styles.bar}>
        <Pressable onPress={place} disabled={placing || !items.length || !chosen || outOfStock} accessibilityRole="button" style={[styles.cta, placing || !items.length || !chosen || outOfStock ? { opacity: 0.6 } : null]}>
          {placing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>{outOfStock ? 'Out of Stock' : !chosen ? 'Not Available' : 'Place Order'}</Text>}
        </Pressable>
      </View>
      <StaticTabBar navigation={navigation} active="Buy" />

      {/* Date / time picker sheet */}
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]} onPress={() => {}}>
            <Text style={[styles.title, { marginBottom: 8 }]}>{sheet === 'date' ? 'Select Date' : 'Select Time'}</Text>
            {(sheet === 'date' ? days.map((d, i) => (i === 0 ? `Today, ${dateLabel(d)}` : `${DAYS[d.getDay()]}, ${dateLabel(d)}`)) : SLOTS).map((label, i) => {
              const on = (sheet === 'date' ? day : slot) === i;
              return (
                <Pressable key={label} onPress={() => { (sheet === 'date' ? setDay : setSlot)(i); setSheet(null); }} style={[styles.row, styles.sheetRow, on ? { backgroundColor: TINT } : null]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[styles.optTitle, { flex: 1, fontWeight: on ? '800' : '600' }]}>{label}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={20} color={GREEN} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginBottom: 8, shadowColor: INK, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#F4F2FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: rf(14), fontWeight: '800', color: INK },
  sub: { fontSize: rf(12), color: MUTED, marginTop: 2, lineHeight: rf(17) },
  price: { fontSize: rf(17), fontWeight: '800', color: TEAL, marginTop: 4 },
  section: { fontSize: rf(14), fontWeight: '800', color: INK, marginTop: 10, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginBottom: 8, backgroundColor: '#FFFFFF' },
  optionOn: { borderColor: '#BFE5DA', backgroundColor: TINT },
  optTitle: { fontSize: rf(13.5), fontWeight: '700', color: INK },
  pickRow: { paddingVertical: 8 },
  kv: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  kvKey: { flex: 1, fontSize: rf(12.5), color: MUTED },
  kvVal: { fontSize: rf(12.5), fontWeight: '700', color: INK },
  bar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#FFFFFF' },
  cta: { height: 50, borderRadius: 999, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: rf(15), fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sheetRow: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12 },
});
