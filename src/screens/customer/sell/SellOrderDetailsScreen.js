import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Modal, Share, useWindowDimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useFocusPolling } from '../../../hooks/useFocusPolling';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Card, Loader, PrimaryButton, OutlineButton } from '../../../components/ui';
import { cancelSellOrder, getSellOrderQuotations } from '../../../api/orders';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions, getDeviceCategories } from '../../../api/masterData';
import { listAddresses } from '../../../api/customer';
import { getShop } from '../../../api/shops';
import { confirm, notify } from '../../../components/confirm';
import { rf, rlh } from '../../../utils/responsive';
import { splitTypedSummary } from '../../../utils/typedDevice';
import { sellProgress } from '../../../utils/sellStatus';
import { resolveSpecCategory } from '../../../utils/deviceSpecs';
import { imeiApplies } from '../../../utils/imeiPolicy';
import { goToTab } from '../../../navigation/goToTab';
import { useSavedPickup, loadSellOrder } from './useSellOrder';
import { FinalPriceCard } from './SellFinalPrice';
import SellPickupPin from './SellPickupPin';
import SellQuotesInline from './SellQuotesInline';
import SellOrderProgress from './SellOrderProgress';
import SellPayoutConfirm from './SellPayoutConfirm';

const TEAL = '#035C6C';
const GREEN = TEAL; // brand palette only: success reads in the brand teal
const GOLD = '#FAA700';
const INK = '#111111';
const MUTED = 'rgba(17,17,17,0.55)';
const LINE = '#F3F4F6';
const RED = '#F32C26';
const TINT = 'rgba(3,92,108,0.08)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  card: { backgroundColor: '#FFFFFF', borderColor: LINE, borderWidth: 1, borderRadius: 14, padding: 12, marginVertical: 5, shadowColor: INK, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(250,167,0,0.14)', borderWidth: 1, borderColor: 'rgba(250,167,0,0.45)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 5 },
  bannerText: { flex: 1, marginLeft: 8, fontSize: rf(12.5), fontWeight: '700', color: INK },
  orderLabel: { fontSize: rf(10), color: MUTED, fontWeight: '700', letterSpacing: 1 },
  orderNumber: { fontSize: rf(16), fontWeight: '800', color: INK, flexShrink: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  pillText: { fontWeight: '800', fontSize: rf(10) },
  metaRow: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE },
  metaCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  metaIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: TINT, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  metaLabel: { fontSize: rf(10.5), color: MUTED },
  metaValue: { fontSize: rf(12.5), fontWeight: '700', color: INK, marginTop: 1 },
  quoteStrip: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(3,92,108,0.10)' },
  quoteStripText: { flex: 1, marginLeft: 8, fontSize: rf(12), fontWeight: '700', color: INK },
  quoteLink: { fontSize: rf(12), fontWeight: '800', color: GREEN },
  primaryBtn: { marginTop: 10, height: 44, borderRadius: 12, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: rf(13.5), marginHorizontal: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  heading: { flex: 1, fontSize: rf(14), fontWeight: '800', color: INK },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: TINT },
  chipText: { fontSize: rf(10.5), fontWeight: '700', color: TEAL },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 10, marginVertical: 2 },
  stepText: { flex: 1, fontSize: rf(12.5), fontWeight: '700' },
  stepTime: { fontSize: rf(10.5), color: MUTED, marginLeft: 8 },
  nowChip: { marginTop: 3, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(250,167,0,0.14)' },
  nowChipText: { fontSize: rf(10), fontWeight: '800', color: '#111111' },
  devTop: { flexDirection: 'row', alignItems: 'center' },
  devImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: TINT, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  modelName: { fontSize: rf(15), fontWeight: '800', color: INK },
  small: { fontSize: rf(11.5), color: MUTED, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: LINE },
  gridCell: { width: '50%', flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5, paddingRight: 6 },
  gridLabel: { fontSize: rf(10.5), color: MUTED },
  gridValue: { fontSize: rf(12), fontWeight: '700', color: INK, marginTop: 1 },
  link: { fontSize: rf(12), fontWeight: '800', color: TEAL },
  photo: { width: 78, marginRight: 8 },
  photoBox: { width: 78, height: 78, borderRadius: 12, borderWidth: 1, borderColor: LINE, overflow: 'hidden', backgroundColor: TINT },
  photoLabel: { fontSize: rf(10.5), color: MUTED, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  secHead: { flexDirection: 'row', alignItems: 'center' },
  secIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: TINT, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  secTitle: { flex: 1, fontSize: rf(13.5), fontWeight: '800', color: INK },
  secSummary: { fontSize: rf(12), fontWeight: '700', color: TEAL, marginHorizontal: 6, maxWidth: '45%' },
  secBody: { marginTop: 6 },
  subHeading: { fontSize: rf(12), fontWeight: '800', color: TEAL, marginTop: 8, marginBottom: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  itemText: { marginLeft: 6, fontSize: rf(11.5), color: INK, flex: 1, lineHeight: rlh(15) },
  custRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  custText: { marginLeft: 8, fontSize: rf(12), color: INK, flex: 1, lineHeight: rlh(16) },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  key: { flex: 1, fontSize: rf(11.5), color: MUTED },
  val: { fontSize: rf(12), color: INK, fontWeight: '700', textAlign: 'right', flexShrink: 1, marginLeft: 8 },
  total: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: LINE },
  note: { marginTop: 8, fontSize: rf(11.5), color: MUTED, lineHeight: rlh(15) },
  actionBar: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#FFFFFF' },
  barBtn: { flex: 1, height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  barBtnText: { fontSize: rf(14), fontWeight: '800', marginLeft: 6 },
  headCard: { backgroundColor: '#FFFFFF', borderColor: LINE, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 5, shadowColor: INK, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  smallBtn: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1.5, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: rf(12.5), fontWeight: '800', marginLeft: 6 },
  subBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE },
});

const PHOTO_SLOTS = [
  { key: 'front', label: 'Front side' },
  { key: 'back', label: 'Back side' },
  { key: 'side', label: 'Side' },
  { key: 'camera', label: 'Camera' },
  { key: 'other', label: 'Damage / Scratches' },
];

const WARRANTY_LABELS = {
  none: 'No Warranty',
  lt_3: 'Less than 3 months',
  '3_6': '3 - 6 months',
  '6_11': '6 - 11 months',
  gt_11: 'More than 11 months',
};

const TONE = {
  green: { bg: 'rgba(3,92,108,0.10)', fg: TEAL },
  blue: { bg: 'rgba(17,17,17,0.06)', fg: INK },
  orange: { bg: 'rgba(250,167,0,0.14)', fg: INK },
  red: { bg: 'rgba(243,44,38,0.10)', fg: RED },
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const when = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null);
const shortWhen = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);
// A bare "YYYY-MM-DD" (server LocalDate) is that local day, not UTC midnight.
const dateOnly = (v) => (v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T00:00:00` : v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null);
const humanize = (s) => String(s || '').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function Check() {
  return <Ionicons name="checkmark-circle-outline" size={15} color={TEAL} style={{ marginTop: 1 }} />;
}

function KV({ k, v, strong }) {
  if (v == null || v === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{k}</Text>
      <Text style={[styles.val, strong ? { color: TEAL, fontSize: rf(13) } : null]}>{v}</Text>
    </View>
  );
}

async function confirmDestructive(title, message, onConfirm, confirmLabel = 'Confirm') {
  const ok = await confirm({ title, message, confirmText: confirmLabel, destructive: true });
  if (ok) onConfirm();
}

export default function SellOrderDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const mainScroll = useRef(null);
  const progressY = useRef(0);   // Order Progress position (Track Sell Order / deep links scroll here)
  const focused = useRef(false); // footer "View Details" → back to the device details at the top
  const id = route.params?.sellOrderId || route.params?.id;
  const [order, setOrder] = useState(null);
  const [meta, setMeta] = useState({});
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  // Which compact cards are expanded, and the full-screen photo index.
  const [open, setOpen] = useState({});
  const [viewer, setViewer] = useState(null);
  const viewerRef = useRef(null);
  const { width: winW, height: winH } = useWindowDimensions();
  // Quotations shops sent for this order (real backend rows).
  const [quotes, setQuotes] = useState([]);
  // The buyer shop's profile (its phone when the quote carries none).
  const [shopInfo, setShopInfo] = useState(null);
  const savedPickup = useSavedPickup(id);
  // Live refresh (10 s): the pickup PIN appears as soon as the pickup person
  // starts the trip in the Partner App, and status changes show without reopening.
  useFocusPolling(useCallback(async () => {
    if (!id) return;
    const so = await loadSellOrder(id).catch(() => null);
    if (so) setOrder((prev) => (prev ? { ...prev, ...so } : so));
  }, [id]), 10000);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (!id) throw new Error('This sell order link is missing its id.');
        const so = await loadSellOrder(id);
        if (cancelled) return;
        if (!so) throw new Error('Sell order not found.');
        setOrder(so);
        const q = Array.isArray(so.quotations) ? so.quotations : await getSellOrderQuotations(id).catch(() => []);
        if (cancelled) return;
        setQuotes(q || []);
        if (so.shopId) getShop(so.shopId).then((sh) => { if (!cancelled) setShopInfo(sh || null); }).catch(() => {});

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
        <OutlineButton title="Retry" onPress={() => setReloadKey((k) => k + 1)} style={{ marginTop: 14, minWidth: 140, borderColor: TEAL }} />
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
  const shopPhone = shop?.shopPhone || shopInfo?.mobile || null;
  const { price, payment, pickup } = prog;
  const deductionTotal = price.deductions.reduce((n, d) => n + Number(d.amount), 0);
  const inferredAdjustment = price.final != null && price.quoted != null && !price.deductions.length && price.final !== price.quoted ? price.final - price.quoted : null;
  const inspectionCount = (order.screeningAnswers || []).length + (order.conditions || []).length + (order.issues || []).length + (order.accessories || []).length + (warrantyLabel ? 1 : 0);

  const doneCount = prog.steps.filter((s) => s.done).length;
  const sellNo = order.sellNumber ? `#${String(order.sellNumber).replace(/^#+/, '')}` : '-';
  // No clipboard module in this build — the share sheet carries "Copy".
  const copySellNo = () => { if (order.sellNumber) Share.share({ message: sellNo }).catch(() => {}); };
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const showImei = order.imei && imeiApplies(resolveSpecCategory(meta.categoryCode, meta.categoryName));
  const priceSummary = price.final != null ? inr(price.final) : price.quoted != null ? inr(price.quoted) : price.bestQuote != null ? inr(price.bestQuote) : 'Awaiting';
  const paySummary = payment.paid ? 'Paid' : prog.cancelled ? null : humanize(payment.status) || 'Pending';

  // One status line under the fixed summary (cancelled / sold / what's next).
  const statusLine = prog.cancelled
    ? { icon: 'close-circle', color: RED, text: 'This sell order has been cancelled.', box: { backgroundColor: 'rgba(243,44,38,0.10)', borderColor: 'rgba(243,44,38,0.30)' } }
    : prog.sold
      ? { icon: 'checkmark-circle', color: GREEN, text: `Selling completed${price.final != null ? ` · ${inr(price.final)}` : ''}`, box: { backgroundColor: 'rgba(3,92,108,0.10)', borderColor: 'rgba(3,92,108,0.30)' } }
      : null; // no "Next: …" banner (removed on request)

  return (
    <View style={styles.container}>
      <ScrollView ref={mainScroll} contentContainerStyle={{ padding: 12, paddingBottom: Math.max(insets.bottom, 10) + 12 }}>
        {/* Summary — real values from GET /sell-orders/{id}; scrolls with the page. */}
        <View style={styles.headCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.orderLabel}>SELL ORDER</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={styles.orderNumber} numberOfLines={1}>{order.modelName || 'Your device'}</Text>
              </View>
            </View>
            <View style={[styles.pill, { backgroundColor: tone.bg }]}>
              <Text style={[styles.pillText, { color: tone.fg }]}>{prog.label.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <MetaCell icon="calendar-outline" label="Created" value={dateOnly(order.createdAt) || '-'} />
            <MetaCell icon="pricetags-outline" label="Quotations" value={prog.quotes.length ? `${prog.quotes.length} received` : 'None yet'} />
          </View>
          {statusLine ? (
            <View style={[styles.banner, { marginTop: 10, marginBottom: 0 }, statusLine.box]}>
              <Ionicons name={statusLine.icon} size={17} color={statusLine.color} />
              <Text style={[styles.bannerText, { color: statusLine.textColor || statusLine.color }]} numberOfLines={1}>{statusLine.text}</Text>
            </View>
          ) : null}
          {/* Quotations — expand on this page (no separate screen). */}
          {prog.quotes.length && !prog.cancelled ? <SellQuotesInline sellOrderId={id} navigation={navigation} initiallyOpen={false} onTrack={() => mainScroll.current?.scrollTo({ y: Math.max(0, progressY.current - 8), animated: true })} /> : null}
          {prog.editable ? (
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity activeOpacity={0.85} onPress={onEdit} disabled={cancelling} style={[styles.smallBtn, { marginRight: 5, borderColor: TEAL }]} accessibilityRole="button">
                <Ionicons name="create-outline" size={16} color={TEAL} />
                <Text style={[styles.smallBtnText, { color: TEAL }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} onPress={onCancel} disabled={cancelling} style={[styles.smallBtn, { marginLeft: 5, borderColor: 'rgba(243,44,38,0.45)', opacity: cancelling ? 0.7 : 1 }]} accessibilityRole="button">
                <Ionicons name="trash-outline" size={16} color={RED} />
                <Text style={[styles.smallBtnText, { color: RED }]}>{cancelling ? 'Cancelling...' : 'Cancel Order'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Pickup person on the way → the PIN to share at the door (from the server). */}
        <SellPickupPin purchase={order.purchase} />

        {/* Inspection changed the price → the customer accepts / rejects / negotiates it. */}
        <FinalPriceCard sellOrderId={id} purchase={order.purchase} orderStatus={order.status} onDone={() => setReloadKey((k) => k + 1)} onOpen={() => navigation.navigate('SellFinalOffer', { sellOrderId: id })} />

        {/* Shop recorded its payout → the customer confirms receiving it. */}
        <SellPayoutConfirm sellOrderId={id} status={order.status} onConfirmed={() => setReloadKey((k) => k + 1)} />

        {/* Device photos — the customer's real uploads; tap for full screen. */}
        {photos.length ? (
          <Card style={styles.card}>
            <View style={styles.headRow}>
              <Text style={styles.heading}>Device Photos</Text>
              <TouchableOpacity onPress={() => setViewer(0)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button">
                <Text style={styles.link}>{photos.length} photo{photos.length === 1 ? '' : 's'}</Text>
                <Ionicons name="chevron-forward" size={14} color={TEAL} />
              </TouchableOpacity>
            </View>
            <PhotoCarousel photos={photos} images={images} onOpen={setViewer} />
          </Card>
        ) : null}

        {/* Device details + price breakdown (only values the backend returned). */}
        <Card style={styles.card}>
          <View style={styles.devTop}>
            {meta.image ? <Image source={{ uri: meta.image }} style={styles.devImg} resizeMode="contain" /> : <View style={styles.devImg}><Ionicons name="phone-portrait-outline" size={26} color={TEAL} /></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.modelName} numberOfLines={2}>{meta.modelName}</Text>
              <Text style={styles.small} numberOfLines={1}>{[meta.brandName, meta.categoryName].filter(Boolean).join(' · ') || 'Device'}</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <InfoCell icon="business-outline" label="Brand" value={meta.brandName} />
            <InfoCell icon="grid-outline" label="Category" value={meta.categoryName} />
            <InfoCell icon="color-palette-outline" label="Colour" value={order.color} />
            <InfoCell icon="server-outline" label="Storage" value={storageLine} />
            <InfoCell icon="shield-checkmark-outline" label="Condition" value={conditionText} />
            <InfoCell icon="phone-portrait-outline" label="Model" value={meta.modelName} />
            {showImei ? <InfoCell icon="barcode-outline" label="IMEI" value={order.imei} /> : null}
          </View>

          {price.quoted != null || price.bestQuote != null || price.final != null || payment.paid || payment.status || payment.method || payment.reference ? <View style={styles.subBlock}>
            <View style={styles.secHead}>
              <View style={styles.secIcon}><Ionicons name="cash-outline" size={16} color={TEAL} /></View>
              <Text style={styles.secTitle}>Price Breakdown</Text>
              <Text style={[styles.secSummary, price.final != null ? { color: GREEN } : null]} numberOfLines={1}>{priceSummary}</Text>
            </View>
            {price.quoted == null && price.bestQuote == null ? null : (
              <>
                {price.quoted == null ? <KV k="Best quote received" v={inr(price.bestQuote)} /> : <KV k="Accepted offer" v={inr(price.quoted)} />}
                {price.deductions.map((d, i) => <KV key={i} k={d.label || d.reason || 'Deduction'} v={`− ${inr(d.amount)}`} />)}
                {inferredAdjustment != null ? <KV k="Adjustment after inspection" v={`${inferredAdjustment < 0 ? '− ' : '+ '}${inr(Math.abs(inferredAdjustment))}`} /> : null}
                {price.final != null ? (
                  <View style={styles.total}>
                    <Text style={[styles.key, { color: INK, fontWeight: '800' }]}>Final price</Text>
                    <Text style={[styles.val, { color: GREEN, fontSize: rf(14) }]}>{inr(price.final)}</Text>
                  </View>
                ) : null}
              </>
            )}
            {/* Payment */}
            {payment.paid || payment.status || payment.method || payment.reference ? (
              <>
                <KV k="Payment" v={payment.paid ? 'Paid' : humanize(payment.status) || 'Pending'} strong={payment.paid} />
                <KV k="Amount paid" v={payment.amount != null ? inr(payment.amount) : null} />
                <KV k="Method" v={payment.method ? humanize(payment.method) : null} />
                <KV k="Reference" v={payment.reference} />
                <KV k="Paid on" v={when(payment.paidAt)} />
              </>
            ) : paySummary ? (
              <KV k="Payment" v={paySummary} />
            ) : null}
          </View> : null}
        </Card>

        {/* Pickup & buyer — the customer's own contact + address, the buyer shop, pickup person and time. */}
        <Card style={styles.card}>
          <View style={styles.secHead}>
            <View style={styles.secIcon}><Ionicons name="bicycle-outline" size={16} color={TEAL} /></View>
            <Text style={styles.secTitle}>Pickup & Buyer Details</Text>
          </View>
          {address ? (
            <>
              <View style={styles.custRow}>
                <Ionicons name="person-outline" size={16} color={TEAL} style={{ marginTop: 1 }} />
                <Text style={styles.custText}>{[address.fullName, phone].filter(Boolean).join('  |  ')}</Text>
              </View>
              <View style={styles.custRow}>
                <Ionicons name="location-outline" size={16} color={TEAL} style={{ marginTop: 1 }} />
                <Text style={styles.custText}>{[address.addressLine, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</Text>
              </View>
            </>
          ) : null}
          {shop ? (
            <View style={styles.custRow}>
              <Ionicons name="storefront-outline" size={16} color={TEAL} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>{[shop.shopName, shop.shopCity].filter(Boolean).join(', ') || 'Buyer shop assigned'}{shopPhone ? `  |  ${shopPhone}` : ''}</Text>
            </View>
          ) : (
            <Text style={styles.note}>{prog.cancelled ? 'No buyer — this order was cancelled.' : 'The buyer is assigned once you accept an offer.'}</Text>
          )}
          {pickup.name || pickup.phone ? (
            <View style={styles.custRow}>
              <Ionicons name="bicycle-outline" size={16} color={TEAL} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>Pickup by {[pickup.name, pickup.phone].filter(Boolean).join('  |  ')}</Text>
            </View>
          ) : null}
          {pickup.date || pickup.slot ? (
            <View style={styles.custRow}>
              <Ionicons name="calendar-outline" size={16} color={TEAL} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>{[dateOnly(pickup.date), pickup.slot].filter(Boolean).join('  ·  ')}</Text>
            </View>
          ) : savedPickup ? (
            <View style={styles.custRow}>
              <Ionicons name="calendar-outline" size={16} color={TEAL} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>{savedPickup.mode === 'visit' ? 'Shop visit' : 'Pickup'}: {savedPickup.label}  ·  {savedPickup.slot}</Text>
            </View>
          ) : null}
        </Card>

        {/* Inspection summary — the customer's own evaluation, collapsible. */}
        {inspectionCount ? (
          <Section icon="clipboard-outline" title="Inspection Summary" chip={`${inspectionCount} item${inspectionCount === 1 ? '' : 's'}`} open={open.inspection} onToggle={() => toggle('inspection')}>
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
                    <Ionicons name="alert-circle-outline" size={15} color={GOLD} style={{ marginTop: 1 }} />
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
          </Section>
        ) : null}

        {/* Order Progress — the former Sell Order Details / tracking screen, merged here. */}
        <SellOrderProgress sellOrderId={id} navigation={navigation} onLayout={(e) => { progressY.current = e.nativeEvent.layout.y; if (route.params?.focus === 'progress' && !focused.current) { focused.current = true; setTimeout(() => mainScroll.current?.scrollTo({ y: Math.max(0, progressY.current - 8), animated: true }), 250); } }} />

        {prog.sold || prog.cancelled ? (
          <PrimaryButton title={prog.sold ? 'Sell another device' : 'Sell again'} onPress={() => goToTab(navigation, 'Sell')} style={{ marginTop: 6 }} />
        ) : null}
      </ScrollView>

      {/* Full-screen photo view — swipe between the device photos. */}
      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.96)' }}>
          <ScrollView
            ref={viewerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewer || 0) * winW, y: 0 }}
            onLayout={() => viewerRef.current?.scrollTo({ x: (viewer || 0) * winW, animated: false })}
          >
            {photos.map((s) => (
              <View key={s.key} style={{ width: winW, height: winH, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={{ uri: images[s.key] }} style={{ width: winW - 24, height: winH * 0.7 }} resizeMode="contain" />
                <Text style={{ marginTop: 14, fontSize: rf(14), fontWeight: '700', color: '#FFFFFF' }}>{s.label}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={() => setViewer(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={{ position: 'absolute', top: insets.top + 12, right: 16, height: 42, width: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// Device photos as a full-width carousel that slides on its own every 3 s
// (paused while the customer swipes), with page dots; tap → full screen.
function PhotoCarousel({ photos, images, onOpen }) {
  const ref = useRef(null);
  const pageRef = useRef(0);
  const dragging = useRef(false);
  const [page, setPage] = useState(0);
  const [w, setW] = useState(0);
  const go = (n) => { pageRef.current = n; setPage(n); };

  useEffect(() => {
    if (photos.length < 2 || !w) return undefined;
    const t = setInterval(() => {
      if (dragging.current) return;
      const n = (pageRef.current + 1) % photos.length;
      go(n);
      ref.current?.scrollTo({ x: n * w, animated: true });
    }, 3000);
    return () => clearInterval(t);
  }, [photos.length, w]);

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w ? (
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => { dragging.current = true; }}
          onMomentumScrollEnd={(e) => { dragging.current = false; go(Math.round(e.nativeEvent.contentOffset.x / w)); }}
        >
          {photos.map((s, i) => (
            <TouchableOpacity key={s.key} activeOpacity={0.9} onPress={() => onOpen(i)} style={{ width: w, height: 210 }} accessibilityLabel={`${s.label} photo`}>
              <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: TINT }}>
                <Image source={{ uri: images[s.key] }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                <View style={{ position: 'absolute', left: 8, bottom: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(17,17,17,0.6)' }}>
                  <Text style={{ fontSize: rf(11), fontWeight: '700', color: '#FFFFFF' }}>{s.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : <View style={{ height: 210 }} />}
      {photos.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
          {photos.map((s, i) => (
            <View key={s.key} style={{ height: 6, width: i === page ? 16 : 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === page ? TEAL : 'rgba(17,17,17,0.20)' }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MetaCell({ icon, label, value }) {
  return (
    <View style={styles.metaCell}>
      <View style={styles.metaIcon}><Ionicons name={icon} size={15} color={TEAL} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function InfoCell({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.gridCell}>
      <Ionicons name={icon} size={15} color={TEAL} style={{ marginTop: 2, marginRight: 7 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.gridLabel}>{label}</Text>
        <Text style={styles.gridValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

// Compact expandable card: icon, title, one-line summary and a chevron.
// `always` stays visible when collapsed.
function Section({ icon, title, summary, summaryColor, chip, open, onToggle, always, children }) {
  return (
    <Card style={styles.card}>
      <TouchableOpacity activeOpacity={0.8} onPress={onToggle} style={styles.secHead} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: !!open }}>
        <View style={styles.secIcon}><Ionicons name={icon} size={16} color={TEAL} /></View>
        <Text style={styles.secTitle} numberOfLines={1}>{title}</Text>
        {chip ? <View style={[styles.chip, { marginRight: 6 }]}><Text style={styles.chipText}>{chip}</Text></View> : null}
        {summary ? <Text style={[styles.secSummary, summaryColor ? { color: summaryColor } : null]} numberOfLines={1}>{summary}</Text> : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
      </TouchableOpacity>
      {always}
      {open ? <View style={styles.secBody}>{children}</View> : null}
    </Card>
  );
}
