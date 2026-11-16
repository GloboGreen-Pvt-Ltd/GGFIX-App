import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, PrimaryButton, OutlineButton } from '../../../components/ui';
import { TextInput } from '../../../components/Typography';
import { approveSellRevision, rejectSellRevision, confirmSellPayout, disputeSellPayout } from '../../../api/orders';
import { confirm, notify } from '../../../components/confirm';
import { rf } from '../../../utils/responsive';

// What the shop is waiting on from the customer after a quote is accepted
// (GET /sell-orders/{id}/purchase allowedActions): approve / reject a revised
// price, or confirm / dispute the shop's payout. Nothing else changes here.

const inr = (v) => (v == null ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);

export default function SellPurchaseActionCard({ sellOrderId, purchase, onChanged }) {
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(null); // 'reject' | 'dispute' — note box open
  const [busy, setBusy] = useState(null);
  const acts = purchase?.allowedActions || [];
  const rev = purchase?.revision;
  const pay = purchase?.payment || {};
  if (!acts.length) return null;

  const run = async (key, fn, done) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      notify(done, '', { preset: 'done' });
      setAsking(null);
      setNote('');
      onChanged?.();
    } catch (e) {
      notify('Could not update', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (acts.includes('APPROVE_REVISION')) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>The shop revised the price</Text>
        <Text style={styles.big}>{inr(rev?.amount)}</Text>
        <Text style={styles.text}>Reason: {rev?.reason || '—'}</Text>
        {asking === 'reject' ? (
          <>
            <TextInput value={note} onChangeText={setNote} placeholder="Why are you rejecting? (optional)" maxLength={300} style={styles.input} />
            <View style={styles.row}>
              <OutlineButton title="Back" onPress={() => setAsking(null)} style={styles.half} />
              <PrimaryButton title="Reject Price" loading={busy === 'reject'} onPress={() => run('reject', () => rejectSellRevision(sellOrderId, note.trim()), 'Revised price rejected')} style={[styles.half, styles.red]} />
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <OutlineButton title="Reject" onPress={() => setAsking('reject')} style={styles.half} />
            <PrimaryButton title="Approve" loading={busy === 'approve'} style={styles.half} onPress={async () => {
              if (await confirm({ title: `Sell for ${inr(rev?.amount)}?`, message: 'The shop will pay you this amount.', confirmText: 'Approve' })) {
                run('approve', () => approveSellRevision(sellOrderId), 'Revised price approved');
              }
            }} />
          </View>
        )}
      </Card>
    );
  }

  if (acts.includes('CONFIRM_PAYOUT')) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Did you receive the payment?</Text>
        <Text style={styles.big}>{inr(pay.amount)}</Text>
        <Text style={styles.text}>{pay.method === 'UPI' ? 'UPI' : pay.method === 'CASH' ? 'Cash' : 'Bank transfer'}{pay.account ? ` to ${pay.account}` : ''}</Text>
        {pay.reference ? <Text style={styles.text}>Reference: {pay.reference}</Text> : null}
        {asking === 'dispute' ? (
          <>
            <TextInput value={note} onChangeText={setNote} placeholder="What's wrong? e.g. not received yet" maxLength={300} style={styles.input} />
            <View style={styles.row}>
              <OutlineButton title="Back" onPress={() => setAsking(null)} style={styles.half} />
              <PrimaryButton title="Tell the shop" loading={busy === 'dispute'} disabled={!note.trim()} onPress={() => run('dispute', () => disputeSellPayout(sellOrderId, note.trim()), 'The shop has been told')} style={[styles.half, styles.red]} />
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <OutlineButton title="Not received" onPress={() => setAsking('dispute')} style={styles.half} />
            <PrimaryButton title="Yes, received" loading={busy === 'confirm'} style={styles.half} onPress={async () => {
              if (await confirm({ title: 'Payment received?', message: `Confirm ${inr(pay.amount)} reached your account. This can't be undone.`, confirmText: 'Received' })) {
                run('confirm', () => confirmSellPayout(sellOrderId), 'Payment confirmed');
              }
            }} />
          </View>
        )}
      </Card>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  card: { borderColor: '#F3BF23', borderWidth: 1, borderRadius: 14, padding: 12, marginVertical: 4, backgroundColor: '#FFFBEA' },
  title: { fontSize: rf(13.5), fontWeight: '800', color: '#1E1E1E' },
  big: { fontSize: rf(20), fontWeight: '800', color: '#078F23', marginTop: 4 },
  text: { fontSize: rf(12), color: '#1E1E1E', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, backgroundColor: '#FFFFFF', fontSize: rf(13) },
  row: { flexDirection: 'row', marginTop: 12, gap: 10 },
  half: { flex: 1 },
  red: { backgroundColor: '#F84141', borderColor: '#F84141' },
});
