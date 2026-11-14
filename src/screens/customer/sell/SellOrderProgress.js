// Order Progress — the former "Sell Order Details" (SellOrderTracking) screen,
// now a section of Sell Device Details. Same live data (useSellOrder, polled),
// same step rules (utils/sellStatus): status + Order ID, the full vertical
// timeline (pickup person / on the way / inspection / price / payment …) with
// real timestamps, and Contact Shop / Chat. One timeline, no duplicates.
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, XCircle } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { sellProgress } from '../../../utils/sellStatus';
import { useSellOrder, fmtDateTime, fmtPickup, SQ, useSavedPickup, quoteFulfilment } from './useSellOrder';

const GREEN = SQ.primary;
const GREEN_SOFT = SQ.primarySoft;
const NAVY = SQ.navy;
const MUTED = SQ.muted;
const LINE = SQ.line;
const RED = SQ.red;

const TIMELINE = [
  { key: 'created', title: 'Listing Created', from: ['REQUESTED'] },
  { key: 'quoted', title: 'Quotation Received', from: ['QUOTED'] },
  { key: 'accepted', title: 'Quote Accepted', from: ['ACCEPTED'] },
  { key: 'scheduled', title: 'Pickup Scheduled', waits: true },
  { key: 'assigned', title: 'Pickup Assigned', waits: true },
  { key: 'onTheWay', title: 'On the Way', waits: true },
  { key: 'pickedUp', title: 'Picked Up' },
  { key: 'inspection', title: 'Device Inspection', from: ['VERIFIED'], waits: true },
  { key: 'price', title: 'Final Price Confirmation', from: ['PRICE_CONFIRMED'] },
  { key: 'payment', title: 'Payment', from: ['PAID'] },
  { key: 'completed', title: 'Completed', from: ['SOLD'] },
];
const HANDOVER = [
  ...TIMELINE.slice(0, 3),
  { key: 'scheduled', title: 'Visit Scheduled' },
  { key: 'pickedUp', title: 'Visit Shop · Device Received', waits: true },
  ...TIMELINE.slice(7),
];

export default function SellOrderProgress({ sellOrderId, navigation, onLayout }) {
  const { loading, order, quotes, shops } = useSellOrder(sellOrderId, { poll: true });
  const savedPickup = useSavedPickup(sellOrderId);
  const [open, setOpen] = useState(false);
  if (loading || !order) return null;

  const p = sellProgress(order, quotes);
  const stepOf = Object.fromEntries(p.steps.map((s) => [s.key, s]));
  const pk = p.pickup;
  const scheduledText = fmtPickup(order, p.cancelled ? null : savedPickup);
  const EVENTS = {
    scheduled: { done: !!scheduledText || pk.assigned, text: scheduledText },
    assigned: { done: pk.assigned, at: pk.assignedAt, text: [pk.name, pk.phone].filter(Boolean).join(' · ') },
    onTheWay: { done: pk.onTheWay, at: pk.onTheWayAt },
    pickedUp: { done: pk.pickedUp, at: pk.pickedUpAt },
  };
  const started = { inspection: p.inspection.started };
  const method = quoteFulfilment(p.chosenQuote);
  const timeline = method === 'PICKUP' ? TIMELINE : HANDOVER
    .filter((t) => t.key !== 'scheduled' || (savedPickup?.mode === 'visit' && !p.cancelled))
    .map((t) => (t.key === 'pickedUp' && !method ? { ...t, title: 'Device Received by Shop' } : t));
  const rows = timeline.map((t) => {
    if (EVENTS[t.key]) return { ...t, ...EVENTS[t.key] };
    const s = stepOf[t.from[0]] || {};
    return { ...t, done: !!s.done, at: s.at || null };
  });
  const currentIdx = p.cancelled ? -1 : rows.findIndex((r) => !r.done);
  const shopId = order?.shopId;
  const shop = shopId ? shops[shopId] : null;
  const phone = shop?.mobile || p.chosenQuote?.shopPhone || null;
  const orderNo = order?.sellNumber ? String(order.sellNumber).replace(/^#+/, '') : '';
  const lastDone = [...rows].reverse().find((r) => r.done);
  const headline = p.cancelled ? 'Order Cancelled' : p.sold ? 'Completed' : lastDone?.title || 'Listing Created';
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <View onLayout={onLayout} style={{ marginBottom: 10, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: NAVY }}>Order Status</Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: GREEN_SOFT }}>
          <Text style={{ fontSize: rf(11), fontWeight: '800', color: GREEN }}>{doneCount} of {rows.length} complete</Text>
        </View>
        {open ? <ChevronUp size={18} color={NAVY} style={{ marginLeft: 6 }} /> : <ChevronDown size={18} color={NAVY} style={{ marginLeft: 6 }} />}
      </Pressable>

      {/* Status + Order ID */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: p.cancelled ? '#FDECEC' : GREEN_SOFT }}>
        <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: p.cancelled ? RED : GREEN, alignItems: 'center', justifyContent: 'center' }}>
          {p.cancelled ? <XCircle size={18} color="#FFFFFF" /> : <Check size={18} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: p.cancelled ? RED : GREEN }}>{headline}</Text>
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
                  backgroundColor: r.done ? GREEN : '#FFFFFF', borderWidth: r.done ? 0 : 2, borderColor: current ? GREEN : '#C5CBD3',
                }}>
                  {r.done ? <Check size={11} color="#FFFFFF" strokeWidth={3.2} /> : current ? <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: GREEN }} /> : null}
                </View>
                {i < rows.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: r.done && rows[i + 1].done ? GREEN : '#D9DEE5', marginTop: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, marginLeft: 8, marginVertical: 2, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: current ? GREEN_SOFT : 'transparent' }}>
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: r.done || current ? NAVY : MUTED }}>{title}</Text>
                <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }}>
                  {r.done ? (r.text || fmtDateTime(r.at) || 'Done') : p.cancelled ? '—' : current && (!r.waits || started[r.key]) ? 'In progress' : 'Pending'}
                </Text>
              </View>
            </View>
          );
        })}
      </View> : null}

    </View>
  );
}
