import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { rf } from '../../../utils/responsive';
import { goToTab } from '../../../navigation/goToTab';
import { getBuyOrder, BUY_STATUS_LABEL } from '../../../api/buyOrders';
import { notify } from '../../../components/confirm';
import { buildReceiptHtml, loadReceiptData, viewReceipt } from './buyReceipt';
import BuyStatusSteps, { CLOSED_STATUSES, isVisitShop, receiptReady } from './BuyStatusSteps';
import OrderCelebration from './OrderCelebration';

const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';
const YELLOW = '#F5B700';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Buy "order confirmed" page after Place Order. Params: order (POST response),
// items (snapshot), total, notifiedShops, fixed. Status refreshes from the API.
export default function BuyOrderSuccessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const base = route?.params?.order || {};
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const celebrate = useRef(route?.params?.celebrate === true).current; // one-shot, first mount only
  const o = live || base;
  const items = route?.params?.items || [];
  const total = route?.params?.total ?? items.reduce((s, it) => s + (Number(it.price) || 0) * (it.quantity || 1), 0);
  const count = items.reduce((s, it) => s + (it.quantity || 1), 0);
  const shop = o.shopName || o.shop?.name || items.find((it) => it.shopName)?.shopName || (route?.params?.notifiedShops || [])[0];

  useFocusEffect(useCallback(() => {
    if (!route?.params?.fixed || !base.id) return undefined;
    let on = true;
    getBuyOrder(base.id).then((r) => { if (on && r) setLive(r); }).catch(() => {});
    return () => { on = false; };
  }, [base.id]));

  const s = String(o.status || 'PLACED').toUpperCase();
  const closed = CLOSED_STATUSES.includes(s);
  const delivered = receiptReady(o);

  const openReceipt = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Re-check the live status right before opening; never open before delivery.
      const fresh = base.id ? await getBuyOrder(base.id) : o;
      if (fresh && base.id) setLive(fresh);
      if (!receiptReady(fresh)) { notify('Receipt', 'Receipt will be available after the order is delivered.'); return; }
      await viewReceipt(buildReceiptHtml(fresh, await loadReceiptData(fresh)));
    }
    catch (e) { notify('Receipt', e?.message || 'Please try again.', { preset: 'error' }); }
    finally { setBusy(false); }
  };

  const card = { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 14, marginBottom: 12 };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52 }}>
        <Pressable onPress={() => (navigation.canGoBack() ? navigation.goBack() : goToTab(navigation, 'Buy'))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back"
          style={{ height: 36, width: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={INK} />
        </Pressable>
        <Image source={require('../../../../assets/logo.png')} style={{ width: 26, height: 26, marginLeft: 6 }} resizeMode="contain" />
        <Text style={{ marginLeft: 6, fontSize: rf(16), fontWeight: '900', color: TEAL }}>NearGFix</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
        {/* Confirmation illustration */}
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 14 }}>
          <OrderCelebration celebrate={celebrate} onPlayed={() => navigation.setParams({ celebrate: false })} />
          <Text style={{ fontSize: rf(20), fontWeight: '900', color: INK, marginTop: 6 }}>
            {closed ? (BUY_STATUS_LABEL[s] || 'Order Update') : 'Order Confirmed'}
          </Text>
          <Text style={{ fontSize: rf(12.5), color: MUTED, textAlign: 'center', marginTop: 4, lineHeight: rf(18), paddingHorizontal: 12 }}>
            {`Your order has been placed${shop ? ` with ${shop}` : ''}. Track its progress below.`}
          </Text>
        </View>

        {items.length ? (
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="bag-handle-outline" size={18} color={TEAL} />
              <Text style={{ flex: 1, marginLeft: 6, fontSize: rf(14), fontWeight: '800', color: INK }}>Order Summary</Text>
              <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: '#E6F0F2' }}>
                <Text style={{ fontSize: rf(11), fontWeight: '800', color: TEAL }}>{`${count} item${count === 1 ? '' : 's'}`}</Text>
              </View>
            </View>
            {items.map((it, i) => (
              <View key={it.id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <View style={{ height: 46, width: 46, borderRadius: 10, backgroundColor: '#F4F6F8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 }}>
                  {it.imageUrl ? <Image source={{ uri: it.imageUrl }} style={{ width: 42, height: 42 }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={20} color={TEAL} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: rf(13), fontWeight: '800', color: INK }} numberOfLines={2}>{it.title || 'Product'}</Text>
                  <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2 }} numberOfLines={1}>
                    {[it.storageLabel, it.color, `Qty ${it.quantity || 1}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: INK, marginLeft: 8 }}>{inr((Number(it.price) || 0) * (it.quantity || 1))}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: LINE, marginVertical: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: rf(13), fontWeight: '700', color: INK }}>Total</Text>
              <Text style={{ fontSize: rf(16), fontWeight: '900', color: TEAL }}>{inr(o.totalAmount ?? total)}</Text>
            </View>
          </View>
        ) : null}

        {/* Horizontal status from the real order status */}
        <BuyStatusSteps status={s} visitShop={isVisitShop(o)} />

        {delivered ? (
          <Pressable onPress={openReceipt} disabled={busy} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, borderWidth: 1, borderColor: TEAL }}>
            {busy ? <ActivityIndicator color={TEAL} /> : (<><Ionicons name="receipt-outline" size={17} color={TEAL} /><Text style={{ marginLeft: 6, fontSize: rf(13.5), fontWeight: '800', color: TEAL }}>View Receipt</Text></>)}
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', borderRadius: 12, padding: 12 }}>
            <Ionicons name="information-circle-outline" size={18} color={MUTED} />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12), color: MUTED }}>Receipt will be available after the order is delivered.</Text>
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: LINE }}>
        <Pressable onPress={() => goToTab(navigation, 'Buy')} accessibilityRole="button"
          style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Ionicons name="bag-handle-outline" size={17} color={TEAL} />
          <Text style={{ marginLeft: 6, fontSize: rf(14), fontWeight: '800', color: TEAL }}>Shop More</Text>
        </Pressable>
        <Pressable
          onPress={() => (base.id
            ? navigation.replace(route?.params?.fixed ? 'BuyFixedOrder' : 'BuyOrderDetails', { orderId: base.id })
            : navigation.replace('MyOrders', { initialTab: 'Buy', view: 'buy' }))}
          accessibilityRole="button"
          style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#FFFFFF' }}>{base.id ? 'Track Order' : 'View My Orders'}</Text>
          <Ionicons name="chevron-forward" size={17} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>
    </View>
  );
}
