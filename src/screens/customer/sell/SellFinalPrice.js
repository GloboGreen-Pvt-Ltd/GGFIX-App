import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle, BadgeCheck, MessageSquare, X, Clock } from 'lucide-react-native';
import { getSellPurchase, approveSellRevision, rejectSellRevision, negotiateSellRevision, listSellOrders, getSellOrderQuotations } from '../../../api/orders';
import { getModelsByBrand } from '../../../api/masterData';
import { notify } from '../../../components/confirm';
import { rf, rlh } from '../../../utils/responsive';

// Final price after inspection (Partner purchase workflow). The shop's revised
// price waits for the customer — at the shop (status PRICE_REVISION_PENDING) or
// at the door (OUT_FOR_PICKUP with revision SHOP_APPROVED); either way the
// purchase view (GET /sell-orders/{id}/purchase) offers APPROVE_REVISION. The
// customer accepts (…/revision/approve, payment unlocks), rejects
// (…/revision/reject) or negotiates (…/revision/negotiate when the server lists
// NEGOTIATE_REVISION, else a "Counter offer" rejection note); payment stays
// blocked until the shop answers. All values are the server's.
const TEAL = '#035C6C';
const RED = '#F32C26';
const GOLD = '#FAA700';
const INK = '#111111';
const MUTED = 'rgba(17,17,17,0.55)';
const LINE = '#F3F4F6';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const num = (v) => (v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const CHECK_LABEL = {
  display: 'Display', touch: 'Touch', cameras: 'Cameras', speakerMic: 'Speaker / Mic',
  charging: 'Charging', buttons: 'Buttons', connectivity: 'Connectivity', biometrics: 'Biometrics',
};

// A counter offer reads back from the revision note — "Asks ₹N: …" (negotiate
// endpoint) or "Counter offer: ₹N · …" (rejection note on servers without it) —
// so it shows as a negotiation, not a plain rejection.
const COUNTER_RE = /^(?:Counter offer: |Asks )₹([\d,]+)/;

/** 'pending' (customer must answer), 'waiting' (rejected / negotiating, shop to answer) or null. */
export function finalPriceState(purchase) {
  const rev = purchase?.revision;
  if (!rev) return null;
  if ((purchase.allowedActions || []).includes('APPROVE_REVISION')) return 'pending';
  const status = String(purchase.status || '').toUpperCase();
  const revStatus = String(rev.status || '').toUpperCase();
  if (status === 'REVISION_REJECTED') return 'waiting';
  if (status === 'OUT_FOR_PICKUP' && (revStatus === 'REJECTED' || revStatus === 'NEGOTIATION')) return 'waiting';
  return null;
}
export const counterOffer = (note) => { const m = COUNTER_RE.exec(String(note || '')); return m ? Number(m[1].replace(/,/g, '')) : null; };

/** Inspection findings that explain a lower price: failed checks, model mismatch, graded condition. */
export function inspectionFindings(inspection) {
  if (!inspection) return [];
  const out = [];
  if (inspection.modelVerified === false) out.push('Model does not match the listing');
  Object.entries(inspection.checks || {}).forEach(([k, ok]) => { if (ok === false) out.push(`${CHECK_LABEL[k] || k} not working`); });
  if (inspection.condition) out.push(`Condition graded: ${inspection.condition}`);
  return out;
}

/**
 * The final price request body: original quote vs final offer, why it changed,
 * inspection photos and Accept / Reject / Negotiate. `purchase` is the
 * GET /sell-orders/{id}/purchase view; `onDone` reloads the caller.
 */
export function FinalPriceRequest({ sellOrderId, purchase, onDone }) {
  const [mode, setMode] = useState(null); // 'reject' | 'negotiate' while typing a note
  const [note, setNote] = useState('');
  const [counter, setCounter] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null); // { message, retry } after a failed save
  const [responded, setResponded] = useState(false); // answered elsewhere (server 409)
  const lock = useRef(false);
  const rev = purchase?.revision;
  const state = finalPriceState(purchase);
  if (!state) return null;

  const original = num(purchase.finalPrice);
  const offer = num(rev.amount);
  const findings = inspectionFindings(purchase.inspection);
  const photos = (purchase.inspection?.photos || []).filter((u) => typeof u === 'string' && /^https?:/i.test(u));
  const pending = state === 'pending';
  const negotiating = String(rev.status || '').toUpperCase() === 'NEGOTIATION' || !!counterOffer(rev.note);

  const run = async (kind, fn, okTitle, okBody) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    setError(null);
    try {
      await fn();
      notify(okTitle, okBody, { type: 'success' });
      setMode(null);
      onDone?.();
    } catch (e) {
      if (e?.status === 409) {
        // Already answered (another device, or the shop moved on): say so and refresh.
        setResponded(true);
        onDone?.();
      } else {
        setError({ message: e?.message || 'Could not save your answer. Check your connection.', retry: () => run(kind, fn, okTitle, okBody) });
      }
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  const accept = () => run('accept', () => approveSellRevision(sellOrderId), 'Final price accepted', `${offer ? inr(offer) : 'The final price'} is confirmed. The shop will pay you next.`);
  const sendNote = () => {
    const c = num(String(counter).replace(/[^\d.]/g, ''));
    if (mode === 'negotiate' && !c) { notify('Enter your price', 'Type the amount you want for the device.', { type: 'info' }); return; }
    const okBody = 'The shop has been notified. Payment stays on hold until you both agree.';
    if (mode === 'reject') return run('reject', () => rejectSellRevision(sellOrderId, note.trim()), 'Final price rejected', okBody);
    // Negotiate: the real endpoint when the server offers it, else a counter-offer rejection note.
    const call = (purchase.allowedActions || []).includes('NEGOTIATE_REVISION')
      ? () => negotiateSellRevision(sellOrderId, { amount: c, note: note.trim() })
      : () => rejectSellRevision(sellOrderId, [`Counter offer: ${inr(c)}`, note.trim()].filter(Boolean).join(' · '));
    return run('negotiate', call, 'Counter offer sent', okBody);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, borderRadius: 12, padding: 10, backgroundColor: LINE }}>
          <Text style={{ fontSize: rf(11.5), color: MUTED }}>Original Quote</Text>
          <Text style={{ marginTop: 2, fontSize: rf(18), fontWeight: '800', color: INK, textDecorationLine: offer ? 'line-through' : 'none' }}>{original ? inr(original) : '—'}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 12, padding: 10, backgroundColor: 'rgba(3,92,108,0.10)' }}>
          <Text style={{ fontSize: rf(11.5), color: TEAL }}>Final Offer</Text>
          <Text style={{ marginTop: 2, fontSize: rf(18), fontWeight: '800', color: TEAL }}>{offer ? inr(offer) : '—'}</Text>
        </View>
      </View>

      <Text style={{ marginTop: 12, fontSize: rf(14), fontWeight: '800', color: INK }}>Why has the price changed?</Text>
      {rev.reason ? <Text style={{ marginTop: 4, fontSize: rf(12.5), lineHeight: rlh(17), color: INK }}>{rev.reason}</Text> : null}
      {findings.map((f) => (
        <View key={f} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <AlertTriangle size={15} color={GOLD} />
          <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), color: INK }}>{f}</Text>
        </View>
      ))}
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {photos.map((u) => (
            <Image key={u} source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 10, marginRight: 8, backgroundColor: LINE }} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : null}

      {responded ? (
        <View style={{ flexDirection: 'row', marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: LINE }}>
          <BadgeCheck size={16} color={TEAL} />
          <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), lineHeight: rlh(17), color: INK }}>This final price request was already answered. Refreshing…</Text>
        </View>
      ) : !pending ? (
        // Countered or rejected: the order stays open and payment stays on hold
        // until the shop answers — a negotiation is not a cancellation.
        <View style={{ flexDirection: 'row', marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: 'rgba(250,167,0,0.14)' }}>
          <Clock size={16} color={INK} />
          <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), lineHeight: rlh(17), color: INK }}>
            {negotiating
              ? `${counterOffer(rev.note) ? `Counter offer ${inr(counterOffer(rev.note))}` : 'Your negotiation request'} sent. Waiting for the shop to reply: it can send a new price, keep the original quote or cancel. Payment stays on hold.`
              : `You rejected this price${rev.note ? ` (${rev.note})` : ''}. Waiting for the shop to keep the original quote, send a new price or cancel. Payment stays on hold.`}
          </Text>
        </View>
      ) : mode ? (
        <View style={{ marginTop: 12 }}>
          {mode === 'negotiate' ? (
            <TextInput
              value={counter}
              onChangeText={setCounter}
              keyboardType="number-pad"
              placeholder="Your price (₹)"
              placeholderTextColor={MUTED}
              style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E8EAEE', paddingHorizontal: 12, fontSize: rf(14), color: INK, marginBottom: 8 }}
            />
          ) : null}
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={mode === 'negotiate' ? 'Message to the shop (optional)' : 'Why are you rejecting? (optional)'}
            placeholderTextColor={MUTED}
            multiline
            maxLength={400}
            style={{ minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: '#E8EAEE', padding: 12, fontSize: rf(13), color: INK, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Pressable onPress={() => setMode(null)} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#E8EAEE', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: INK }}>Back</Text>
            </Pressable>
            <Pressable onPress={sendNote} disabled={!!busy} accessibilityRole="button" style={{ flex: 1.4, height: 46, borderRadius: 12, backgroundColor: mode === 'negotiate' ? TEAL : RED, alignItems: 'center', justifyContent: 'center' }}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#FFFFFF' }}>{mode === 'negotiate' ? 'Send Counter Offer' : 'Reject Price'}</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          <Pressable onPress={accept} disabled={!!busy} accessibilityRole="button" style={{ height: 50, borderRadius: 14, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {busy === 'accept' ? <ActivityIndicator color="#FFFFFF" /> : <BadgeCheck size={18} color="#FFFFFF" />}
            <Text style={{ marginLeft: 8, fontSize: rf(15), fontWeight: '800', color: '#FFFFFF' }}>Accept {offer ? inr(offer) : 'Final Price'}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Pressable onPress={() => setMode('reject')} disabled={!!busy} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(243,44,38,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color={RED} />
              <Text style={{ marginLeft: 6, fontSize: rf(14), fontWeight: '800', color: RED }}>Reject</Text>
            </Pressable>
            <Pressable onPress={() => setMode('negotiate')} disabled={!!busy} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(3,92,108,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={16} color={TEAL} />
              <Text style={{ marginLeft: 6, fontSize: rf(14), fontWeight: '800', color: TEAL }}>Negotiate</Text>
            </Pressable>
          </View>
        </View>
      )}
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(243,44,38,0.10)' }}>
          <Text style={{ flex: 1, fontSize: rf(12.5), color: RED }}>{error.message}</Text>
          <Pressable onPress={error.retry} disabled={!!busy} hitSlop={8} accessibilityRole="button" style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: TEAL }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Inline card for Sell Device Details / Sell Order Details. */
export function FinalPriceCard({ sellOrderId, purchase, orderStatus, onDone, onOpen, style }) {
  const state = finalPriceState(purchase);
  // The order waits on a final price but its details didn't load: say so, with a retry.
  if (!purchase && /^(PRICE_REVISION_PENDING|REVISION_REJECTED)$/.test(String(orderStatus || '').toUpperCase())) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,44,38,0.30)', padding: 12, marginVertical: 5 }, style]}>
        <Text style={{ flex: 1, fontSize: rf(13), color: INK }}>Couldn't load the shop's final price request.</Text>
        <Pressable onPress={onDone} hitSlop={8} accessibilityRole="button" style={{ marginLeft: 8 }}>
          <Text style={{ fontSize: rf(13), fontWeight: '800', color: TEAL }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (!state) return null;
  const negotiating = String(purchase.revision.status || '').toUpperCase() === 'NEGOTIATION' || !!counterOffer(purchase.revision.note);
  return (
    <View style={[{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(250,167,0,0.45)', padding: 12, marginVertical: 5 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: INK }}>Inspection Result</Text>
        {onOpen ? (
          <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button" style={{ marginRight: 8 }}>
            <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: TEAL }}>Open</Text>
          </Pressable>
        ) : null}
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: state === 'pending' ? 'rgba(243,44,38,0.10)' : 'rgba(250,167,0,0.14)' }}>
          <Text style={{ fontSize: rf(11), fontWeight: '800', color: state === 'pending' ? RED : INK }}>{state === 'pending' ? 'Action Required' : negotiating ? 'Counter offer sent' : 'Waiting for shop'}</Text>
        </View>
      </View>
      <FinalPriceRequest sellOrderId={sellOrderId} purchase={purchase} onDone={onDone} />
    </View>
  );
}

// ---- Home popup ----
// The customer's sell orders waiting on a final price decision, straight from
// the server (re-checked on Home focus and when the app returns to the
// foreground, so a restart or a tapped push shows it again). "Later" hides an
// order's request for this app session only.
const later = new Set();

async function loadPendingRequest() {
  const orders = (await listSellOrders().catch(() => [])) || [];
  const waiting = orders.filter((o) => /^(PRICE_REVISION_PENDING|OUT_FOR_PICKUP)$/.test(String(o.status || '').toUpperCase()) && !later.has(o.id));
  for (const o of waiting) {
    const purchase = await getSellPurchase(o.id).catch(() => null);
    if (finalPriceState(purchase) !== 'pending') continue;
    const [models, quotes] = await Promise.all([
      o.brandId ? getModelsByBrand(o.brandId).catch(() => []) : Promise.resolve([]),
      Array.isArray(o.quotations) ? Promise.resolve(o.quotations) : getSellOrderQuotations(o.id).catch(() => []),
    ]);
    const model = (models || []).find((m) => m.id === o.modelId);
    const shop = (quotes || []).find((q) => q.shopId && q.shopId === o.shopId);
    return {
      order: o,
      purchase,
      device: model?.name || o.modelName || 'Your device',
      image: model?.imageUrl || o.images?.front || null,
      shopName: shop?.shopName || null,
    };
  }
  return null;
}

export function SellFinalPricePopup({ navigation }) {
  const [req, setReq] = useState(null);
  const busy = useRef(false);
  const open = useRef(false); // a request is on screen
  open.current = !!req;
  const check = useCallback(async () => {
    if (busy.current || open.current) return;
    busy.current = true;
    try { setReq(await loadPendingRequest()); } finally { busy.current = false; }
  }, []);
  useFocusEffect(useCallback(() => { check(); }, [check]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  if (!req) return null;
  const o = req.order;
  const sellNo = o.sellNumber ? String(o.sellNumber).replace(/^#+/, '') : '';
  const dismiss = () => { later.add(o.id); setReq(null); };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable onPress={dismiss} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ maxHeight: '92%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(243,44,38,0.10)' }}>
                <Text style={{ fontSize: rf(11), fontWeight: '800', color: RED, letterSpacing: 0.5 }}>FINAL PRICE REQUEST</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Later">
                <X size={20} color={INK} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: LINE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {req.image ? <Image source={{ uri: req.image }} style={{ width: 48, height: 48 }} resizeMode="contain" /> : null}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text numberOfLines={1} style={{ fontSize: rf(15), fontWeight: '800', color: INK }}>{req.device}</Text>
                <Text numberOfLines={1} style={{ marginTop: 2, fontSize: rf(12), color: MUTED }}>{req.shopName || ''}</Text>
              </View>
            </View>
            <FinalPriceRequest sellOrderId={o.id} purchase={req.purchase} onDone={() => { open.current = false; setReq(null); check(); }} />
            <Pressable onPress={() => { dismiss(); navigation.navigate('SellFinalOffer', { sellOrderId: o.id }); }} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}>
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: TEAL }}>View full details</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
