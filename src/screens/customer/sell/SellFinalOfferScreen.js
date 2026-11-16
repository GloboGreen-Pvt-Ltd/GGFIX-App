import React, { useLayoutEffect } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Clock, CheckCircle2, XCircle, MessageSquare, Smartphone, ChevronRight } from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { rf, rlh } from '../../../utils/responsive';
import { useSellOrder, money, fmtDateTime, SQ, cardShadow } from './useSellOrder';
import { FinalPriceRequest, finalPriceState, counterOffer } from './SellFinalPrice';

// Final Price Request — the customer's side of the Partner app's "Customer
// Decision" screen: the shop's final offer after inspection (shop-side revision
// or the doorstep final offer), the device, original quote vs final offer, the
// reason and inspection findings, Accept / Reject / Negotiate, and the decision
// status. Everything comes from GET /sell-orders/{id} + …/purchase (polled).
const TEAL = '#035C6C';
const GOLD = '#FAA700';
const RED = '#F32C26';
const INK = '#111111';
const MUTED = 'rgba(17,17,17,0.55)';

const up = (v) => String(v ?? '').trim().toUpperCase();

/** pending · accepted · rejected · negotiation · closed — from the server's revision status. */
function decisionOf(purchase) {
  const rev = purchase?.revision;
  if (!rev) return null;
  if (finalPriceState(purchase) === 'pending') return 'pending';
  const s = up(rev.status);
  if (s === 'APPROVED') return 'accepted';
  if (s === 'NEGOTIATION' || (s === 'REJECTED' && counterOffer(rev.note))) return 'negotiation';
  if (s === 'REJECTED') return 'rejected';
  return 'closed';
}

const ROWS = [
  { key: 'pending', label: 'Pending', Icon: Clock },
  { key: 'accepted', label: 'Accepted', Icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', Icon: XCircle },
  { key: 'negotiation', label: 'Negotiation Requested', Icon: MessageSquare },
];

export default function SellFinalOfferScreen({ navigation, route }) {
  const sellOrderId = route?.params?.sellOrderId;
  const { loading, refreshing, error, order, quotes, device, refresh, reload } = useSellOrder(sellOrderId, { poll: true });
  const sellNo = order?.sellNumber ? String(order.sellNumber).replace(/^#+/, '') : '';
  useLayoutEffect(() => { navigation.setOptions({ subtitle: undefined }); }, [navigation, sellNo]);

  if (loading) return <Loader label="Loading final price..." />;
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: SQ.page, justifyContent: 'center' }}>
        <EmptyState title="Couldn't load the final price" description={error} actionLabel="Try again" onAction={reload} />
      </View>
    );
  }

  const pv = order?.purchase;
  const rev = pv?.revision;
  const decision = decisionOf(pv);
  if (!rev || !decision) {
    return (
      <View style={{ flex: 1, backgroundColor: SQ.page, justifyContent: 'center' }}>
        <EmptyState
          title="No final price request"
          description={pv ? "The shop hasn't sent a final offer for this device." : "Couldn't load the shop's purchase details."}
          actionLabel={pv ? 'View order' : 'Try again'}
          onAction={pv ? () => navigation.navigate('SellOrderDetails', { sellOrderId }) : reload}
        />
      </View>
    );
  }

  const shopName = quotes.find((q) => q.shopId && q.shopId === order.shopId)?.shopName || 'The shop';
  const offer = Number(rev.amount) > 0 ? money(rev.amount) : 'the final offer';
  const ask = counterOffer(rev.note);
  const banner = {
    pending: { Icon: Clock, tone: GOLD, bg: 'rgba(250,167,0,0.14)', title: 'Your answer is needed', sub: `${shopName} sent a final offer of ${offer} after inspecting your device.` },
    accepted: { Icon: CheckCircle2, tone: TEAL, bg: 'rgba(3,92,108,0.10)', title: 'Final price accepted', sub: `${offer} is your final price. ${shopName} will pay you next.` },
    rejected: { Icon: XCircle, tone: RED, bg: 'rgba(243,44,38,0.10)', title: 'Final price rejected', sub: `Waiting for ${shopName} to keep the original quote, send a new price or cancel.` },
    negotiation: { Icon: MessageSquare, tone: TEAL, bg: 'rgba(3,92,108,0.10)', title: 'Negotiation requested', sub: `${ask ? `You asked for ${money(ask)}. ` : ''}Waiting for ${shopName} to reply.` },
    closed: { Icon: Clock, tone: MUTED, bg: '#F3F4F6', title: 'Request closed', sub: 'This final price request is no longer open.' },
  }[decision];
  const updated = fmtDateTime(order.updatedAt);
  // Answer buttons / waiting note only while the request is live on the server.
  const answering = !!finalPriceState(pv);
  // The shop already answered a rejection or negotiation (kept the quote / sent a new price).
  if (!answering && (decision === 'rejected' || decision === 'negotiation')) banner.sub = `${shopName} has answered. See the order details for the current price.`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: SQ.page }}
      contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={TEAL} colors={[TEAL]} />}
    >
      {/* Status */}
      <View style={{ alignItems: 'center', borderRadius: 18, backgroundColor: banner.bg, paddingVertical: 18, paddingHorizontal: 16 }}>
        <banner.Icon size={40} color={banner.tone} strokeWidth={2.2} />
        <Text style={{ marginTop: 8, fontSize: rf(19), fontWeight: '800', color: INK, textAlign: 'center' }}>{banner.title}</Text>
        <Text style={{ marginTop: 4, fontSize: rf(13), lineHeight: rlh(18), color: MUTED, textAlign: 'center' }}>{banner.sub}</Text>
      </View>

      {/* Device */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: SQ.line, ...cardShadow }}>
        <View style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {device?.image ? <Image source={{ uri: device.image }} style={{ width: 54, height: 54 }} resizeMode="contain" /> : <Smartphone size={26} color={MUTED} />}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={2} style={{ fontSize: rf(15.5), fontWeight: '800', color: INK }}>{device?.name || 'Your device'}</Text>
          {device?.specs ? <Text style={{ marginTop: 3, fontSize: rf(12.5), color: MUTED }}>{device.specs}</Text> : null}
        </View>
      </View>

      {/* Offer, reason, findings and the answer (or the waiting note) */}
      <View style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: SQ.line, ...cardShadow }}>
        {answering ? (
          <FinalPriceRequest sellOrderId={sellOrderId} purchase={pv} onDone={reload} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, borderRadius: 12, padding: 10, backgroundColor: '#F3F4F6' }}>
                <Text style={{ fontSize: rf(11.5), color: MUTED }}>Original Quote</Text>
                <Text style={{ marginTop: 2, fontSize: rf(18), fontWeight: '800', color: INK }}>{money(pv.finalPrice)}</Text>
              </View>
              <View style={{ flex: 1, borderRadius: 12, padding: 10, backgroundColor: 'rgba(3,92,108,0.10)' }}>
                <Text style={{ fontSize: rf(11.5), color: TEAL }}>Final Offer</Text>
                <Text style={{ marginTop: 2, fontSize: rf(18), fontWeight: '800', color: TEAL }}>{money(rev.amount)}</Text>
              </View>
            </View>
            {rev.reason ? <Text style={{ marginTop: 10, fontSize: rf(13), lineHeight: rlh(18), color: INK }}>Reason: {rev.reason}</Text> : null}
          </>
        )}
      </View>

      {/* Decision status — the same four states the Partner app shows */}
      <Text style={{ marginTop: 18, marginBottom: 8, fontSize: rf(16), fontWeight: '800', color: INK }}>Decision Status</Text>
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: SQ.line, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
        {ROWS.map((r, i) => {
          const on = r.key === decision;
          const tone = on ? (r.key === 'rejected' ? RED : r.key === 'pending' ? GOLD : TEAL) : 'rgba(17,17,17,0.35)';
          return (
            <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 14, backgroundColor: on ? banner.bg : '#FFFFFF', borderTopWidth: i ? 1 : 0, borderTopColor: SQ.line }}>
              <r.Icon size={20} color={tone} />
              <Text style={{ flex: 1, marginLeft: 12, fontSize: rf(14.5), fontWeight: on ? '800' : '600', color: on ? INK : 'rgba(17,17,17,0.45)' }}>{r.label}</Text>
              {on && updated ? <Text style={{ fontSize: rf(11.5), fontWeight: '700', color: tone }}>Updated {updated}</Text> : null}
            </View>
          );
        })}
      </View>

      <Pressable onPress={() => navigation.navigate('SellOrderDetails', { sellOrderId })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, padding: 8 }}>
        <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: TEAL }}>View order details</Text>
        <ChevronRight size={16} color={TEAL} />
      </Pressable>
    </ScrollView>
  );
}
