import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Card, Loader, PrimaryButton, OutlineButton } from '../../../components/ui';
import { getSellOrder, cancelSellOrder, getSellOrderQuotations } from '../../../api/orders';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions, getDeviceCategories } from '../../../api/masterData';
import { listAddresses } from '../../../api/customer';
import { confirm, notify } from '../../../components/confirm';
import { rf, rlh } from '../../../utils/responsive';
import { splitTypedSummary } from '../../../utils/typedDevice';
import { sellProgress } from '../../../utils/sellStatus';
import { goToTab } from '../../../navigation/goToTab';

const GREEN = '#09AD2A';
const GREEN_TEXT = '#078F23';
const INK = '#1E1E1E';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const RED = '#F84141';

const cardBase = { borderColor: LINE, borderWidth: 1, borderRadius: 14, padding: 11, marginVertical: 4, shadowColor: INK, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 };
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  card: cardBase,
  body: { flexDirection: 'row' },
  modelName: { fontSize: rf(14.5), fontWeight: '800', color: INK },
  small: { fontSize: rf(11.5), color: '#555555', marginTop: 2 },
  thumb: { width: 62, height: 70, borderRadius: 10, backgroundColor: '#F3F3F3', marginLeft: 10 },
  photoHeading: { fontSize: rf(12), fontWeight: '800', color: INK, marginTop: 8, marginBottom: 6 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  photoItem: { width: 76, marginHorizontal: 3, marginBottom: 5 },
  photoBox: { width: '100%', height: 70, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(9,173,42,0.45)', overflow: 'hidden', backgroundColor: '#F4FBF5' },
  photoLabel: { fontSize: rf(10), color: colors.textSecondary, textAlign: 'center', marginTop: 3, fontWeight: '600' },
  heading: { fontSize: rf(13.5), fontWeight: '800', color: INK, marginBottom: 6 },
  subHeading: { fontSize: rf(12), fontWeight: '800', color: GREEN_TEXT, marginTop: 8, marginBottom: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  itemText: { marginLeft: 6, fontSize: rf(11.5), color: INK, flex: 1, lineHeight: rlh(15) },
  custRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 },
  custText: { marginLeft: 8, fontSize: rf(12), color: INK, flex: 1, lineHeight: rlh(16) },
  actionBar: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#fff' },
  cancelBtn: { backgroundColor: RED },
  statusBanner: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FEF6DA', borderRadius: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
  statusBannerText: { color: INK, fontWeight: '700', marginLeft: 6, fontSize: rf(12), flex: 1 },
  orderLabel: { fontSize: rf(9.5), color: MUTED, fontWeight: '700', letterSpacing: 1.2 },
  orderNumber: { fontSize: rf(15), fontWeight: '800', color: INK, marginTop: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 8 },
  statusPillText: { fontWeight: '800', fontSize: rf(10) },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  key: { flex: 1, fontSize: rf(11.5), color: MUTED },
  val: { fontSize: rf(12), color: INK, fontWeight: '700', textAlign: 'right', flexShrink: 1, marginLeft: 8 },
  total: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: LINE },
  note: { marginTop: 8, fontSize: rf(11.5), color: MUTED, lineHeight: rlh(15) },
  quoteBtn: { marginTop: 10, height: 42, borderRadius: 12, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  quoteBtnText: { color: '#fff', fontWeight: '800', fontSize: rf(13), marginHorizontal: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 12, marginVertical: 2 },
  stepText: { fontSize: rf(12), fontWeight: '700' },
  stepTime: { fontSize: rf(10), color: MUTED, marginTop: 1 },
  collapseHead: { flexDirection: 'row', alignItems: 'center' },
});

const PHOTO_SLOTS = [
  { key: 'front', label: 'Front side' },
  { key: 'back', label: 'Back side' },
  { key: 'side', label: 'Side' },
  { key: 'camera', label: 'Camera' },
  { key: 'other', label: 'Other' },
];

const WARRANTY_LABELS = {
  lt_3: 'Less than 3 months',
  '3_6': '3 - 6 months',
  '6_11': '6 - 11 months',
  gt_11: 'More than 11 months',
};

const TONE = {
  green: { bg: '#EAF8EC', fg: GREEN_TEXT },
  blue: { bg: 'rgba(30,30,30,0.06)', fg: INK },
  orange: { bg: '#FEF6DA', fg: INK },
  red: { bg: '#FEECEC', fg: RED },
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const when = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null);
const humanize = (s) => String(s || '').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function Check() {
  return <Ionicons name="checkmark-circle-outline" size={15} color={GREEN_TEXT} style={{ marginTop: 1 }} />;
}

function KV({ k, v, strong }) {
  if (v == null || v === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{k}</Text>
      <Text style={[styles.val, strong ? { color: GREEN_TEXT, fontSize: rf(13) } : null]}>{v}</Text>
    </View>
  );
}

async function confirmDestructive(title, message, onConfirm, confirmLabel = 'Confirm') {
  const ok = await confirm({ title, message, confirmText: confirmLabel, destructive: true });
  if (ok) onConfirm();
}

export default function SellOrderDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const id = route.params?.sellOrderId || route.params?.id;
  const [order, setOrder] = useState(null);
  const [meta, setMeta] = useState({});
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showInspection, setShowInspection] = useState(false);
  // Quotations shops sent for this order (real backend rows).
  const [quotes, setQuotes] = useState([]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (!id) throw new Error('This sell order link is missing its id.');
        const so = await getSellOrder(id);
        if (cancelled) return;
        if (!so) throw new Error('Sell order not found.');
        setOrder(so);
        const q = Array.isArray(so.quotations) ? so.quotations : await getSellOrderQuotations(id).catch(() => []);
        if (cancelled) return;
        setQuotes(q || []);

        const [models, rams, storages, brands, addresses, categories] = await Promise.all([
          so.brandId ? getModelsByBrand(so.brandId).catch(() => []) : Promise.resolve([]),
          getRamOptions().catch(() => []),
          getStorageOptions().catch(() => []),
          getBrands().catch(() => []),
          listAddresses().catch(() => []),
          getDeviceCategories().catch(() => []),
        ]);
        if (cancelled) return;
        const model = (models || []).find((m) => m.id === so.modelId);
        const brand = (brands || []).find((b) => b.id === so.brandId);
        const ram = (rams || []).find((r) => r.id === so.ramOptionId);
        const storage = (storages || []).find((s) => s.id === so.storageOptionId);
        // An "Other" (typed) device has no catalogue model — its name rides in
        // the condition summary.
        const typed = splitTypedSummary(so.deviceConditionSummary);
        // Resolve the device category so Edit can re-enter the wizard at the
        // brand step scoped to the right category (Mobile / Laptop / etc).
        const category = model?.categoryId
          ? (categories || []).find((c) => c.id === model.categoryId)
          : null;
        setMeta({
          modelName: model?.name || so.modelName || typed.name || (brand?.name ? `${brand.name} device` : 'Device'),
          brandName: brand?.name || null,
          image: model?.imageUrl || (model?.imageBase64 ? `data:image/png;base64,${model.imageBase64}` : null),
          ramLabel: ram?.label || so.ramLabel || undefined,
          storageLabel: storage?.label || so.storageLabel || ((ram || so.ramLabel) ? undefined : typed.specs) || undefined,
          categoryId: category?.id || null,
          categoryName: category?.name || null,
          categoryCode: (category?.code || '').toUpperCase() || null,
          // Existing selections threaded through the wizard as "hints" so each
          // selection screen highlights the customer's current choice.
          editHints: {
            brandId: so.brandId,
            brandName: brand?.name || null,
            seriesId: model?.seriesId || null,
            modelId: so.modelId,
            modelName: model?.name || so.modelName || typed.name || null,
            ramOptionId: so.ramOptionId,
            storageOptionId: so.storageOptionId,
            color: so.color || null,
            imei: so.imei || null,
            workingCondition: so.workingCondition || null,
            // Assessment data so the screening / condition / functional /
            // accessories / images screens can pre-fill the customer's prior
            // answers when re-walking the wizard in edit mode.
            screeningAnswers: so.screeningAnswers || [],
            conditions: so.conditions || [],
            issues: so.issues || [],
            accessories: so.accessories || [],
            warrantyCode: so.warrantyCode || null,
            deviceConditionSummary: typed.condition || null,
            images: so.images || {},
          },
        });
        setAddress(so.addressId ? (addresses || []).find((a) => a.id === so.addressId) || null : null);
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(e?.status === 404 ? 'This sell order no longer exists.' : (e?.message || 'Could not load this sell order.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, reloadKey]));

  const onEdit = () => {
    // Re-walk the full sell wizard, starting at the brand step. Every
    // downstream screen forwards `editSellOrderId`; SellCompleteScreen reads
    // it and calls PUT /sell-orders/:id instead of POST.
    if (meta.categoryId) {
      navigation.navigate('SelectBrand', {
        flow: 'SELL',
        categoryId: meta.categoryId,
        categoryName: meta.categoryName,
        categoryCode: meta.categoryCode,
        editSellOrderId: id,
        editHints: meta.editHints,
      });
    } else {
      // The model has no categoryId yet — let the customer pick the category
      // manually as a fallback.
      navigation.navigate('SelectCategory', { flow: 'SELL', editSellOrderId: id, editHints: meta.editHints });
    }
  };

  const onCancel = () => {
    confirmDestructive(
      'Cancel sell order?',
      'This will withdraw your sell request. You can submit a new one anytime.',
      async () => {
        setCancelling(true);
        try {
          await cancelSellOrder(id);
          notify('Cancelled', 'Your sell order has been cancelled.', { preset: 'done' });
          navigation.goBack();
        } catch (e) {
          const msg = e?.message || 'Could not cancel this sell order.';
          notify('Error', msg, { preset: 'error', haptic: 'error' });
        } finally {
          setCancelling(false);
        }
      },
      'Yes, cancel',
    );
  };

  if (loading && !order) return <Loader />;
  if (!order) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={34} color={RED} />
        <Text style={{ color: INK, fontWeight: '800', fontSize: rf(14), marginTop: 8 }}>Couldn't load this sell order</Text>
        <Text style={{ color: MUTED, fontSize: rf(12), marginTop: 4, textAlign: 'center' }}>{error || 'Please try again.'}</Text>
        <OutlineButton title="Retry" onPress={() => setReloadKey((k) => k + 1)} style={{ marginTop: 14, minWidth: 140, borderColor: GREEN }} />
      </View>
    );
  }

  const prog = sellProgress(order, quotes);
  const tone = TONE[prog.tone] || TONE.blue;
  const images = order.images || {};
  const photos = PHOTO_SLOTS.filter((s) => images[s.key]);
  const storageLine = [meta.ramLabel, meta.storageLabel].filter(Boolean).join(' / ');
  const conditionText = splitTypedSummary(order.deviceConditionSummary).condition || (order.workingCondition === 'DEAD' ? 'Not powering on' : order.workingCondition ? humanize(order.workingCondition) : null);
  const warrantyLabel = WARRANTY_LABELS[order.warrantyCode] || order.warrantyCode;
  const phone = address?.mobile ? (String(address.mobile).startsWith('+') ? address.mobile : `+91 ${address.mobile}`) : '';
  const shop = prog.chosenQuote;
  const shopPhone = shop?.shopPhone;
  const { price, payment, pickup } = prog;
  const deductionTotal = price.deductions.reduce((n, d) => n + Number(d.amount), 0);
  const inferredAdjustment = price.final != null && price.quoted != null && !price.deductions.length && price.final !== price.quoted ? price.final - price.quoted : null;
  const inspectionCount = (order.screeningAnswers || []).length + (order.conditions || []).length + (order.issues || []).length + (order.accessories || []).length + (warrantyLabel ? 1 : 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {prog.cancelled ? (
          <View style={[styles.statusBanner, { backgroundColor: '#FEECEC' }]}>
            <Ionicons name="close-circle-outline" size={16} color={RED} />
            <Text style={[styles.statusBannerText, { color: RED }]}>This sell order has been cancelled.</Text>
          </View>
        ) : prog.sold ? (
          <View style={[styles.statusBanner, { backgroundColor: '#EAF8EC' }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={GREEN_TEXT} />
            <Text style={[styles.statusBannerText, { color: GREEN_TEXT }]}>Selling completed{price.final != null ? ` · ${inr(price.final)}` : ''}</Text>
          </View>
        ) : prog.next ? (
          <View style={styles.statusBanner}>
            <Ionicons name="time-outline" size={16} color="#F3BF23" />
            <Text style={styles.statusBannerText}>Next: {prog.next.label}</Text>
          </View>
        ) : null}

        {/* Order summary — real values from GET /sell-orders/{id}. */}
        <Card style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.orderLabel}>SELL NUMBER</Text>
              <Text style={styles.orderNumber} numberOfLines={1}>{order.sellNumber ? `#${String(order.sellNumber).replace(/^#+/, '')}` : '-'}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusPillText, { color: tone.fg }]}>{prog.label.toUpperCase()}</Text>
            </View>
          </View>
          <KV k="Created" v={when(order.createdAt)} />
          <KV k="Quotations" v={prog.quotes.length ? String(prog.quotes.length) : 'None yet'} />
          {prog.quotes.length && !prog.cancelled ? (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('SellQuotation', { sellOrderId: id })} style={styles.quoteBtn}>
              <Ionicons name="pricetags-outline" size={17} color="#fff" />
              <Text style={styles.quoteBtnText}>{prog.step < 3 ? `Compare & accept offer (${prog.quotes.length})` : `View Quotations (${prog.quotes.length})`}</Text>
              <Ionicons name="chevron-forward" size={17} color="#fff" />
            </TouchableOpacity>
          ) : !prog.cancelled ? (
            <Text style={styles.note}>No quotations yet — shops near you will send offers here.</Text>
          ) : null}
        </Card>

        {/* Progress timeline */}
        <Card style={styles.card}>
          <Text style={styles.heading}>Order Progress</Text>
          {prog.steps.map((s, i) => {
            const current = !prog.cancelled && !prog.sold && i === prog.step + 1;
            const last = i === prog.steps.length - 1;
            const dotBg = s.done ? GREEN : current ? '#FEF6DA' : '#F3F3F3';
            return (
              <View key={s.key} style={styles.stepRow}>
                <View style={{ alignItems: 'center', width: 24 }}>
                  <View style={[styles.stepDot, { backgroundColor: dotBg, borderWidth: current ? 1.5 : 0, borderColor: '#F3BF23' }]}>
                    {s.done ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={{ fontSize: rf(9), fontWeight: '800', color: MUTED }}>{i + 1}</Text>}
                  </View>
                  {!last ? <View style={[styles.stepLine, { backgroundColor: s.done && prog.steps[i + 1].done ? GREEN : LINE }]} /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: 8, paddingBottom: last ? 0 : 8 }}>
                  <Text style={[styles.stepText, { color: s.done || current ? INK : MUTED }]}>{s.label}{current ? '  ·  In progress' : ''}</Text>
                  {s.at ? <Text style={styles.stepTime}>{when(s.at)}</Text> : null}
                </View>
              </View>
            );
          })}
          {prog.cancelled ? <Text style={[styles.note, { color: RED }]}>Cancelled{when(order.cancelledAt) ? ` on ${when(order.cancelledAt)}` : ''}.</Text> : null}
        </Card>

        {/* Device */}
        <Card style={styles.card}>
          <View style={styles.body}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modelName}>{meta.modelName}</Text>
              {meta.brandName ? <Text style={styles.small}>Brand: {meta.brandName}</Text> : null}
              {meta.categoryName ? <Text style={styles.small}>Category: {meta.categoryName}</Text> : null}
              {order.color ? <Text style={styles.small}>Color: {order.color}</Text> : null}
              {storageLine ? <Text style={styles.small}>Storage: {storageLine}</Text> : null}
              {conditionText ? <Text style={styles.small}>Condition: {conditionText}</Text> : null}
              {order.imei ? <Text style={styles.small}>IMEI: {order.imei}</Text> : null}
            </View>
            {meta.image ? <Image source={{ uri: meta.image }} style={styles.thumb} resizeMode="contain" /> : <View style={styles.thumb} />}
          </View>

          {photos.length ? (
            <>
              <Text style={styles.photoHeading}>Device Photos</Text>
              <View style={styles.photoRow}>
                {photos.map((s) => (
                  <View key={s.key} style={styles.photoItem}>
                    <View style={styles.photoBox}>
                      <Image source={{ uri: images[s.key] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                    <Text style={styles.photoLabel} numberOfLines={1}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </Card>

        {/* Price breakdown — only values the backend returned. */}
        <Card style={styles.card}>
          <Text style={styles.heading}>Price Breakdown</Text>
          {price.quoted == null && price.bestQuote == null ? (
            <Text style={styles.note}>Awaiting quotation from shops.</Text>
          ) : (
            <>
              {price.quoted == null ? <KV k="Best quote received" v={inr(price.bestQuote)} /> : <KV k="Accepted offer" v={inr(price.quoted)} />}
              {price.deductions.map((d, i) => <KV key={i} k={d.label || d.reason || 'Deduction'} v={`− ${inr(d.amount)}`} />)}
              {inferredAdjustment != null ? <KV k="Adjustment after inspection" v={`${inferredAdjustment < 0 ? '− ' : '+ '}${inr(Math.abs(inferredAdjustment))}`} /> : null}
              <View style={styles.total}>
                <Text style={[styles.key, { color: INK, fontWeight: '800' }]}>Final price</Text>
                <Text style={[styles.val, { color: price.final != null ? GREEN_TEXT : MUTED, fontSize: rf(14) }]}>
                  {price.final != null ? inr(price.final) : 'Confirmed after device verification'}
                </Text>
              </View>
              {deductionTotal > 0 ? <Text style={styles.note}>Total deductions: {inr(deductionTotal)}</Text> : null}
            </>
          )}
        </Card>

        {/* Payment */}
        <Card style={styles.card}>
          <Text style={styles.heading}>Payment Details</Text>
          {payment.paid || payment.status || payment.method || payment.reference ? (
            <>
              <KV k="Status" v={payment.paid ? 'Paid' : humanize(payment.status) || 'Pending'} strong={payment.paid} />
              <KV k="Amount" v={payment.amount != null ? inr(payment.amount) : null} />
              <KV k="Method" v={payment.method ? humanize(payment.method) : null} />
              <KV k="Reference" v={payment.reference} />
              <KV k="Paid on" v={when(payment.paidAt)} />
            </>
          ) : (
            <Text style={styles.note}>{prog.cancelled ? 'No payment — this order was cancelled.' : 'Payment is made once the device is verified and the final price is confirmed.'}</Text>
          )}
        </Card>

        {/* Buyer / pickup */}
        <Card style={styles.card}>
          <Text style={styles.heading}>Pickup & Buyer Details</Text>
          {shop ? (
            <View style={styles.custRow}>
              <Ionicons name="storefront-outline" size={16} color={GREEN_TEXT} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>{[shop.shopName, shop.shopCity].filter(Boolean).join(', ') || 'Buyer shop assigned'}{shopPhone ? `  |  ${shopPhone}` : ''}</Text>
            </View>
          ) : (
            <Text style={styles.note}>{prog.cancelled ? 'No buyer — this order was cancelled.' : 'The buyer is assigned once you accept an offer.'}</Text>
          )}
          {pickup.name || pickup.phone ? (
            <View style={styles.custRow}>
              <Ionicons name="bicycle-outline" size={16} color={GREEN_TEXT} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>Pickup by {[pickup.name, pickup.phone].filter(Boolean).join('  |  ')}</Text>
            </View>
          ) : null}
          {pickup.date || pickup.slot ? (
            <View style={styles.custRow}>
              <Ionicons name="calendar-outline" size={16} color={GREEN_TEXT} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>{[pickup.date ? new Date(pickup.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null, pickup.slot].filter(Boolean).join('  ·  ')}</Text>
            </View>
          ) : null}
          {address ? (
            <>
              <Text style={styles.subHeading}>Pickup address</Text>
              <View style={styles.custRow}>
                <Ionicons name="person-outline" size={16} color={GREEN_TEXT} style={{ marginTop: 1 }} />
                <Text style={styles.custText}>{[address.fullName, phone].filter(Boolean).join('  |  ')}</Text>
              </View>
              <View style={styles.custRow}>
                <Ionicons name="location-outline" size={16} color={GREEN_TEXT} style={{ marginTop: 1 }} />
                <Text style={styles.custText}>{[address.addressLine, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</Text>
              </View>
            </>
          ) : null}
        </Card>

        {/* Inspection summary — the customer's own evaluation, collapsible. */}
        {inspectionCount ? (
          <Card style={styles.card}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowInspection((v) => !v)} style={styles.collapseHead} accessibilityRole="button" accessibilityLabel="Inspection summary">
              <Text style={[styles.heading, { flex: 1, marginBottom: 0 }]}>Inspection Summary</Text>
              <Text style={{ color: MUTED, fontSize: rf(11), marginRight: 4 }}>{inspectionCount} item{inspectionCount === 1 ? '' : 's'}</Text>
              <Ionicons name={showInspection ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
            </TouchableOpacity>
            {showInspection ? (
              <>
                {(order.screeningAnswers || []).length ? (
                  <>
                    <Text style={styles.subHeading}>Screening</Text>
                    {order.screeningAnswers.map((a, i) => (
                      <View key={i} style={styles.itemRow}><Check /><Text style={styles.itemText}>{[a.question, a.answer].filter(Boolean).join(' — ')}</Text></View>
                    ))}
                  </>
                ) : null}
                {(order.conditions || []).length ? (
                  <>
                    <Text style={styles.subHeading}>Condition</Text>
                    {order.conditions.map((c, i) => (
                      <View key={i} style={styles.itemRow}><Check /><Text style={styles.itemText}>{[c.groupName, c.optionLabel].filter(Boolean).join(' — ')}</Text></View>
                    ))}
                  </>
                ) : null}
                {(order.issues || []).length ? (
                  <>
                    <Text style={styles.subHeading}>Functional issues</Text>
                    {order.issues.map((it, i) => (
                      <View key={i} style={styles.itemRow}>
                        <Ionicons name="alert-circle-outline" size={15} color="#F3BF23" style={{ marginTop: 1 }} />
                        <Text style={styles.itemText}>{it.label || it.issueName || it.name || humanize(it.issueCode) || 'Issue'}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
                {(order.accessories || []).length ? (
                  <>
                    <Text style={styles.subHeading}>Accessories</Text>
                    {order.accessories.map((a, i) => (
                      <View key={i} style={styles.itemRow}><Check /><Text style={styles.itemText}>{a.label || humanize(a.accessoryCode)}</Text></View>
                    ))}
                  </>
                ) : null}
                {warrantyLabel ? (
                  <>
                    <Text style={styles.subHeading}>Warranty</Text>
                    <View style={styles.itemRow}><Check /><Text style={styles.itemText}>{warrantyLabel}</Text></View>
                  </>
                ) : null}
              </>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {/* Status-based actions */}
      {prog.editable ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <OutlineButton title="Edit" onPress={onEdit} style={{ flex: 1, marginRight: 6, borderColor: GREEN }} />
          <PrimaryButton
            title={cancelling ? 'Cancelling...' : 'Cancel Order'}
            onPress={onCancel}
            loading={cancelling}
            disabled={cancelling}
            style={[{ flex: 1, marginLeft: 6 }, styles.cancelBtn]}
          />
        </View>
      ) : prog.sold || prog.cancelled ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <PrimaryButton title={prog.sold ? 'Sell another device' : 'Sell again'} onPress={() => goToTab(navigation, 'Sell')} style={{ flex: 1 }} />
        </View>
      ) : order.shopId ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          {shopPhone ? <OutlineButton title="Call shop" onPress={() => Linking.openURL(`tel:${String(shopPhone).replace(/\s+/g, '')}`)} style={{ flex: 1, marginRight: 6, borderColor: GREEN }} /> : null}
          <PrimaryButton title="Chat with shop" onPress={() => navigation.navigate('ShopChat', { shopId: order.shopId })} style={{ flex: 1, marginLeft: shopPhone ? 6 : 0 }} />
        </View>
      ) : null}
    </View>
  );
}
