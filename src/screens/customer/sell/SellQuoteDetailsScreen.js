import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Clock, Truck, Store, Phone, Calendar, BadgeCheck, Check, PencilLine, X, FileText, Tag, Navigation, Info } from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { chooseSellQuotation } from '../../../api/orders';
import { rf, rlh } from '../../../utils/responsive';
import { useSellOrder, money, km, quoteState, orderLocked, fmtDateTime, SQ, cardShadow, useSavedPickup, quoteFulfilment, FULFILMENT_LABEL, handoverAction, mapsUrl } from './useSellOrder';

// Quote Details — one shop's offer for this sell order: shop profile, the
// offered price, its terms as the server knows them, the shop's remarks, and
// Accept (POST /sell-orders/{id}/choose-quotation, which also notifies the
// shop in the Partner app). Revision / Reject have no server endpoint yet, so
// they're shown but disabled.

function InfoRow({ Icon, label, value, last, stacked }) {
  if (!value) return null;
  if (stacked) return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1F2F4' }}>
      <Icon size={18} color={SQ.primary} />
      <Text style={{ marginLeft: 12, marginRight: 12, fontSize: rf(13), color: SQ.navy }}>{label}</Text>
      <Text style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: rf(13), lineHeight: rlh(18), fontWeight: '700', color: SQ.navy }}>{value}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1F2F4' }}>
      <Icon size={18} color={SQ.primary} />
      <Text style={{ flex: 1, marginLeft: 12, fontSize: rf(13), color: SQ.navy }}>{label}</Text>
      <Text numberOfLines={2} style={{ maxWidth: '55%', textAlign: 'right', fontSize: rf(13), fontWeight: '700', color: SQ.navy }}>{value}</Text>
    </View>
  );
}

export default function SellQuoteDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { sellOrderId, quotationId } = route?.params || {};
  const { loading, error, order, quotes, shops, reload } = useSellOrder(sellOrderId);
  const savedPickup = useSavedPickup(sellOrderId);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  if (loading) return <Loader label="Loading quote..." />;
  const q = quotes.find((x) => x.id === quotationId);
  if (error || !q) {
    return (
      <View style={{ flex: 1, backgroundColor: SQ.page, justifyContent: 'center' }}>
        <EmptyState title="Quote not available" description={error || 'This quotation was withdrawn or is no longer on this sell order.'} actionLabel="Try again" onAction={reload} />
      </View>
    );
  }

  const shop = shops[q.shopId] || null;
  const st = quoteState(order, q);
  const canAccept = st === 'open' && !orderLocked(order);
  const place = [km(shop), shop?.city || q.shopCity].filter(Boolean).join(' · ');
  const hours = shop?.pickupFromTime && shop?.pickupToTime ? `${shop.pickupFromTime} – ${shop.pickupToTime}` : null;
  const phone = shop?.mobile || q.shopPhone;
  // The Partner's fulfilment choice on this quote; unknown stays unknown.
  const method = quoteFulfilment(q);
  const isVisit = method === 'SHOP_VISIT';
  const next = handoverAction(method, order, savedPickup);
  const directions = isVisit ? mapsUrl(shop) : null;

  const accept = async () => {
    if (lock.current || !canAccept) return;
    const ok = await confirm({
      title: 'Accept this quote?',
      message: `Sell to ${q.shopName || 'this shop'} for ${money(q.quotationPrice)}? All other quotes for this device will be declined.`,
      confirmText: 'Accept Quote',
    });
    if (!ok) return;
    lock.current = true;
    setBusy(true);
    try {
      await chooseSellQuotation(sellOrderId, q.id);
      notify('Quote accepted', `${q.shopName || 'The shop'} has been notified.`, { type: 'success' });
      // Pickup → schedule it; a shop visit (or unknown method) stays here with the shop's details.
      if (method === 'PICKUP') navigation.replace('SellSchedulePickup', { sellOrderId });
      else { lock.current = false; reload(); }
    } catch (e) {
      lock.current = false;
      notify('Could not accept', e?.message || 'Please try again.', { type: 'error' });
      reload();
    } finally {
      setBusy(false);
    }
  };

  const soon = () => notify('Coming soon', 'Requesting a revision or rejecting a quote will be available soon.', { type: 'info' });

  return (
    <View style={{ flex: 1, backgroundColor: SQ.page }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
        {/* Shop */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: SQ.line, padding: 12, ...cardShadow }}>
          {shop?.frontImageUrl ? (
            <Image source={{ uri: shop.frontImageUrl }} style={{ width: 84, height: 72, borderRadius: 12, backgroundColor: '#F3F4F6' }} resizeMode="cover" />
          ) : (
            <View style={{ width: 84, height: 72, borderRadius: 12, backgroundColor: SQ.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Store size={30} color={SQ.primary} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <Text numberOfLines={2} style={{ fontSize: rf(15.5), fontWeight: '800', color: SQ.navy }}>{q.shopName || shop?.name || 'Shop'}</Text>
            {place ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <MapPin size={12} color={SQ.muted} />
                <Text numberOfLines={1} style={{ marginLeft: 3, fontSize: rf(12.5), color: SQ.muted }}>{place}</Text>
              </View>
            ) : null}
          </View>
          {phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Call shop" style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: SQ.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={19} color={SQ.primary} />
            </Pressable>
          ) : null}
        </View>

        {/* Their offer */}
        <View style={{ marginTop: 14, borderRadius: 18, backgroundColor: SQ.primarySoft, padding: 16 }}>
          <Text style={{ fontSize: rf(15), fontWeight: '800', color: SQ.navy }}>Their Offer</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Tag size={28} color={SQ.primary} strokeWidth={2} />
            <Text style={{ flex: 1, marginLeft: 12, fontSize: rf(30), fontWeight: '800', color: SQ.primary }}>{money(q.quotationPrice)}</Text>
            {method ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: SQ.primary, backgroundColor: '#FFFFFF' }}>
                {isVisit ? <Store size={16} color={SQ.primary} /> : <Truck size={16} color={SQ.primary} />}
                <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: SQ.primary }}>{FULFILMENT_LABEL[method]}</Text>
              </View>
            ) : null}
          </View>
          {st !== 'open' ? (
            <Text style={{ marginTop: 6, fontSize: rf(12.5), fontWeight: '800', color: st === 'accepted' ? SQ.success : SQ.red }}>
              {st === 'accepted' ? 'You accepted this quote' : st === 'rejected' ? 'Declined' : 'Another quote was accepted'}
            </Text>
          ) : null}
        </View>

        {/* Terms the server knows */}
        <View style={{ marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: SQ.line, paddingHorizontal: 14, paddingVertical: 4 }}>
          <InfoRow Icon={Calendar} label="Received" value={fmtDateTime(q.createdAt)} />
          <InfoRow Icon={isVisit ? Store : Truck} label="Fulfillment Method" value={method ? FULFILMENT_LABEL[method] : 'Not shared by the shop'} />
          <InfoRow Icon={Clock} label="Pickup Hours" value={method === 'PICKUP' ? hours : null} />
          <InfoRow Icon={MapPin} label="Shop Address" value={shop?.address} last stacked />
        </View>

        {q.note ? (
          <View style={{ flexDirection: 'row', marginTop: 14, borderRadius: 18, backgroundColor: SQ.primaryTint, borderWidth: 1, borderColor: SQ.line, padding: 14 }}>
            <FileText size={20} color={SQ.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: SQ.navy }}>Remarks</Text>
              <Text style={{ marginTop: 4, fontSize: rf(13), lineHeight: rlh(18), color: SQ.muted }}>{q.note}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Actions */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: SQ.line, gap: 10 }}>
        {st === 'accepted' ? (
          <>
            {!method ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Info size={16} color={SQ.muted} />
                <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), lineHeight: rlh(17), color: SQ.muted }}>The shop hasn't shared whether it picks up the device or you visit. Call the shop to arrange it.</Text>
              </View>
            ) : null}
            {next.label !== 'Track Pickup' ? <Pressable onPress={() => navigation.navigate(next.route, { sellOrderId })} accessibilityRole="button" style={{ height: 54, borderRadius: 16, backgroundColor: SQ.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...cardShadow }}>
              <BadgeCheck size={20} color="#FFFFFF" />
              <Text style={{ marginLeft: 10, fontSize: rf(15.5), fontWeight: '800', color: '#FFFFFF' }}>{next.label}</Text>
            </Pressable> : null}
            {method !== 'PICKUP' && (directions || phone) ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {directions ? (
                  <Pressable onPress={() => Linking.openURL(directions)} accessibilityRole="button" style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: SQ.primary, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                    <Navigation size={17} color={SQ.primary} />
                    <Text style={{ marginLeft: 8, fontSize: rf(14), fontWeight: '800', color: SQ.primary }}>Get Directions</Text>
                  </Pressable>
                ) : null}
                {phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} accessibilityRole="button" style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: SQ.primary, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                    <Phone size={17} color={SQ.primary} />
                    <Text style={{ marginLeft: 8, fontSize: rf(14), fontWeight: '800', color: SQ.primary }}>Call Shop</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Pressable
              onPress={accept}
              disabled={!canAccept || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAccept || busy }}
              style={{ height: 54, borderRadius: 16, backgroundColor: canAccept ? SQ.primary : '#9ABEC4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...(canAccept ? cardShadow : null) }}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Check size={20} color="#FFFFFF" strokeWidth={2.6} />}
              <Text style={{ marginLeft: 10, fontSize: rf(15.5), fontWeight: '800', color: '#FFFFFF' }}>{canAccept ? 'Accept Quote' : 'Quote closed'}</Text>
            </Pressable>
            {canAccept ? (
              <>
                <Pressable onPress={soon} accessibilityRole="button" accessibilityHint="Coming soon" style={{ height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: SQ.primary, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: 0.55 }}>
                  <PencilLine size={18} color={SQ.primary} />
                  <Text style={{ marginLeft: 10, fontSize: rf(14.5), fontWeight: '800', color: SQ.primary }}>Request Revision</Text>
                </Pressable>
                <Pressable onPress={soon} accessibilityRole="button" accessibilityHint="Coming soon" style={{ height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: '#F5A9A6', backgroundColor: SQ.redSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: 0.55 }}>
                  <X size={18} color={SQ.red} strokeWidth={2.6} />
                  <Text style={{ marginLeft: 10, fontSize: rf(14.5), fontWeight: '800', color: SQ.red }}>Reject Quote</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
