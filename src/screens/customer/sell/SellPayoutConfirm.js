import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BadgeCheck, Wallet } from 'lucide-react-native';
import { getSellPurchase, confirmSellPayout } from '../../../api/orders';
import { confirm, notify } from '../../../components/confirm';
import { rf, rlh } from '../../../utils/responsive';

// "Payment received?" card for Sell Order Details / Sell Device Details. Shown
// only while the shop has recorded its payout and waits for the customer
// (status PAYMENT_PENDING, GET /sell-orders/{id}/purchase allows CONFIRM_PAYOUT).
// Confirm → POST /sell-orders/{id}/payout/confirm (order → PAID, shop notified).
const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = 'rgba(17,17,17,0.55)';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const humanize = (s) => String(s || '').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const when = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

export default function SellPayoutConfirm({ sellOrderId, status, onConfirmed, style }) {
  const pending = String(status || '').toUpperCase() === 'PAYMENT_PENDING';
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    let off = false;
    if (!pending || !sellOrderId) { setView(null); return undefined; }
    getSellPurchase(sellOrderId).then((v) => { if (!off) setView(v || null); }).catch(() => { if (!off) setView(null); });
    return () => { off = true; };
  }, [pending, sellOrderId]);

  // The server is the gate: only while it offers CONFIRM_PAYOUT (a status-only
  // fallback when the purchase view didn't load).
  const allowed = view ? (view.allowedActions || []).includes('CONFIRM_PAYOUT') : pending;
  if (!allowed) return null;
  const pay = view?.payment || {};

  const onConfirm = async () => {
    if (lock.current) return;
    const ok = await confirm({
      title: 'Payment received?',
      message: `Confirm you received ${pay.amount != null ? inr(pay.amount) : 'the payment'} from the shop. The shop will be notified and can complete the sale.`,
      confirmText: 'Yes, received',
    });
    if (!ok) return;
    lock.current = true;
    setBusy(true);
    try {
      await confirmSellPayout(sellOrderId);
      notify('Payment confirmed', 'Thanks — the shop has been notified.', { type: 'success' });
      onConfirmed?.();
    } catch (e) {
      lock.current = false;
      notify('Could not confirm', e?.message || 'Please try again.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const details = [
    pay.method ? humanize(pay.method) : null,
    pay.reference ? `Ref ${pay.reference}` : null,
    when(pay.recordedAt) ? `Sent ${when(pay.recordedAt)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(250,167,0,0.45)', backgroundColor: 'rgba(250,167,0,0.14)', padding: 12, marginVertical: 5 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={18} color={TEAL} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: INK }}>
            Shop sent your payment{pay.amount != null ? ` · ${inr(pay.amount)}` : ''}
          </Text>
          <Text style={{ marginTop: 2, fontSize: rf(12), lineHeight: rlh(16), color: MUTED }}>
            {details || 'Check your account, then confirm once you have received it.'}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onConfirm}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        style={{ marginTop: 10, height: 46, borderRadius: 12, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.75 : 1 }}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <BadgeCheck size={18} color="#FFFFFF" />}
        <Text style={{ marginLeft: 8, fontSize: rf(14.5), fontWeight: '800', color: '#FFFFFF' }}>Confirm Payment Received</Text>
      </Pressable>
    </View>
  );
}
