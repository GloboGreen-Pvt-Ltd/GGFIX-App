// Order Progress — the former "Sell Order Details" (SellOrderTracking) screen,
// now a section of Sell Device Details. Same live data (useSellOrder, polled),
// same step rules (utils/sellStatus): status + Order ID, the full vertical
// timeline (pickup person / on the way / inspection / price / payment …) with
// real timestamps, and Contact Shop / Chat. One timeline, no duplicates.
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, Clock, XCircle } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { sellProgress } from '../../../utils/sellStatus';
import { useSellOrder, fmtDateTime, fmtPickup, SQ, useSavedPickup, quoteFulfilment } from './useSellOrder';

const GREEN = SQ.primary;
const GREEN_SOFT = SQ.primarySoft;
const NAVY = SQ.navy;
const MUTED = SQ.muted;
const LINE = SQ.line;
const RED = SQ.red;

// Customer journey after the quote. Each row maps to real sell-order fields /
// statuses (see sellStatus + the pickup flow: PICKUP_ASSIGNED → OUT_FOR_PICKUP →
// PICKED_UP, pickup_* timestamps, revision_status, payout_*). Rows with no
// backend evidence stay Pending; nothing advances on time alone.
const TIMELINE = [
  { key: 'created', title: 'Listing Created', from: ['REQUESTED'] },
  { key: 'quoted', title: 'Quotation Received', from: ['QUOTED'] },
  { key: 'accepted', title: 'Quote Accepted', from: ['ACCEPTED'] },
  { key: 'assigned', title: 'Pickup Person Assigned', waits: true },
  { key: 'pkAccepted', title: 'Pickup Accepted', waits: true },
  { key: 'onTheWay', title: 'On the Way', waits: true },
  { key: 'arrived', title: 'Arrived for Pickup', waits: true },
  { key: 'inspection', title: 'Device Inspection in Progress', waits: true },
  { key: 'approval', title: 'Awaiting Shop Owner Approval', waits: true },
  { key: 'price', title: 'Final Price Confirmation', optional: true },
  { key: 'payment', title: 'Payment Completed', optional: true },
  { key: 'pickedUp', title: 'Pickup Completed' },
  { key: 'completed', title: 'Device Sold' },
];
const HANDOVER = [
  ...TIMELINE.slice(0, 3),
  { key: 'scheduled', title: 'Visit Scheduled' },
  { key: 'pickedUp', title: 'Visit Shop · Device Received', waits: true },
  { key: 'inspection', title: 'Device Inspection', waits: true },
  { key: 'price', title: 'Final Price Confirmation', optional: true },
  { key: 'payment', title: 'Payment Completed', optional: true },
  { key: 'completed', title: 'Device Sold' },
];
const up = (v) => String(v ?? '').trim().toUpperCase();
const pick = (...v) => v.find((x) => x != null && x !== '') ?? null;

export default function SellOrderProgress({ sellOrderId, navigation, onLayout }) {
  const { loading, order, quotes, shops } = useSellOrder(sellOrderId, { poll: true });
  const savedPickup = useSavedPickup(sellOrderId);
  const [open, setOpen] = useState(false);
  if (loading || !order) return null;

  const p = sellProgress(order, quotes);
  const stepOf = Object.fromEntries(p.steps.map((s) => [s.key, s]));
  const pk = p.pickup;
  const scheduledText = fmtPickup(order, p.cancelled ? null : savedPickup);
  const o = order;
  const rev = up(pick(o.revisionStatus, o.priceRevisionStatus));
  const st = up(o.status);
  const acceptedAt = pick(o.pickupAcceptedAt);
  const arrivedAt = pick(o.pickupArrivedAt, o.arrivedAt, o.pickupOtpVerifiedAt);
  const inspectedAt = pick(o.pickupInspectedAt);
  const paidAt = pick(p.payment.paidAt, o.payoutConfirmedAt);
  const paid = p.payment.paid || !!o.payoutConfirmedAt;
  const priceStep = stepOf.PRICE_CONFIRMED || {};
  const priceDone = !!priceStep.done || rev === 'APPROVED' || rev === 'SHOP_CONFIRMED';
  const ownerOk = priceDone || rev === 'SHOP_APPROVED' || paid || pk.pickedUp;
  const EVENTS = {
    scheduled: { done: !!scheduledText || pk.assigned, text: scheduledText },
    assigned: { done: pk.assigned, at: pk.assignedAt, text: [pk.name, pk.phone].filter(Boolean).join(' · ') },
    pkAccepted: { done: !!acceptedAt || pk.onTheWay, at: acceptedAt },
    onTheWay: { done: pk.onTheWay, at: pk.onTheWayAt },
    arrived: { done: !!arrivedAt || p.inspection.started || pk.pickedUp, at: arrivedAt },
    inspection: { done: !!inspectedAt || ownerOk || !!stepOf.VERIFIED?.done, at: inspectedAt || stepOf.VERIFIED?.at },
    approval: { done: ownerOk, show: true },
    // Only when a final price step really applies (a revision or a confirmed price).
    price: { done: priceDone, at: priceStep.at, show: !!rev || priceDone },
    payment: { done: paid, at: paidAt, show: paid },
    pickedUp: { done: pk.pickedUp, at: pk.pickedUpAt },
    completed: { done: p.sold, at: stepOf.SOLD?.at },
  };
  const started = { inspection: p.inspection.started, approval: !!inspectedAt || rev === 'SHOP_PENDING', assigned: true, pkAccepted: pk.assigned, onTheWay: !!acceptedAt, arrived: pk.onTheWay };
  const method = quoteFulfilment(p.chosenQuote);
  // Before a quote is accepted the method is unknown: show the full (pickup)
  // journey, same as a completed order; the visit flow only once chosen.
  const timeline = (method === 'SHOP_VISIT' || (!method && p.chosenQuote) ? HANDOVER
    .filter((t) => t.key !== 'scheduled' || (savedPickup?.mode === 'visit' && !p.cancelled))
    .map((t) => (t.key === 'pickedUp' && !method ? { ...t, title: 'Device Received by Shop' } : t)) : TIMELINE);
  const rows = timeline.map((t) => {
    if (EVENTS[t.key]) return { ...t, ...EVENTS[t.key] };
    const s = stepOf[t.from[0]] || {};
    return { ...t, done: !!s.done, at: s.at || null };
  }).filter((r) => !r.optional || r.show || (!p.cancelled && !p.sold));
  // Cancelled: keep the steps reached, then one terminal red row.
  if (p.cancelled) {
    const reached = rows.map((r) => r.done).lastIndexOf(true);
    rows.splice(reached + 1, rows.length, { key: 'cancelled', title: 'Order Cancelled', terminal: true, done: false, at: pick(o.cancelledAt) });
  }
  // Notice states (terminal or needing the shop): declined price / reassignment.
  const notice = p.cancelled ? null
    : rev === 'REJECTED' ? 'You declined the revised price — the shop will contact you'
    : /REASSIGN|DECLINED/.test(st) ? 'Pickup person changed — the shop is reassigning'
    : null;
  const currentIdx = p.cancelled ? -1 : rows.findIndex((r) => !r.done);
  const shopId = order?.shopId;
  const shop = shopId ? shops[shopId] : null;
  const phone = shop?.mobile || p.chosenQuote?.shopPhone || null;
  const orderNo = order?.sellNumber ? String(order.sellNumber).replace(/^#+/, '') : '';
  const lastDone = [...rows].reverse().find((r) => r.done);
  // Headline = the ACTIVE step (not the last done one with a tick, which read as "completed").
  const cur = rows[currentIdx];
  const headline = p.cancelled ? 'Order Cancelled' : p.sold ? 'Device Sold'
    : cur?.key === 'quoted' ? 'Awaiting Quotes' : cur?.key === 'accepted' ? 'Quote Received · Awaiting Acceptance' : cur ? cur.title : lastDone?.title || 'Listing Created';
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <View onLayout={onLayout} style={{ marginBottom: 10, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: NAVY }}>Order Status</Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: GREEN_SOFT }}>
          <Text style={{ fontSize: rf(11), fontWeight: '800', color: GREEN }}>{doneCount} of {rows.length} steps</Text>
        </View>
        {open ? <ChevronUp size={18} color={NAVY} style={{ marginLeft: 6 }} /> : <ChevronDown size={18} color={NAVY} style={{ marginLeft: 6 }} />}
      </Pressable>

      {/* Status + Order ID */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: p.cancelled ? '#FDECEC' : GREEN_SOFT }}>
        <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: p.cancelled ? RED : GREEN, alignItems: 'center', justifyContent: 'center' }}>
          {p.cancelled ? <XCircle size={18} color="#FFFFFF" /> : !p.sold ? <Clock size={18} color="#FFFFFF" /> : <Check size={18} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: p.cancelled ? RED : GREEN }}>{headline}</Text>
          {notice ? <Text style={{ fontSize: rf(11.5), fontWeight: '700', color: '#B45309', marginTop: 2 }}>{notice}</Text> : null}
        </View>
      </View>

      {/* Timeline */}
      {open ? <View style={{ marginTop: 6 }}>
        {rows.map((r, i) => {
          const current = i === currentIdx;
          const title = r.key === 'quoted' && quotes.length ? `${r.title} (${quotes.length})` : r.title;
          return (
            <View key={r.key} style={{ flexDirection: 'row' }}>
              <View style={{ width: 24, alignItems: 'center' }}>
                <View style={{
                  marginTop: 10, height: 18, width: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: r.terminal ? RED : r.done ? GREEN : '#FFFFFF', borderWidth: r.done || r.terminal ? 0 : 2, borderColor: current ? GREEN : '#C5CBD3',
                }}>
                  {r.terminal ? <XCircle size={12} color="#FFFFFF" /> : r.done ? <Check size={11} color="#FFFFFF" strokeWidth={3.2} /> : current ? <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: GREEN }} /> : null}
                </View>
                {i < rows.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: r.done && rows[i + 1].done ? GREEN : '#D9DEE5', marginTop: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, marginLeft: 8, marginVertical: 2, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: current ? GREEN_SOFT : 'transparent' }}>
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: r.terminal ? RED : r.done || current ? NAVY : MUTED }}>{title}</Text>
                <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }}>
                  {r.done ? (r.text || fmtDateTime(r.at) || 'Done') : r.terminal ? (fmtDateTime(r.at) || 'Cancelled') : p.cancelled ? '—' : current && (!r.waits || started[r.key]) ? 'In progress' : 'Pending'}
                </Text>
              </View>
            </View>
          );
        })}
      </View> : null}

    </View>
  );
}
