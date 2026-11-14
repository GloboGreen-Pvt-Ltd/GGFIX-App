// "Service History" card for Booking Details (Pickup Status card design).
// Shows ONLY steps the shop has actually completed in the Partner App —
// one row per real booking event, oldest first, with its real time. No
// default / pending / placeholder steps. The parent screen re-polls the
// booking every 10 s, so new completed steps appear live.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, ChevronUp } from 'lucide-react-native';
import { Card } from '../../../components/rnr';
import { SHOP_BOOKING_STATUS_OPTIONS } from '../../common/serviceHistoryPhases';
import { PickupTimeline, TEAL } from './pickupTimeline';
import { shopNumber } from '../../../utils/shopNumber';
import { rf } from '../../../utils/responsive';

const INK = '#111111';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';

// Service-flow statuses (Partner App canonical list) → display label.
const SERVICE_LABEL = Object.fromEntries(
  SHOP_BOOKING_STATUS_OPTIONS.filter((o) => o.phase === 'SERVICE').map((o) => [o.value, o.label]),
);
const TERMINAL = { CANCELLED: 'Cancelled', CUSTOMER_REJECTED: 'Rejected', REPAIR_NOT_COMPLETED: 'Not Completed' };
const up = (v) => String(v || '').toUpperCase();
const ts = (e) => new Date(e?.createdAt || 0).getTime() || 0;

// Completed service steps only: real events with a known service status,
// de-duplicated (latest occurrence of a status wins), in time order.
export function buildServiceHistory(events) {
  const latest = {};
  (events || []).forEach((e) => {
    const k = up(e?.status);
    if (!SERVICE_LABEL[k] || !e?.createdAt) return;
    if (!latest[k] || ts(e) > ts(latest[k])) latest[k] = e;
  });
  const rows = Object.entries(latest)
    .sort((a, b) => ts(a[1]) - ts(b[1]))
    .map(([k, e]) => ({ key: k, label: SERVICE_LABEL[k], state: 'done', at: e.createdAt, desc: e.note || null }));
  const last = rows[rows.length - 1];
  return {
    rows,
    terminal: last && TERMINAL[last.key] ? TERMINAL[last.key] : null,
    completed: !!latest.DELIVERED,
  };
}

const stamp = (r) => `${new Date(r.at).toLocaleString('en-IN', { day: '2-digit', month: 'short' })} · ${new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;

export default function ServiceHistoryCard({ events, bookingNumber }) {
  const [expanded, setExpanded] = useState(false);
  const st = buildServiceHistory(events);
  if (!st.rows.length) return null; // nothing completed yet → no card
  const chip = st.terminal ? { t: st.terminal, fg: '#B91C1C', bg: '#FEECEC' }
    : st.completed ? { t: 'Completed', fg: TEAL, bg: '#E5F3F5' }
    : { t: 'In Progress', fg: '#C2410C', bg: '#FFF1E6' };
  // First completed step → latest completed step (both real).
  const ends = st.rows.length > 1 ? [st.rows[0], st.rows[st.rows.length - 1]] : [st.rows[0]];
  const toggle = () => setExpanded((v) => !v);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: INK }}>Service History</Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: chip.bg }}>
          <Text style={{ fontSize: rf(11), fontWeight: '700', color: chip.fg }}>{chip.t}</Text>
        </View>
      </View>
      {bookingNumber ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 6 }}>Service #{String(shopNumber(bookingNumber)).replace(/^#/, '')}</Text> : null}
      <View style={{ height: 1, backgroundColor: LINE, marginVertical: 12 }} />
      <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
        {ends.map((r, i) => (
          <View key={`${r.key}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ alignSelf: 'stretch', height: 26, justifyContent: 'center', alignItems: 'center' }}>
              {ends.length > 1 ? (
                <View style={{ position: 'absolute', height: 3, top: 11.5, left: i === 0 ? '50%' : 0, right: i === 0 ? 0 : '50%', backgroundColor: TEAL }} />
              ) : null}
              <View style={{ height: 26, width: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: TEAL }}>
                <Check size={14} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
            <Text style={{ marginTop: 8, fontSize: rf(12.5), fontWeight: '700', color: INK, textAlign: 'center' }}>{r.label}</Text>
            <Text style={{ marginTop: 3, fontSize: rf(11), color: MUTED, textAlign: 'center' }}>{stamp(r)}</Text>
          </View>
        ))}
      </View>
      {st.rows.length > 2 ? (
        <>
          <View style={{ height: 1, backgroundColor: LINE, marginTop: 14 }} />
          <Pressable onPress={toggle} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: INK }}>{expanded ? 'Show Less' : 'See All Updates'}</Text>
              <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2 }}>{`${st.rows.length} completed updates`}</Text>
            </View>
            {expanded ? <ChevronUp size={20} color={INK} /> : <ChevronRight size={20} color={INK} />}
          </Pressable>
          {expanded ? (
            <View style={{ marginTop: 14 }}>
              <PickupTimeline rows={st.rows} />
              <Pressable onPress={toggle} accessibilityRole="button" style={{ marginTop: 12, height: 40, borderRadius: 10, borderWidth: 1, borderColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: TEAL, marginRight: 4 }}>Show Less</Text>
                <ChevronUp size={16} color={TEAL} />
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
