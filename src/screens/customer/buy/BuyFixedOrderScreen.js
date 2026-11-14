import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirm, notify } from '../../../components/confirm';
import { BUY_STATUS_LABEL, CANCELLABLE, OTP_STATUSES, cancelBuyOrder, getBuyOrder } from '../../../api/buyOrders';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { buildReceiptHtml, loadReceiptData, viewReceipt, shareReceipt, downloadReceipt } from './buyReceipt';

/**
 * Fixed-price buy order — live status, timeline, payment, hand-over OTP and
 * cancel (while the server allows it). route.params: { orderId }
 */
const TEAL = '#035C6C';
const GREEN = '#01AC77';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';
const TINT = '#E9F6F3';
const RED = '#D92D20';
const ORANGE = '#F09406';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const when = (t) => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '');
const DONE = ['DELIVERED', 'COMPLETED'];
const CLOSED = ['REJECTED', 'CANCELLED', 'RETURNED'];
// Home-delivery steps always shown in the timeline (done ones ticked).
const STEPS = [
  ['PLACED', 'Placed'],
  ['CONFIRMED', 'Confirmed by shop'],
  ['PICKED_UP', 'Picked from shop'],
  ['OUT_FOR_DELIVERY', 'Out for delivery'],
  ['DELIVERED', 'Delivered'],
];
const ORDER = ['PLACED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];

export default function BuyFixedOrderScreen({ route }) {
  const id = route.params?.orderId;
  const navigation = useNavigation();
  // Opened from a Buy order card: go straight to the full order with details open.
  const openDetails = !!route.params?.details;
  const [showDetails, setShowDetails] = useState(openDetails);
  const [showItem, setShowItem] = useState(openDetails);
  const [receiptBusy, setReceiptBusy] = useState(null);
  React.useLayoutEffect(() => { if (openDetails) navigation.setOptions({ title: 'Order Details', subtitle: 'Your purchase order information' }); }, [navigation, openDetails]);
  const insets = useSafeAreaInsets();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    try { setO(await getBuyOrder(id)); setError(''); }
    catch (e) { setError(e?.message || 'Could not load the order'); }
  }, [id]);

  // Live status: reload on focus and every 20 s while open.
  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]));

  const cancel = async () => {
    if (lock.current) return;
    if (!(await confirm({ title: 'Cancel order?', message: 'The shop will be informed.', confirmText: 'Cancel Order', cancelText: 'Keep', destructive: true }))) return;
    lock.current = true;
    setCancelling(true);
    try { setO({ ...o, ...(await cancelBuyOrder(id)) }); await load(); }
    catch (e) { notify('Could not cancel', e?.message || 'Please try again.', { preset: 'error' }); }
    finally { lock.current = false; setCancelling(false); }
  };

  if (!o) {
    return (
      <View style={[styles.page, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        {error ? (
          <>
            <Text style={[styles.sub, { textAlign: 'center' }]}>{error}</Text>
            <Pressable onPress={load} style={[styles.btn, { marginTop: 14, paddingHorizontal: 28 }]} accessibilityRole="button">
              <Text style={styles.btnText}>Retry</Text>
            </Pressable>
          </>
        ) : <ActivityIndicator color={TEAL} />}
      </View>
    );
  }

  const s = o.status;
  const delivered = DONE.includes(s);
  const home = o.fulfilmentType === 'HOME_DELIVERY';
  const img = resolveDeviceImageSource({ url: o.productImage });
  const events = o.events || [];
  const reached = ORDER.indexOf(s === 'DELIVERY_FAILED' ? 'OUT_FOR_DELIVERY' : s);
  const lat = o.shopLatitude ?? o.shopLat ?? o.shop?.latitude;
  const lng = o.shopLongitude ?? o.shopLng ?? o.shop?.longitude;
  const mapQuery = home && o.deliveryAddress ? txt(o.deliveryAddress)
    : lat != null && lng != null ? `${lat},${lng}`
      : [o.shopName || o.shop?.name, o.shopAddress || o.shop?.address].filter(Boolean).join(', ');
  const openMap = () => {
    if (!mapQuery) { notify('No location', 'Location is not available for this order.', { preset: 'error' }); return; }
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`)
      .catch(() => notify('Could not open Maps', 'Please try again.', { preset: 'error' }));
  };

  // Delivered: success page first; "View Order Details" opens the full order below.
  if (delivered && !showDetails && !openDetails) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={{ padding: 18, paddingBottom: 32 + insets.bottom, alignItems: 'center', width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <View style={{ height: 84, width: 84, borderRadius: 42, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
          <Ionicons name="checkmark" size={52} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { fontSize: rf(20), marginTop: 14 }]}>{home ? 'Order Delivered!' : 'Order Completed!'}</Text>
        <Text style={[styles.sub, { textAlign: 'center' }]}>{when(o.updatedAt)}</Text>
        <View style={[styles.card, styles.row, { alignSelf: 'stretch', marginTop: 18 }]}>
          <View style={styles.thumb}>
            {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={26} color={TEAL} />}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={2}>{o.productTitle || 'Product'}</Text>
            <Text style={styles.price}>{inr(o.totalAmount)}</Text>
          </View>
        </View>
        <Pressable onPress={() => (o.shopId ? navigation.navigate('ShopDetails', { shopId: o.shopId }) : null)} accessibilityRole="button"
          style={[styles.btn, { alignSelf: 'stretch', backgroundColor: GREEN }]}>
          <Text style={styles.btnText}>Rate & Review</Text>
        </Pressable>
        <Pressable onPress={() => { setShowDetails(true); setShowItem(true); }} accessibilityRole="button" style={[styles.btn, styles.btnOutline, { alignSelf: 'stretch' }]}>
          <Text style={[styles.btnText, { color: TEAL }]}>View Order Details</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Order Details (reference design) — real order data only ──────────────
  const closed = CLOSED.includes(s);
  const done = DONE.includes(s);
  const paidOk = o.paymentStatus === 'PAID' || done;
  const payMethod = o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Pay at shop';
  const statusTone = closed ? RED : done ? GREEN : TEAL;
  const statusLabel = BUY_STATUS_LABEL[s] || s;
  // Timeline rows: home delivery = fixed steps (ticked from real events / status);
  // visit-shop or closed orders = the real events as they happened.
  const evAt = (k) => [...events].reverse().find((e) => e.status === k || (k === 'DELIVERED' && e.status === 'COMPLETED'));
  const tl = home && !closed
    ? STEPS.map(([k, label]) => { const ev = evAt(k); return { k, label, at: ev?.at || null, note: ev?.note, done: !!ev || reached >= ORDER.indexOf(k) }; })
    : events.map((e) => ({ k: e.status, label: BUY_STATUS_LABEL[e.status] || e.status, at: e.at, note: e.note, done: true }));
  const lastDoneIdx = tl.reduce((n, r, i) => (r.done ? i : n), -1);
  const liveTrack = home ? ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED'].includes(s) : (!done && !closed);

  // Receipt (Amazon-style purchase receipt, NearGFix branded) — real order,
  // shop and customer data; View = preview, Download = PDF to phone, Share = PDF.
  const receiptAction = async (kind) => {
    if (receiptBusy) return;
    setReceiptBusy(kind);
    try {
      const html = buildReceiptHtml(o, await loadReceiptData(o));
      if (kind === 'view') await viewReceipt(html); // separate full-screen A4 preview (Back → Order Details)
      else if (kind === 'share') { console.log('[Receipt] share tapped'); await shareReceipt(html, o); } // eslint-disable-line no-console
      else { const msg = await downloadReceipt(html, o); if (msg) notify('Receipt downloaded', msg, { preset: 'done' }); }
    } catch (e) {
      console.error(`[Receipt] ${kind} failed:`, e?.message || e); // eslint-disable-line no-console
      if (kind === 'share') Alert.alert('Could not share receipt', e?.message || 'Please try again.');
      else notify('Receipt', e?.message || 'Please try again.', { preset: 'error' });
    } finally { setReceiptBusy(null); }
  };

  return (
    <>
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 + insets.bottom, width: '100%', maxWidth: 640, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {/* Product summary */}
      <View style={[styles.card, styles.row]}>
        <View style={styles.thumb}>
          {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={26} color={TEAL} />}
        </View>
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text style={[styles.title, { marginTop: 4 }]} numberOfLines={2}>{o.productTitle || 'Product'}</Text>
          <View style={[styles.row, { marginTop: 4 }]}>
            <Text style={styles.price}>{inr(o.totalAmount)}</Text>
            <View style={{ marginLeft: 8, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: TINT }}>
              <Text style={{ fontSize: rf(11), fontWeight: '800', color: GREEN }}>Fixed Price</Text>
            </View>
          </View>
        </View>
        <View style={{ marginLeft: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: statusTone, backgroundColor: closed ? '#FDECEC' : done ? TINT : '#E5F3F5' }}>
          <Ionicons name={closed ? 'close-circle' : done ? 'checkmark-circle' : 'time'} size={14} color={statusTone} />
          <Text style={{ marginLeft: 4, fontSize: rf(11), fontWeight: '800', color: statusTone }} numberOfLines={1}>{done ? (home ? 'Delivered' : 'Completed') : statusLabel}</Text>
        </View>
      </View>

      {/* Order details (show / hide) */}
      <Section icon="document-text-outline" title="Order Details"
        right={<Pressable onPress={() => setShowItem((v) => !v)} hitSlop={8} style={styles.row}>
          <Text style={{ fontSize: rf(12), fontWeight: '800', color: TEAL }}>{showItem ? 'Hide Details' : 'Show Details'}</Text>
          <Ionicons name={showItem ? 'chevron-up' : 'chevron-down'} size={16} color={TEAL} style={{ marginLeft: 2 }} />
        </Pressable>}>
        {showItem ? (
          <>
            <KV k="Product" v={o.productTitle || 'Product'} />
            <KV k="Unit Price" v={inr(o.unitPrice ?? o.totalAmount)} />
            <KV k="Quantity" v={String(o.quantity || 1)} />
            <KV k="Placed on" v={when(o.createdAt)} />
            <KV k="Shop" v={o.shopName || o.shop?.name} />
            <KV k="Fulfilment" v={home ? 'Home delivery' : 'Visit shop & buy'} />
            <KV k="Payment" v={`${payMethod} · ${paidOk ? 'Paid' : 'Pending'}`} />
            <KV k="Total" v={inr(o.totalAmount)} bold />
          </>
        ) : null}
        <View style={[styles.row, { marginTop: showItem ? 10 : 0, padding: 10, borderRadius: 12, backgroundColor: closed ? '#FDECEC' : done ? TINT : '#E5F3F5' }]}>
          <Ionicons name="cube-outline" size={20} color={statusTone} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.sub}>Order Status</Text>
            <Text style={{ fontSize: rf(15), fontWeight: '800', color: statusTone }}>{statusLabel}</Text>
            {s === 'DELIVERY_FAILED' ? <Text style={styles.sub}>The shop will contact you to reschedule.</Text> : null}
          </View>
        </View>
      </Section>

      {/* Handover OTP while it is still needed */}
      {OTP_STATUSES.includes(s) && o.handoverOtp ? (
        <View style={[styles.card, { borderColor: '#BFE5DA', backgroundColor: TINT }]}>
          <Text style={styles.optTitle}>{home ? 'Delivery OTP' : 'Shop pickup OTP'}</Text>
          <Text style={styles.otp}>{o.handoverOtp}</Text>
          <Text style={styles.sub}>Share it only after you receive the product and pay {inr(o.totalAmount)}.</Text>
        </View>
      ) : null}

      {/* Delivery details (home delivery or visit shop) */}
      <Section icon={home ? 'bus-outline' : 'storefront-outline'} title={home ? 'Delivery Details' : 'Visit Shop & Buy'}>
        <IconRow icon="location-outline" k={home ? 'Delivery Address' : 'Shop'} v={home ? o.deliveryAddress : [o.shopName || o.shop?.name, o.shopAddress || o.shop?.address].filter(Boolean).join(', ')} />
        <IconRow icon="card-outline" k="Payment Method" v={payMethod} />
        <IconRow icon={paidOk ? 'checkmark-circle' : 'time-outline'} iconColor={paidOk ? GREEN : ORANGE} k="Payment Status" pill={paidOk ? 'Paid' : 'Pending'} pillTone={paidOk ? GREEN : ORANGE} last />
      </Section>

      {/* Timeline — real timestamps only */}
      <Section icon="time-outline" title="Order Timeline">
        {tl.length ? tl.map((r, i) => {
          const isCur = i === lastDoneIdx;
          const last = i === tl.length - 1;
          const bad = closed && isCur;
          const dot = !r.done ? LINE : bad ? RED : GREEN;
          return (
            <View key={`${r.k}-${i}`} style={[styles.row, { alignItems: 'flex-start' }, isCur ? { backgroundColor: bad ? '#FDECEC' : TINT, borderRadius: 10, marginHorizontal: -6, paddingHorizontal: 6 } : null]}>
              <View style={{ alignItems: 'center', width: 24 }}>
                <Ionicons name={!r.done ? 'ellipse-outline' : bad ? 'close-circle' : 'checkmark-circle'} size={20} color={dot} style={{ marginTop: 6 }} />
                {!last ? <View style={{ width: 2, flex: 1, minHeight: 14, backgroundColor: tl[i + 1].done ? GREEN : LINE }} /> : null}
              </View>
              <View style={{ flex: 1, marginLeft: 8, paddingVertical: 6 }}>
                <View style={styles.row}>
                  <Text style={[styles.optTitle, { flex: 1 }, !r.done ? { color: MUTED, fontWeight: '500' } : isCur ? { color: bad ? RED : GREEN, fontWeight: '800' } : null]}>{r.label}</Text>
                  {isCur && r.at ? <Text style={styles.sub}>{when(r.at)}</Text> : null}
                </View>
                {!isCur && r.at ? <Text style={styles.sub}>{when(r.at)}</Text> : null}
                {r.note ? <Text style={styles.sub}>{r.note}</Text> : null}
              </View>
            </View>
          );
        }) : <Text style={styles.sub}>No updates yet.</Text>}
      </Section>

      {/* Receipt — delivered and active orders (payment shown as Pending until paid) */}
      {!closed ? (
        <Section icon="receipt-outline" iconBg={ORANGE} title="Receipt">
          {/* Order ID (left) · View / Download / Share icons (right), one row */}
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.sub}>Receipt No</Text><Text style={styles.recVal} numberOfLines={1}>{o.orderNumber ? `RCPT-${String(o.orderNumber).replace(/^#/, '')}` : 'Receipt'}</Text></View>
            {[['view', 'eye-outline', 'View receipt'], ['download', 'download-outline', 'Download receipt'], ['share', 'share-social-outline', 'Share receipt']].map(([k, ic, label]) => (
              <Pressable key={k} onPress={() => receiptAction(k)} disabled={!!receiptBusy} accessibilityRole="button" accessibilityLabel={label}
                style={{ height: 40, width: 40, borderRadius: 20, marginLeft: 8, borderWidth: 1, borderColor: TEAL, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: receiptBusy && receiptBusy !== k ? 0.5 : 1 }}>
                {receiptBusy === k ? <ActivityIndicator color={TEAL} /> : <Ionicons name={ic} size={18} color={TEAL} />}
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {/* Bottom actions */}
      <View style={[styles.row, { marginTop: 4 }]}>
        {liveTrack ? (
          <Pressable onPress={openMap} accessibilityRole="button" style={[styles.btn, styles.btnOutline, { flex: 1, marginRight: 8 }]}>
            <Ionicons name="map-outline" size={17} color={TEAL} />
            <Text style={[styles.btnText, { color: TEAL, marginLeft: 6 }]}>Track on Map</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => navigation.navigate('CustomerSupport')} accessibilityRole="button" style={[styles.btn, { flex: 1, flexDirection: 'row' }]}>
          <Ionicons name="headset-outline" size={17} color="#FFFFFF" />
          <Text style={[styles.btnText, { marginLeft: 6 }]}>Contact Support</Text>
        </Pressable>
      </View>

      {CANCELLABLE.includes(s) ? (
        <Pressable onPress={cancel} disabled={cancelling} accessibilityRole="button" style={[styles.btn, styles.btnGhost, cancelling ? { opacity: 0.6 } : null]}>
          {cancelling ? <ActivityIndicator color={RED} /> : <Text style={[styles.btnText, { color: RED }]}>Cancel Order</Text>}
        </Pressable>
      ) : null}
    </ScrollView>
    </>
  );
}

// Rounded section: tinted header strip with an icon disc + title.
function Section({ icon, iconBg = TEAL, title, right, children }) {
  return (
    <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
      <View style={[styles.row, { backgroundColor: '#F4F6F8', paddingHorizontal: 10, paddingVertical: 8 }]}>
        <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={16} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { flex: 1, marginLeft: 10, fontSize: rf(15) }]}>{title}</Text>
        {right}
      </View>
      <View style={{ padding: 12 }}>{children}</View>
    </View>
  );
}

function IconRow({ icon, iconColor = TEAL, k, v, pill, pillTone, last }) {
  return (
    <View style={[styles.row, { paddingVertical: 8 }, last ? null : { borderBottomWidth: 1, borderBottomColor: LINE }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={{ width: 120, marginLeft: 10, fontSize: rf(12.5), color: INK }}>{k}</Text>
      {pill ? (
        <View style={{ paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: TINT }}>
          <Text style={{ fontSize: rf(12), fontWeight: '800', color: pillTone }}>{pill}</Text>
        </View>
      ) : <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '700', color: INK }}>{txt(v)}</Text>}
    </View>
  );
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Any API value → display text (objects like an address are joined, never rendered raw).
const txt = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') {
    const parts = Array.isArray(v) ? v : [v.line1 || v.addressLine, v.line2 || v.locality || v.area, v.city, v.state, v.pincode];
    return parts.filter((x) => x != null && x !== '' && typeof x !== 'object').join(', ') || '—';
  }
  return String(v);
};

function KV({ k, v, bold }) {
  v = txt(v);
  // Reference layout: label | : | value, all left-aligned in fixed columns.
  return (
    <View style={[styles.row, { alignItems: 'flex-start', paddingVertical: 3 }]}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvColon}>:</Text>
      <Text style={[styles.kvVal, bold ? { color: TEAL, fontWeight: '800', fontSize: rf(15) } : null]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#F4F2FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: rf(14), fontWeight: '800', color: INK },
  sub: { fontSize: rf(12), color: MUTED, marginTop: 2, lineHeight: rf(17) },
  price: { fontSize: rf(17), fontWeight: '800', color: TEAL, marginTop: 4 },
  section: { fontSize: rf(14), fontWeight: '800', color: INK, marginTop: 10, marginBottom: 8 },
  optTitle: { fontSize: rf(13.5), fontWeight: '700', color: INK },
  otp: { fontSize: rf(30), fontWeight: '800', color: TEAL, letterSpacing: 8, marginVertical: 6 },
  kvKey: { width: 104, fontSize: rf(12.5), color: MUTED },
  kvColon: { width: 14, fontSize: rf(12.5), color: MUTED, textAlign: 'center' },
  kvVal: { flex: 1, fontSize: rf(12.5), fontWeight: '700', color: INK, textAlign: 'left' },
  btn: { height: 48, borderRadius: 999, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnOutline: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TEAL },
  btnGhost: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3B8B3' },
  btnText: { color: '#FFFFFF', fontSize: rf(15), fontWeight: '800' },
  recVal: { fontSize: rf(12.5), fontWeight: '800', color: INK, marginTop: 2 },
});
