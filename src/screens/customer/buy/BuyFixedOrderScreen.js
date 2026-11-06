import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { confirm, notify } from '../../../components/confirm';
import { BUY_STATUS_LABEL, CANCELLABLE, OTP_STATUSES, cancelBuyOrder, getBuyOrder } from '../../../api/buyOrders';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';

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

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const when = (t) => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '');
const DONE = ['DELIVERED', 'COMPLETED'];
const CLOSED = ['REJECTED', 'CANCELLED', 'RETURNED'];

export default function BuyFixedOrderScreen({ route }) {
  const id = route.params?.orderId;
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
  const home = o.fulfilmentType === 'HOME_DELIVERY';
  const img = resolveDeviceImageSource({ url: o.productImage });
  const events = o.events || [];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: 14, paddingBottom: 32, width: '100%', maxWidth: 640, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View style={[styles.card, styles.row]}>
        <View style={styles.thumb}>
          {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={26} color={TEAL} />}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.sub}>{o.orderNumber}</Text>
          <Text style={styles.title} numberOfLines={2}>{o.productTitle || 'Product'}</Text>
          <Text style={styles.price}>{inr(o.totalAmount)} <Text style={[styles.sub, { color: GREEN }]}>(Fixed Price)</Text></Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: DONE.includes(s) ? TINT : CLOSED.includes(s) ? '#FDECEC' : '#FFFFFF' }]}>
        <Text style={styles.sub}>Status</Text>
        <Text style={[styles.title, { color: CLOSED.includes(s) ? RED : DONE.includes(s) ? GREEN : TEAL, marginTop: 2 }]}>{BUY_STATUS_LABEL[s] || s}</Text>
        {s === 'DELIVERY_FAILED' ? <Text style={styles.sub}>The shop will contact you to reschedule.</Text> : null}
      </View>

      {OTP_STATUSES.includes(s) && o.handoverOtp ? (
        <View style={[styles.card, { borderColor: '#BFE5DA', backgroundColor: TINT }]}>
          <Text style={styles.optTitle}>{home ? 'Delivery OTP' : 'Shop pickup OTP'}</Text>
          <Text style={styles.otp}>{o.handoverOtp}</Text>
          <Text style={styles.sub}>Share it only after you receive the product and pay {inr(o.totalAmount)}.</Text>
        </View>
      ) : null}

      <Text style={styles.section}>{home ? 'Delivery' : 'Visit Shop & Buy'}</Text>
      <View style={styles.card}>
        <KV k="Fulfilment" v={home ? 'Home delivery' : 'Collect at shop'} />
        {home ? <KV k="Address" v={o.deliveryAddress || '—'} /> : null}
        <KV k="Payment" v={o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Pay at shop'} />
        <KV k="Payment status" v={o.paymentStatus === 'PAID' ? 'Paid' : 'Pending'} />
        <KV k="Quantity" v={String(o.quantity || 1)} />
        <KV k="Total" v={inr(o.totalAmount)} bold />
      </View>

      <Text style={styles.section}>Order timeline</Text>
      <View style={styles.card}>
        {events.length ? events.map((e, i) => (
          <View key={i} style={[styles.row, { alignItems: 'flex-start', paddingVertical: 6 }]}>
            <Ionicons name={i === events.length - 1 ? 'radio-button-on' : 'checkmark-circle'} size={18} color={i === events.length - 1 ? TEAL : GREEN} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.optTitle}>{BUY_STATUS_LABEL[e.status] || e.status}</Text>
              <Text style={styles.sub}>{when(e.at)}{e.note ? ` · ${e.note}` : ''}</Text>
            </View>
          </View>
        )) : <Text style={styles.sub}>No updates yet.</Text>}
      </View>

      {DONE.includes(s) ? (
        <>
          <Text style={styles.section}>Receipt</Text>
          <View style={styles.card}>
            <KV k="Order" v={o.orderNumber} />
            <KV k="Paid" v={`${inr(o.totalAmount)} · ${o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid at shop'}`} />
            <KV k="Completed" v={when(o.updatedAt)} />
          </View>
        </>
      ) : null}

      {CANCELLABLE.includes(s) ? (
        <Pressable onPress={cancel} disabled={cancelling} accessibilityRole="button" style={[styles.btn, styles.btnGhost, cancelling ? { opacity: 0.6 } : null]}>
          {cancelling ? <ActivityIndicator color={RED} /> : <Text style={[styles.btnText, { color: RED }]}>Cancel Order</Text>}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function KV({ k, v, bold }) {
  return (
    <View style={[styles.row, { alignItems: 'flex-start', marginTop: 4 }]}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, bold ? { color: TEAL, fontWeight: '800' } : null]}>{v}</Text>
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
  kvKey: { width: 120, fontSize: rf(12.5), color: MUTED },
  kvVal: { flex: 1, fontSize: rf(12.5), fontWeight: '700', color: INK, textAlign: 'right' },
  btn: { height: 48, borderRadius: 999, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnGhost: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3B8B3' },
  btnText: { color: '#FFFFFF', fontSize: rf(15), fontWeight: '800' },
});
