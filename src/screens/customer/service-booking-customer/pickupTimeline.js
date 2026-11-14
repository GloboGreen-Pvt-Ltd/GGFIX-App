import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, ChevronUp } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';

// Pickup tracking for View Details. Built only from the booking's real
// status/events: timestamps come from events, never invented.
export const TEAL = '#035C6C';
export const ORANGE = '#F09406';
const GREY = '#D1D5DB';
const INK = '#111111';
const MUTED = '#6B7280';

export const PICKUP_STEPS = [
  { key: 'PICKUP_REQUESTED', label: 'Pickup Requested', desc: 'Your pickup request was placed.', aliases: ['ORDER_PLACED', 'BOOKING_CREATED_BY_SHOP'] },
  { key: 'PICKUP_ACCEPTED', label: 'Pickup Confirmed', desc: 'The shop confirmed your pickup.', aliases: ['PICKUP_CONFIRMED', 'ORDER_SERVICE_CONFIRMED', 'SERVICE_ACCEPTED'] },
  { key: 'PICKUP_PERSON_ASSIGNED', label: 'Pickup Person Assigned', desc: 'A pickup person has been assigned.', aliases: ['PICKUP_ASSIGNED', 'PICKUP_REASSIGNED'], person: true },
  { key: 'PICKUP_ON_THE_WAY', label: 'Out for Pickup', desc: 'The pickup person is on the way.', aliases: ['OUT_FOR_PICKUP'], person: true },
  { key: 'REACHED_CUSTOMER_LOCATION', label: 'Reached Customer Location', desc: 'The pickup person reached your location.', aliases: [], person: true },
  { key: 'REPAIR_ESTIMATE_PROCESSING', label: 'Repair Estimate Processing', desc: 'Your device is being checked for an estimate.', aliases: ['ESTIMATE_PROCESSING', 'ESTIMATE_SUBMITTED'], person: true },
  { key: 'DEVICE_PICKED_UP', label: 'Device Picked Up', desc: 'Your device has been picked up.', aliases: ['PICKED_UP', 'DEVICE_RECEIVED'], person: true },
  { key: 'REACHED_SHOP', label: 'Reached Shop', desc: 'Your device reached the shop.', aliases: ['DEVICE_DELIVERY_TO_SHOP'] },
];
const TERMINAL = {
  CANCELLED: 'Pickup Cancelled', PICKUP_CANCELLED: 'Pickup Cancelled', BOOKING_CANCELLED: 'Pickup Cancelled',
  REJECTED: 'Pickup Rejected', PICKUP_REJECTED: 'Pickup Rejected', SERVICE_REJECTED: 'Pickup Rejected',
};
const RESCHEDULED = ['RESCHEDULED', 'PICKUP_RESCHEDULED'];

const up = (v) => String(v || '').toUpperCase();
const matches = (step, s) => step.key === s || step.aliases.includes(s);
const time = (e) => new Date(e?.createdAt || 0).getTime() || 0;

export const fmtStamp = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export function buildPickupTimeline(b) {
  const events = (b?.events || []).slice().sort((x, y) => time(x) - time(y));
  const status = up(b?.status);
  const evFor = PICKUP_STEPS.map((st) => {
    let hit = null;
    events.forEach((e) => { if (matches(st, up(e.status))) hit = e; });
    return hit;
  });
  let doneIdx = -1;
  evFor.forEach((e, i) => { if (e) doneIdx = i; });
  const byStatus = PICKUP_STEPS.findIndex((st) => matches(st, status));
  if (byStatus > doneIdx) doneIdx = byStatus;

  const termEv = [...events].reverse().find((e) => TERMINAL[up(e.status)]);
  const terminalKey = TERMINAL[status] ? status : termEv ? up(termEv.status) : null;
  const terminal = terminalKey && doneIdx < 7
    ? { label: TERMINAL[terminalKey], at: termEv?.createdAt, note: termEv?.note || b?.cancelReason || b?.rejectReason }
    : null;
  const resEv = [...events].reverse().find((e) => RESCHEDULED.includes(up(e.status)));
  const rescheduled = !terminal && (resEv || RESCHEDULED.includes(status)) ? { at: resEv?.createdAt, note: resEv?.note } : null;

  const curIdx = terminal || doneIdx >= PICKUP_STEPS.length - 1 ? -1 : doneIdx + 1;
  const person = b?.pickupPersonName || b?.pickupEmployeeName || b?.assignedEmployeeName || b?.technicianName || null;
  const personPhone = b?.pickupPersonPhone || b?.pickupEmployeePhone || null;
  const rows = PICKUP_STEPS.map((st, i) => {
    const e = evFor[i];
    const who = e?.actorName || e?.employeeName || e?.performedByName || (st.person && i <= doneIdx ? person : null);
    return {
      key: st.key, label: st.label,
      state: i <= doneIdx ? 'done' : i === curIdx ? 'current' : 'pending',
      at: e?.createdAt || null,
      desc: e?.note || (i <= doneIdx || i === curIdx ? st.desc : null),
      who: who ? [who, st.person && who === person ? personPhone : null].filter(Boolean).join(' · ') : null,
    };
  });
  return { rows, terminal, rescheduled, completed: doneIdx >= 7 };
}

// Flipkart-style connected vertical timeline.
export function PickupTimeline({ rows }) {
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    const dot = r.state === 'done' ? TEAL : r.state === 'current' ? ORANGE : GREY;
    const size = 22;
    return (
      <View key={r.key} style={{ flexDirection: 'row' }}>
        <View style={{ alignItems: 'center', width: size + 6, marginRight: 10 }}>
          <View style={{ height: size, width: size, borderRadius: size / 2, backgroundColor: r.state === 'pending' ? '#FFFFFF' : dot, borderWidth: r.state === 'pending' ? 2 : 0, borderColor: GREY, alignItems: 'center', justifyContent: 'center' }}>
            {r.state === 'done' ? <Check size={size * 0.62} color="#FFFFFF" strokeWidth={3} />
              : r.state === 'current' ? <View style={{ height: size * 0.36, width: size * 0.36, borderRadius: size, backgroundColor: '#FFFFFF' }} /> : null}
          </View>
          {!last ? <View style={{ flex: 1, width: 2, minHeight: 20, backgroundColor: rows[i + 1].state === 'done' ? TEAL : GREY }} /> : null}
        </View>
        <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
          <Text style={{ fontSize: rf(14), fontWeight: r.state === 'pending' ? '500' : '800', color: r.state === 'pending' ? MUTED : INK }}>{r.label}</Text>
          {r.at ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 2 }}>{fmtStamp(r.at)}</Text> : null}
          {r.desc ? <Text style={{ fontSize: rf(12), color: INK, marginTop: 3, lineHeight: rf(16) }}>{r.desc}</Text> : null}
          {r.who ? <Text style={{ fontSize: rf(11.5), color: TEAL, marginTop: 3, fontWeight: '700' }}>{r.who}</Text> : null}
        </View>
      </View>
    );
  });
}

// Cancelled / rejected / rescheduled banner.
export function PickupNotice({ terminal, rescheduled }) {
  if (!terminal && !rescheduled) return null;
  const red = !!terminal;
  const src = red ? terminal : rescheduled;
  return (
    <View style={{ borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: red ? '#FEECEC' : '#FEF6DA' }}>
      <Text style={{ fontSize: rf(13), fontWeight: '800', color: red ? '#B91C1C' : '#92400E' }}>{red ? terminal.label : 'Pickup Rescheduled'}</Text>
      {src.at ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 2 }}>{fmtStamp(src.at)}</Text> : null}
      {src.note ? <Text style={{ fontSize: rf(12), color: INK, marginTop: 3 }}>{src.note}</Text> : null}
    </View>
  );
}

// Repair phase rows from the booking's own events (Partner App service statuses).
// Real events only, time order; QC is hidden from the customer; reassignments keep every occurrence.
const REPAIR_LABEL = {
  ASSIGNED_TO_TECHNICIAN: 'Technician Assigned',
  REASSIGNED_TO_TECHNICIAN: 'Technician Reassigned',
  TECHNICIAN_ACCEPTED_SERVICE: 'Technician Accepted',
  TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED: 'Issue Verified & Updated',
  RE_ESTIMATED_CONFIRMED: 'Re-Estimate Requested',
  CUSTOMER_APPROVED: 'Re-Estimate Approved',
  CUSTOMER_REJECTED: 'Repair Declined',
  IN_REPAIR: 'Repair In Progress',
  REPAIR_COMPLETED: 'Repair Completed',
  REPAIR_NOT_COMPLETED: 'Repair Not Completed',
  RETURN_DELIVERY: 'Return to Customer',
};
const KEEP_ALL = ['REASSIGNED_TO_TECHNICIAN'];
export function buildRepairRows(b) {
  const out = [];
  const seen = {};
  (b?.events || []).slice().sort((x, y) => time(x) - time(y)).forEach((e, i) => {
    const k = up(e?.status);
    if (!REPAIR_LABEL[k] || !e?.createdAt) return;
    const row = {
      key: KEEP_ALL.includes(k) ? `R_${k}_${i}` : `R_${k}`, status: k, label: REPAIR_LABEL[k], state: 'done', at: e.createdAt,
      desc: e.note || null, who: e.actorName || e.employeeName || e.performedByName || e.technicianName || null,
    };
    if (KEEP_ALL.includes(k)) { out.push(row); return; }
    if (seen[k] != null) out[seen[k]] = row; else { seen[k] = out.length; out.push(row); }
  });
  return out;
}

const GREEN = '#16A34A';
// "Service Progress": 4 milestones (Picked Up · Repair · Out for Delivery · Delivered)
// + the full Service Timeline (pickup → repair → delivery) behind a toggle.
export function PickupHorizontalCard({ b, delivery, expanded, onToggle }) {
  const pt = buildPickupTimeline(b);
  // Pickup rows: real events only (plus the current status row the backend reports).
  const pDone = pt.rows.filter((r) => r.state === 'done');
  const pRows = pDone.filter((r, i) => r.at || i === pDone.length - 1);
  const rRows = buildRepairRows(b);
  const dRows = buildDeliveryRows(delivery);
  const timeline = [...pRows, ...rRows, ...dRows]
    .map((r, i) => ({ r, i }))
    .sort((x, y) => (x.r.at && y.r.at ? (time({ createdAt: x.r.at }) - time({ createdAt: y.r.at })) || x.i - y.i : x.i - y.i))
    .map((x) => x.r);
  if (!timeline.length && !pt.terminal && !pt.rescheduled) return null;

  const find = (rows, keys) => { let hit = null; rows.forEach((r) => { if (keys.includes(r.status || r.key)) hit = r; }); return hit; };
  const picked = find(pRows, ['DEVICE_PICKED_UP']) || find(pRows, ['REACHED_SHOP']);
  const repairEnd = find(rRows, ['REPAIR_COMPLETED', 'REPAIR_NOT_COMPLETED', 'CUSTOMER_REJECTED']);
  const out = find(dRows, ['D_OUT']);
  const done = find(dRows, ['D_DELIVERED']);
  const repairLabel = repairEnd?.status === 'REPAIR_NOT_COMPLETED' ? 'Repair Not Completed'
    : repairEnd?.status === 'CUSTOMER_REJECTED' ? 'Repair Declined' : 'Repair Completed';
  const miles = [
    { key: 'M_PICK', label: 'Picked Up', row: picked },
    { key: 'M_REPAIR', label: repairLabel, row: repairEnd, bad: !!repairEnd && repairEnd.status !== 'REPAIR_COMPLETED' },
    { key: 'M_OUT', label: 'Out for Delivery', row: out },
    { key: 'M_DONE', label: done?.label === 'Returned' ? 'Returned' : 'Delivered', row: done },
  ];
  const activeIdx = pt.terminal ? -1 : miles.findIndex((m) => !m.row);

  const failed = ['FAILED', 'RETURNING', 'RETURNED'].includes(up(delivery?.delivery?.status));
  const chip = pt.terminal ? { t: pt.terminal.label.replace('Pickup ', ''), fg: '#B91C1C', bg: '#FEECEC' }
    : done ? { t: done.label, fg: '#15803D', bg: '#DCFCE7' }
    : failed ? { t: 'Delivery Failed', fg: '#B45309', bg: '#FEF3C7' }
    : dRows.length ? { t: 'Delivery In Progress', fg: '#C2410C', bg: '#FFF1E6' }
    : rRows.length ? { t: repairEnd ? repairLabel : 'Repair In Progress', fg: repairEnd && repairEnd.status !== 'REPAIR_COMPLETED' ? '#B91C1C' : TEAL, bg: '#E5F3F5' }
    : { t: 'In Progress', fg: '#C2410C', bg: '#FFF1E6' };
  const stamp = (r) => (r?.at
    ? `${new Date(r.at).toLocaleString('en-IN', { day: '2-digit', month: 'short' })}, ${new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
    : r ? 'Done' : '');
  const LINE = '#E5E7EB';
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: INK }}>Service Progress</Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: chip.bg }}>
          <Text style={{ fontSize: rf(11), fontWeight: '700', color: chip.fg }}>{chip.t}</Text>
        </View>
      </View>
      {b?.bookingNumber ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 6 }}>Ticket #{String(b.bookingNumber).replace(/^#/, '')}</Text> : null}
      <View style={{ height: 1, backgroundColor: LINE, marginVertical: 12 }} />
      <PickupNotice terminal={pt.terminal} rescheduled={pt.rescheduled} />
      <View style={{ flexDirection: 'row' }}>
        {miles.map((m, i) => {
          const state = m.row ? 'done' : i === activeIdx ? 'active' : 'pending';
          const color = state === 'done' ? (m.bad ? '#DC2626' : GREEN) : state === 'active' ? TEAL : '#D1D5DB';
          return (
            <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ alignSelf: 'stretch', height: 26, justifyContent: 'center', alignItems: 'center' }}>
                {i > 0 ? <View style={{ position: 'absolute', height: 2, top: 12, left: 0, right: '50%', backgroundColor: m.row ? GREEN : LINE }} /> : null}
                {i < miles.length - 1 ? <View style={{ position: 'absolute', height: 2, top: 12, left: '50%', right: 0, backgroundColor: miles[i + 1].row ? GREEN : LINE }} /> : null}
                <View style={{ height: 24, width: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'pending' ? '#FFFFFF' : color, borderWidth: state === 'pending' ? 2 : 0, borderColor: color }}>
                  {state === 'done' ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : state === 'active' ? <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} /> : null}
                </View>
              </View>
              <Text style={{ marginTop: 6, fontSize: rf(11.5), fontWeight: '700', color: state === 'pending' ? MUTED : INK, textAlign: 'center' }}>{m.label}</Text>
              {m.row ? <Text style={{ marginTop: 2, fontSize: rf(10.5), color: m.bad ? '#DC2626' : GREEN, textAlign: 'center' }}>{stamp(m.row)}</Text> : null}
            </View>
          );
        })}
      </View>
      {delivery?.delivery?.otp && !done && !failed ? (
        <View style={{ marginTop: 12, borderRadius: 10, backgroundColor: '#ECFDF5', padding: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: rf(12), color: INK }}>Delivery OTP · share only when you receive the device</Text>
          <Text style={{ fontSize: rf(16), fontWeight: '800', color: '#15803D', letterSpacing: 3 }}>{delivery.delivery.otp}</Text>
        </View>
      ) : null}
      {timeline.length ? (<>
      <View style={{ height: 1, backgroundColor: LINE, marginTop: 14 }} />
      <Pressable onPress={onToggle} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: INK }}>Service Timeline</Text>
          <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2 }}>{`${timeline.length} completed updates · ${expanded ? 'Show Less' : 'Show More'}`}</Text>
        </View>
        {expanded ? <ChevronUp size={20} color={INK} /> : <ChevronRight size={20} color={INK} />}
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: 14 }}>
          <PickupTimeline rows={timeline} />
          <Pressable onPress={onToggle} accessibilityRole="button" style={{ marginTop: 12, height: 40, borderRadius: 10, borderWidth: 1, borderColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: TEAL, marginRight: 4 }}>Show Less</Text>
            <ChevronUp size={16} color={TEAL} />
          </Pressable>
        </View>
      ) : null}
      </>) : null}
    </View>
  );
}

// ── Delivery back to the customer (repair-delivery API), as timeline rows ──
// Only steps that already happened; times from the delivery's own events.
const D_ORDER = ['UNASSIGNED', 'SCHEDULED', 'ASSIGNED', 'ACCEPTED', 'COLLECTED', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED'];
const D_READY = ['READY', 'READY_FOR_DELIVERY', 'QC_PASSED', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING', 'DELIVERED'];
const D_NOT_REPAIRED = /UNABLE|NOT_REPAIR|REPAIR_NOT_COMPLETED|NOT_COMPLETED|REJECT|IRREPAIRABLE|UNREPAIRABLE/;
export function buildDeliveryRows(data) {
  if (!data) return [];
  const d = data.delivery;
  const ts = up(data.ticketStatus);
  const notRepaired = D_NOT_REPAIRED.test(up(data.repairOutcome || data.outcome || ts));
  if (data.returnMode && !/DOOR|HOME|DELIVERY/i.test(String(data.returnMode))) return [];
  if (!d && !D_READY.includes(ts) && !notRepaired) return [];
  const st = up(d?.status);
  const rank = D_ORDER.indexOf(st);
  const evs = (d?.events || data.events || []).slice().sort((x, y) => time({ createdAt: x.at || x.createdAt }) - time({ createdAt: y.at || y.createdAt }));
  const evAt = (re) => { let a = null; evs.forEach((e) => { if (re.test(up(e.status || e.type))) a = e.at || e.createdAt; }); return a; };
  const who = d?.employee?.name ? [d.employee.name, d.employee.phone].filter(Boolean).join(' · ') : null;
  const steps = [
    { key: 'D_READY', label: notRepaired ? 'Return Ready' : 'Delivery Ready', done: true, at: data.readyAt || evAt(/READY/) || d?.createdAt, desc: notRepaired ? 'Your device is ready to be returned.' : 'Your device is repaired and ready for delivery.' },
    { key: 'D_SCHEDULED', label: 'Delivery Scheduled', done: !!d?.scheduledDate || rank >= 1, at: evAt(/SCHEDULED/) || d?.scheduledAt },
    { key: 'D_ASSIGNED', label: 'Delivery Person Assigned', done: !!d?.employee || rank >= 2, at: evAt(/ASSIGNED/) || d?.assignedAt, who },
    { key: 'D_ACCEPTED', label: 'Delivery Accepted', done: rank >= 3, at: evAt(/ACCEPTED/) || d?.acceptedAt, who },
    { key: 'D_COLLECTED', label: 'Collected from Shop', done: rank >= 4 || !!d?.releasedAt, at: evAt(/COLLECTED/) || d?.collectedAt || d?.releasedAt, who },
    { key: 'D_OUT', label: 'Out for Delivery', done: rank >= 5, at: evAt(/OUT_FOR_DELIVERY/) || d?.outForDeliveryAt || d?.startedAt, who },
    { key: 'D_ARRIVED', label: 'Arrived at Customer Location', done: rank >= 6, at: evAt(/ARRIVED/) || d?.arrivedAt, who },
    { key: 'D_DELIVERED', label: notRepaired ? 'Returned' : 'Delivered to Customer', done: st === 'DELIVERED', at: d?.deliveredAt || evAt(/DELIVERED/), who },
  ];
  // Every step the backend status has passed, with its recorded time when available.
  return steps.filter((s) => s.done).map((s) => ({ key: s.key, label: s.label, state: 'done', at: s.at || null, desc: s.desc || null, who: s.who || null }));
}
