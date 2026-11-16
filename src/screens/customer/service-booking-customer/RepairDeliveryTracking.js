import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle, CalendarClock, Check, MapPin, Phone, RefreshCw, ShieldCheck, Truck, User, Wallet } from 'lucide-react-native';
import { getRepairDeliveryForCustomer } from '../../../api/orders';

// Repair Tracking → delivery back to the customer (doorstep-return bookings):
// Delivery Ready → Scheduled → Employee Assigned → Accepted → Collected from
// Shop → Out for Delivery → Arrived → Delivered. The backend scopes the
// endpoint to the signed-in customer's own ticket (403/404 otherwise) and only
// returns the OTP / phone when appropriate. Refreshed on focus, every 20 s
// while focused, and whenever the parent bumps `refreshKey` (pull-to-refresh).

const TEAL = '#035C6C';
const GREEN = '#01AC77';
const AMBER = '#B45309';
const RED = '#B91C1C';
const MUTED = '#6B7280';
const TEXT = '#111827';
const LINE = '#E5E7EB';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const READY = ['READY', 'READY_FOR_DELIVERY', 'QC_PASSED', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING', 'DELIVERED'];
// Unable to repair / customer rejected the estimate → device goes back unrepaired.
const NOT_REPAIRED = /UNABLE|NOT_REPAIR|REPAIR_NOT_COMPLETED|NOT_COMPLETED|REJECT|IRREPAIRABLE|UNREPAIRABLE/;
// Delivery-status order (index = progress rank).
const ORDER = ['UNASSIGNED', 'SCHEDULED', 'ASSIGNED', 'ACCEPTED', 'COLLECTED', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED'];
const PROBLEM = ['FAILED', 'RETURNING', 'RETURNED'];
const PAY = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', ONLINE: 'Online', PREPAID: 'Prepaid' };

const h12 = (t) => { const n = Number(String(t || '').slice(0, 2)); return `${n % 12 || 12} ${n < 12 ? 'AM' : 'PM'}`; };
function slot(d) {
  if (!d?.scheduledDate) return null;
  const [y, m, day] = String(d.scheduledDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return null;
  const range = d.slotStart ? `, ${h12(d.slotStart)}${d.slotEnd ? ` – ${h12(d.slotEnd)}` : ''}` : '';
  return `${day} ${MONTHS[m - 1]} ${y}${range}`;
}
function when(iso) {
  if (!iso) return null;
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}, ${x.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const evAt = (d, re) => (d?.events || []).slice().reverse().find((e) => re.test(String(e?.status || e?.type || '').toUpperCase()))?.createdAt;
const addrText = (a) => (typeof a === 'string' ? a : a ? [a.line1 || a.addressLine1, a.line2 || a.addressLine2, a.landmark, a.city, a.pincode].filter(Boolean).join(', ') : null);

function errKind(e) {
  const s = e?.response?.status ?? e?.status;
  if (s === 404 || s === 403 || s === 401) return 'none'; // no delivery / not this customer: never show
  if (s === 0 || e?.timeout) return 'offline';
  if (!e?.response && (e?.message === 'Network Error' || /network|offline|timeout/i.test(String(e?.message || '')))) return 'offline';
  return 'server';
}

function Row({ icon: Icon, children, color = TEXT }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ marginTop: 1 }}><Icon size={15} color={TEAL} /></View>
      <Text style={{ flex: 1, fontSize: 13, color, marginLeft: 8 }}>{children}</Text>
    </View>
  );
}

export default function RepairDeliveryTracking({ ticketId, refreshKey }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | none | offline | server
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await getRepairDeliveryForCustomer(ticketId);
      if (!alive.current) return;
      setData(res || null);
      setState('ok');
    } catch (e) {
      if (!alive.current) return;
      const k = errKind(e);
      // Keep the last good data on transient failures; the card flags the problem.
      setState(k);
      if (k === 'none') setData(null);
      else if (__DEV__) console.warn('[RepairDeliveryTracking]', e?.message);
    }
  }, [ticketId]);
  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]));
  useEffect(() => { if (refreshKey) load(); }, [refreshKey, load]);

  const card = (children) => (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 14, marginBottom: 12 }}>{children}</View>
  );

  if (!ticketId || state === 'none') return null;
  if (state === 'loading') return null; // avoid flashing a card on non-delivery bookings
  if (state === 'offline' || state === 'server') {
    if (!data) {
      return card(
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AlertTriangle size={16} color={AMBER} />
          <Text style={{ flex: 1, fontSize: 12.5, color: AMBER, marginLeft: 8 }}>
            {state === 'offline' ? "You're offline. Delivery status will update when you reconnect." : "Couldn't load delivery status. Please try again."}
          </Text>
          <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Retry" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RefreshCw size={14} color={TEAL} />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: TEAL, marginLeft: 4 }}>Retry</Text>
          </Pressable>
        </View>,
      );
    }
  }
  if (!data) return null;

  const d = data.delivery;
  const ts = String(data.ticketStatus || '').toUpperCase();
  const outcome = String(data.repairOutcome || data.outcome || ts).toUpperCase();
  const notRepaired = NOT_REPAIRED.test(outcome) || NOT_REPAIRED.test(ts);
  const doorstep = data.returnMode ? /DOOR|HOME|DELIVERY/i.test(String(data.returnMode)) : true;
  if (!doorstep) return null;
  if (!d && !READY.includes(ts) && !notRepaired) return null;

  const st = String(d?.status || '').toUpperCase();
  const rank = ORDER.indexOf(st);
  const at = (i) => rank >= i;
  const problem = PROBLEM.includes(st);
  const title = notRepaired ? 'Device Return' : 'Delivery to You';
  const steps = [
    { label: notRepaired ? 'Return Ready' : 'Delivery Ready', done: READY.includes(ts) || notRepaired || !!d },
    { label: 'Scheduled', done: !!d?.scheduledDate || at(1) },
    { label: 'Employee Assigned', done: !!d?.employee || at(2) },
    { label: 'Accepted', done: at(3) },
    { label: 'Collected from Shop', done: at(4) || !!d?.releasedAt },
    { label: 'Out for Delivery', done: at(5) },
    { label: 'Arrived', done: at(6) },
    { label: notRepaired ? 'Returned' : 'Delivered', done: st === 'DELIVERED' },
  ];
  const current = problem ? -1 : steps.findIndex((s) => !s.done);
  const canCall = !!d?.employee?.phone && (d.canCall ?? d.employee.canCall ?? ['ACCEPTED', 'COLLECTED', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(st));
  const showOtp = !!d?.otp && st !== 'DELIVERED' && !problem;
  const addr = addrText(d?.customerAddress || d?.address || data.customerAddress);
  const payMethod = PAY[String(d?.paymentMethod || data.paymentMethod || '').toUpperCase()] || d?.paymentMethod || data.paymentMethod;
  const supported = (d?.supportedPaymentMethods || data.supportedPaymentMethods || []).map((m) => PAY[String(m).toUpperCase()] || m);
  const deliveredAt = when(d?.deliveredAt || evAt(d, /DELIVERED/));
  const rescheduled = !!(d?.rescheduled || d?.rescheduledAt || Number(d?.attempt) > 1);
  const reassigned = !!(d?.reassigned || d?.reassignedAt);

  return card(
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Truck size={18} color={TEAL} />
        <Text style={{ fontSize: 15, fontWeight: '800', color: TEXT, marginLeft: 8, flex: 1 }}>{title}</Text>
        {d?.statusLabel ? <Text style={{ fontSize: 12, fontWeight: '800', color: st === 'DELIVERED' ? GREEN : problem ? AMBER : TEAL }}>{d.statusLabel}</Text> : null}
      </View>
      {notRepaired ? (
        <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>
          {/REJECT/.test(outcome) ? 'You declined the repair estimate. Your device is being returned without repair.' : "The shop couldn't repair your device. It is being returned to you."}
        </Text>
      ) : null}

      <View style={{ marginTop: 14 }}>
        {steps.map((s, i) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 26 }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <View style={{ height: 18, width: 18, borderRadius: 9, backgroundColor: s.done ? GREEN : '#FFFFFF', borderWidth: 2, borderColor: s.done ? GREEN : i === current ? TEAL : '#C9CED6', alignItems: 'center', justifyContent: 'center' }}>
                {s.done ? <Check size={11} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </View>
            <Text style={{ fontSize: 12.5, marginLeft: 10, color: s.done || i === current ? TEXT : MUTED, fontWeight: i === current ? '800' : '500' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {state !== 'ok' ? (
        <Text style={{ fontSize: 11.5, color: AMBER, marginTop: 8 }}>{state === 'offline' ? "You're offline — showing last known status." : "Couldn't refresh — showing last known status."}</Text>
      ) : null}

      {problem ? (
        <View style={{ flexDirection: 'row', backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A', padding: 10, marginTop: 12 }}>
          <AlertTriangle size={15} color={AMBER} />
          <Text style={{ flex: 1, fontSize: 12.5, color: AMBER, marginLeft: 8 }}>
            {st === 'FAILED' ? 'The delivery attempt failed.' : st === 'RETURNING' ? 'Your device is being taken back to the shop.' : 'Your device is back at the shop.'}
            {d?.failReason ? ` Reason: ${d.failReason}.` : ''} The shop will contact you to reschedule.
          </Text>
        </View>
      ) : null}
      {!problem && st !== 'DELIVERED' && (rescheduled || reassigned) ? (
        <Text style={{ fontSize: 12, color: TEAL, marginTop: 10 }}>
          {[rescheduled && 'Delivery rescheduled', reassigned && 'Delivery person changed'].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      {showOtp ? (
        <View style={{ alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', padding: 12, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldCheck size={16} color={GREEN} />
            <Text style={{ fontSize: 13.5, fontWeight: '800', color: TEXT, marginLeft: 6 }}>Delivery OTP</Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {String(d.otp).split('').map((c, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <View key={i} style={{ width: 42, height: 50, marginHorizontal: 4, borderRadius: 10, borderWidth: 1.5, borderColor: GREEN, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: GREEN }}>{c}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 8, textAlign: 'center' }}>Share it only when you receive your device. Never share it on a call.</Text>
        </View>
      ) : null}

      {d ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          {slot(d) ? <Row icon={CalendarClock}>{slot(d)}</Row> : null}
          {addr ? <Row icon={MapPin}>{addr}</Row> : null}
          {d.employee?.name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <User size={15} color={TEAL} />
              <Text style={{ flex: 1, fontSize: 13, color: TEXT, marginLeft: 8 }}>{`Delivery by ${d.employee.name}`}</Text>
              {canCall && st !== 'DELIVERED' && !problem ? (
                <Pressable onPress={() => Linking.openURL(`tel:${d.employee.phone}`).catch(() => {})} accessibilityRole="button" accessibilityLabel={`Call ${d.employee.name}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Phone size={14} color={TEAL} />
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: TEAL, marginLeft: 4 }}>Call Delivery Person</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {Number(d.amountDue) > 0 && st !== 'DELIVERED' ? (
            <Row icon={Wallet}>
              {'Amount due at delivery: '}<Text style={{ fontWeight: '800' }}>{money(d.amountDue)}</Text>
              {supported.length ? ` (${supported.join(' / ')})` : payMethod ? ` (${payMethod})` : ''}
            </Row>
          ) : null}
          {st === 'DELIVERED' ? (
            <View style={{ backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: GREEN }}>{`${notRepaired ? 'Returned' : 'Delivered'}${deliveredAt ? ` on ${deliveredAt}` : ''}`}</Text>
              {Number(d.amountCollected) > 0 ? (
                <Text style={{ fontSize: 12.5, color: TEXT }}>{`Payment received: ${money(d.amountCollected)}${payMethod ? ` via ${payMethod}` : ''}`}{d.receiptNo || d.paymentRef ? ` · Receipt ${d.receiptNo || d.paymentRef}` : ''}</Text>
              ) : Number(d.amountDue) > 0 ? (
                <Text style={{ fontSize: 12.5, color: AMBER }}>{`Payment pending: ${money(d.amountDue)}`}</Text>
              ) : (
                <Text style={{ fontSize: 12.5, color: TEXT }}>No payment due.</Text>
              )}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>
          {notRepaired ? 'The shop will schedule the return of your device soon.' : 'Your device is repaired. The shop will schedule the delivery soon.'}
        </Text>
      )}
    </>,
  );
}
