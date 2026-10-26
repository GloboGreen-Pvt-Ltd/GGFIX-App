import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, Pressable, ScrollView, Text, View, FlatList, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  FileText, Clock, Receipt, Package, Truck, MessageCircle,
  ShoppingBag, Tag, Wrench, Store, CheckCircle2, ReceiptText,
  ChevronRight, CalendarClock, IndianRupee, Bell, Settings, CalendarDays, MapPin, XCircle,
} from 'lucide-react-native';
import {
  ScreenContainer, SkeletonList, EmptyState, ErrorState, Chip, StatusChip,
  Card, FilterChipRow,
} from '../../../components/rnr';
import { BRAND } from '../../../theme/brand';

const GREEN = BRAND.green;
import { listMyOrders, getRepairBooking, getSellOrder, getSellOrderQuotations } from '../../../api/orders';
import { sellProgress, rowBucket } from '../../../utils/sellStatus';
import { getShop } from '../../../api/shops';
import { getProduct } from '../../../api/marketplace';
import { getUnreadCount } from '../../../api/notifications';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { cleanIssueSummary } from '../../../utils/pickupEstimateMeta';
import { rf } from '../../../utils/responsive';
import PageHeader, { HeaderIconButton } from '../../../components/PageHeader';
import { forceRelogin } from '../../../auth/session';
import { goToTab } from '../../../navigation/goToTab';
import { useFocusPolling } from '../../../hooks/useFocusPolling';

const TABS = [
  { key: 'Service', label: 'Service', icon: Wrench,        tone: 'primary' },
  { key: 'Pickup',  label: 'Pickup',  icon: Truck,         tone: 'accent'  },
  { key: 'Buy',     label: 'Buy',     icon: ShoppingBag,   tone: 'primary' },
  { key: 'Sell',    label: 'Sell',    icon: Tag,           tone: 'primary' },
  { key: 'Enquiry', label: 'Enquiry', icon: MessageCircle, tone: 'primary' },
];
// Backend stores repair bookings split by service mode: doorstep-pickup → PICKUP,
// enquiry → ENQUIRY, walk-in → REPAIR. Service tab pulls every repair regardless
// of delivery mode (walk-in + doorstep pickup), since a pickup booking is still
// a service booking — the customer just chose pickup as the delivery channel.
const TAB_MAP = { Buy: 'BUY', Sell: 'SELL', Pickup: 'PICKUP', Enquiry: 'ENQUIRY', Service: 'REPAIR' };
const TAB_ORDER_TYPES = { Service: ['REPAIR', 'PICKUP'] };
const REPAIR_TABS = new Set(['Pickup', 'Enquiry', 'Service']);

// The page lists every status together (no Active / Completed / Cancelled
// filter), so each tab is fetched once per status and merged.
const ALL_STATUSES = ['Pending', 'Completed', 'Cancelled'];
// "My Orders" shows Buy & Sell; the "RepairOrders" route reuses this screen
// for repair bookings (Service / Pickup / Enquiry).
const COMMERCE_TABS = ['Buy', 'Sell'];
const REPAIR_TAB_KEYS = ['Service', 'Pickup', 'Enquiry'];

// Buy orders carry the cart lines in payload.items (productId, title, price, quantity).
const buyLines = (o) => (Array.isArray(o.payload?.items) ? o.payload.items : []);
const buyProductId = (o) => buyLines(o)[0]?.productId || o.payload?.productId || null;

const hashed = (n) => (n ? (String(n).startsWith('#') ? n : `#${n}`) : '');

const HAIRLINE = BRAND.divider;
const LINE = '#E6E6E6'; // card / pill borders (BRAND.line is too faint on #F8F8F8)

function TabPill({ tab, active, onPress }) {
  const Icon = tab.icon;
  return (
    <Pressable onPress={onPress} className="active:opacity-85">
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 13, height: 36,
          borderRadius: 18, marginRight: 8,
          backgroundColor: active ? GREEN : '#fff',
          borderWidth: 1, borderColor: active ? GREEN : LINE,
          shadowColor: active ? GREEN : BRAND.ink, shadowOpacity: active ? 0.18 : 0.04, shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 }, elevation: active ? 3 : 1,
        }}
      >
        <Icon size={15} color={active ? '#fff' : BRAND.ink} />
        <Text
          style={{
            marginLeft: 6, fontSize: rf(12.5), fontWeight: '800',
            color: active ? '#fff' : BRAND.ink,
          }}
        >
          {tab.label}
        </Text>
      </View>
    </Pressable>
  );
}

function ActionRow({ children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      {children}
    </View>
  );
}

// Compact inline action: icon + label, separated by thin vertical dividers.
function ActionBtn({ icon: Icon, label, color, onPress, disabled, withDivider, compact }) {
  return (
    <>
      {withDivider ? <View style={{ width: 1, height: 22, backgroundColor: HAIRLINE }} /> : null}
      <Pressable
        disabled={disabled}
        onPress={onPress}
        className={disabled ? '' : 'active:opacity-60'}
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          height: 32, opacity: disabled ? 0.4 : 1, paddingHorizontal: 2,
        }}
      >
        <Icon size={compact ? 15 : 16} color={color} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{ marginLeft: compact ? 5 : 7, fontWeight: '700', fontSize: rf(compact ? 11.5 : 12), color: BRAND.ink }}
        >
          {label}
        </Text>
      </Pressable>
    </>
  );
}

// Status pill for this screen — same wording as the shared StatusChip
// (status humanised, or the backend phaseLabel as-is), with the order-list
// colour set: accepted/confirmed green, waiting/pending orange, in progress
// blue, cancelled red.
const PILL = {
  green:  { bg: BRAND.greenSoft, fg: BRAND.green, text: BRAND.greenDeep, icon: CheckCircle2 },
  orange: { bg: BRAND.yellowSoft, fg: BRAND.ink, text: BRAND.ink, icon: Clock },
  blue:   { bg: BRAND.divider, fg: BRAND.ink, text: BRAND.ink, icon: Wrench },
  pickup: { bg: BRAND.divider, fg: BRAND.ink, text: BRAND.ink, icon: Truck },
  red:    { bg: BRAND.redSoft, fg: BRAND.red, text: BRAND.red, icon: XCircle },
  grey:   { bg: BRAND.inkSoft, fg: BRAND.muted, text: BRAND.muted, icon: Clock },
};
function pillTone(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return 'grey';
  if (s.includes('cancel') || s.includes('reject') || s.includes('fail')) return 'red';
  if (s.includes('wait') || s.includes('approval') || s.includes('pend') || s.includes('hold')) return 'orange';
  if (s.includes('complete') || s.includes('done') || s.includes('deliver') || s.includes('received')) return 'green';
  if (s.includes('pickup') || s.includes('pick_up') || s.includes('out_for') || s.includes('reached')) return 'pickup';
  if (s.includes('progress') || s.includes('repair') || s.includes('work')) return 'blue';
  if (s.includes('confirm') || s.includes('accept')) return 'green';
  if (s.includes('schedul') || s.includes('booked')) return 'blue';
  return 'grey';
}
const humanizeStatus = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
function OrderStatusPill({ status, tone }) {
  const t = PILL[tone || pillTone(status)];
  const Icon = t.icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 1 }}>
      <Icon size={12} color={t.fg} />
      <Text numberOfLines={1} style={{ marginLeft: 5, color: t.text, fontWeight: '700', fontSize: rf(10.5), flexShrink: 1 }}>
        {humanizeStatus(status) || 'Unknown'}
      </Text>
    </View>
  );
}

function SpecChip({ label }) {
  return (
    <View style={{ backgroundColor: BRAND.bg, borderWidth: 1, borderColor: LINE, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, marginRight: 6, marginTop: 5 }}>
      <Text numberOfLines={1} style={{ color: BRAND.body, fontSize: rf(10), fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

export default function MyOrdersScreen({ navigation, route }) {
  const isRepairList = route?.name === 'RepairOrders';
  const tabKeys = isRepairList ? REPAIR_TAB_KEYS : COMMERCE_TABS;
  const shownTabs = TABS.filter((t) => tabKeys.includes(t.key));
  const presetTab = tabKeys.includes(route?.params?.initialTab) ? route.params.initialTab : tabKeys[0];
  const { width: screenW } = useWindowDimensions();

  const [tab, setTab] = useState(presetTab);
  // Sell tab only: All / Pending / Completed / Cancelled, from each sell order's journey.
  const [sellFilter, setSellFilter] = useState('ALL');
  const [detailsTick, setDetailsTick] = useState(0);
  useEffect(() => { setSellFilter('ALL'); }, [tab]);
  const [items, setItems] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [authRejected, setAuthRejected] = useState(false);

  const enrichedCache = useRef(new Map());
  const masterCache = useRef(null);
  const modelsByBrand = useRef(new Map());
  const shopCache = useRef(new Map());

  // `silent` = background poll: no loader, and a failed tick keeps the list.
  const load = useCallback(async (isRefresh = false, silent = false) => {
    // Sell journeys move on the server without the list row changing: every
    // load (incl. the background poll) re-reads them.
    if (tab === 'Sell') {
      [...enrichedCache.current.keys()].forEach((k) => { if (k.startsWith('sell:')) enrichedCache.current.delete(k); });
      setDetailsTick((n) => n + 1);
    }
    if (isRefresh) setRefreshing(true); else if (!silent) setLoading(true);
    if (!silent) { setError(null); setAuthRejected(false); }
    try {
      const types = TAB_ORDER_TYPES[tab] || [TAB_MAP[tab]];
      const calls = types.flatMap((t) => ALL_STATUSES.map((s) => listMyOrders({ orderType: t, status: s })));
      const settled = await Promise.allSettled(calls);
      const ok = settled.filter((r) => r.status === 'fulfilled');
      // Only an error when nothing loaded at all; a single failed status call
      // still shows the orders that did load.
      if (!ok.length) throw settled[0]?.reason || new Error('Failed to load orders');
      const byId = {};
      ok.flatMap((r) => r.value || []).forEach((o) => { if (o && o.id) byId[o.id] = o; });
      const merged = Object.values(byId).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
      // Keep identity when unchanged so the enrichment effect doesn't rerun per poll.
      setItems((prev) => (JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged));
    } catch (e) {
      if (silent) return;
      setItems([]);
      setAuthRejected(!!e?.authRejected);
      setError(e?.authRejected
        ? 'Your login has expired or is no longer accepted. Please log in again to see your orders.'
        : (e?.message || 'Failed to load orders'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Shop-side status changes land here without leaving the screen.
  useFocusPolling(useCallback(() => load(false, true), [load]));

  // Unread badge on the header bell (same source as Home / Profile).
  const [unread, setUnread] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    getUnreadCount().then((n) => { if (alive) setUnread(Number(n) || 0); }).catch(() => {});
    return () => { alive = false; };
  }, []));

  useEffect(() => {
    if (!items.length || !(REPAIR_TABS.has(tab) || tab === 'Sell' || tab === 'Buy')) { setDetails({}); return undefined; }
    let cancelled = false;
    (async () => {
      if (!masterCache.current) {
        const [brands, rams, storages] = await Promise.all([
          getBrands().catch(() => []),
          getRamOptions().catch(() => []),
          getStorageOptions().catch(() => []),
        ]);
        const brandById = {}; (brands || []).forEach((b) => { brandById[b.id] = b; });
        const ramById = {}; (rams || []).forEach((r) => { ramById[r.id] = r; });
        const storageById = {}; (storages || []).forEach((s) => { storageById[s.id] = s; });
        masterCache.current = { brandById, ramById, storageById };
      }
      const { brandById, ramById, storageById } = masterCache.current;
      const modelFor = async (brandId, modelId) => {
        if (!brandId || !modelId) return null;
        if (!modelsByBrand.current.has(brandId)) {
          modelsByBrand.current.set(brandId, await getModelsByBrand(brandId).catch(() => []));
        }
        return (modelsByBrand.current.get(brandId) || []).find((m) => m.id === modelId) || null;
      };
      const shopFor = async (shopId) => {
        if (!shopId) return null;
        if (!shopCache.current.has(shopId)) {
          shopCache.current.set(shopId, await getShop(shopId).catch(() => null));
        }
        return shopCache.current.get(shopId);
      };
      const modelImg = (m) => m?.imageUrl || (m?.imageBase64 ? `data:image/png;base64,${m.imageBase64}` : null);

      const enrichOne = async (o) => {
        if (tab === 'Buy') {
          // Product (image + shop) from GET /marketplace/products/{id}.
          const pid = buyProductId(o);
          if (!pid) return null;
          const cacheKey = `buy:${pid}`;
          if (enrichedCache.current.has(cacheKey)) return enrichedCache.current.get(cacheKey);
          const prod = await getProduct(pid).catch(() => null);
          const sh = prod?.shopId && !prod?.shopName ? await shopFor(prod.shopId) : null;
          const rec = prod ? {
            name: prod.title || null,
            image: prod.imageUrl || (Array.isArray(prod.extraImageUrls) ? prod.extraImageUrls[0] : null) || null,
            shopId: prod.shopId || null,
            shopName: prod.shopName || sh?.name || null,
          } : null;
          enrichedCache.current.set(cacheKey, rec);
          return rec;
        }
        if (tab === 'Sell') {
          const ref = o.referenceId || o.payload?.sellOrderId;
          if (!ref) return null;
          const cacheKey = `sell:${ref}`;
          if (enrichedCache.current.has(cacheKey)) return enrichedCache.current.get(cacheKey);
          const so = await getSellOrder(ref).catch(() => null);
          if (!so) { enrichedCache.current.set(cacheKey, null); return null; }
          const quotes = Array.isArray(so.quotations) ? so.quotations : await getSellOrderQuotations(ref).catch(() => []);
          const prog = sellProgress(so, quotes);
          const model = await modelFor(so.brandId, so.modelId);
          const brandName = brandById[so.brandId]?.name;
          const ramStorage = [ramById[so.ramOptionId]?.label, storageById[so.storageOptionId]?.label].filter(Boolean).join(' / ');
          const rec = {
            name: model?.name || (brandName ? `${brandName} device` : 'Sell Device'),
            image: modelImg(model),
            specs: [brandName, so.color, ramStorage].filter(Boolean).join(' · '),
            brand: brandName || null,
            chips: [ramById[so.ramOptionId]?.label, storageById[so.storageOptionId]?.label, so.color].filter(Boolean),
            // Real values from GET /sell-orders/{id} for the Sell card.
            sellOrderId: so.id,
            sellNumber: so.sellNumber || null,
            finalPrice: so.finalPrice ?? null,
            quotationsCount: quotes.length,
            sell: {
              step: prog.step,
              total: prog.total,
              label: prog.label,
              tone: prog.tone,
              bucket: prog.bucket,
              next: prog.next?.label || null,
              cancelled: prog.cancelled,
              sold: prog.sold,
              // Amount on the card: confirmed final price, else the accepted offer, else the best quote.
              amount: prog.price.final ?? prog.price.quoted ?? prog.price.bestQuote,
              amountLabel: prog.price.final ? 'Final' : prog.price.quoted ? 'Offer' : prog.price.bestQuote ? 'Best quote' : null,
              awaitingChoice: !prog.cancelled && quotes.length > 0 && prog.step < 3,
            },
            shopId: so.shopId || null,
            shopName: prog.chosenQuote ? [prog.chosenQuote.shopName, prog.chosenQuote.shopCity].filter(Boolean).join(', ') : null,
          };
          enrichedCache.current.set(cacheKey, rec);
          return rec;
        }
        const ref = o.payload?.bookingId || o.referenceId;
        const p = o.payload || {};
        const cacheKey = `bk:${ref || o.id}`;
        if (enrichedCache.current.has(cacheKey)) return enrichedCache.current.get(cacheKey);
        const shouldFetchBooking = ref && tab !== 'Service';
        const bk = shouldFetchBooking ? await getRepairBooking(ref).catch(() => null) : null;
        const brandId = bk?.brandId || p.brandId;
        const modelId = bk?.modelId || p.modelId;
        const ramOptionId = bk?.ramOptionId || p.ramOptionId;
        const storageOptionId = bk?.storageOptionId || p.storageOptionId;
        const color = bk?.color || p.color;
        const shopId = bk?.shopId || o.shopId || p.shopId;
        const serviceMode = bk?.serviceMode || p.serviceMode;
        const bkServices = (bk?.services || []).map((s) => s?.serviceName).filter(Boolean);
        const payloadServices = (p.services || []).map((s) => s?.serviceName || s?.name).filter(Boolean);
        const services = bkServices.length ? bkServices : payloadServices;
        const issueSummary = cleanIssueSummary(bk?.issueSummary || p.issueSummary);
        const model = await modelFor(brandId, modelId);
        const brandName = brandById[brandId]?.name;
        const ramStorage = [ramById[ramOptionId]?.label, storageById[storageOptionId]?.label].filter(Boolean).join(' / ');
        const sh = await shopFor(shopId);
        const shopName = sh?.name || p.shopName || null;
        const shopPhone = sh?.phone || sh?.mobile || null;
        const shopAddress = sh?.address || null;
        const rec = {
          name: bk?.modelName || model?.name || (brandName ? `${brandName} device` : null),
          image: modelImg(model),
          specs: [brandName, color, ramStorage].filter(Boolean).join(' · '),
          brand: brandName || null,
          chips: [ramById[ramOptionId]?.label, storageById[storageOptionId]?.label, color].filter(Boolean),
          services,
          issueSummary,
          isPickup: serviceMode === 'PICKUP' || !!bk?.pickupAddressId || !!bk?.pickupDate || !!bk?.pickupSlotStart,
          shopName,
          shopPhone,
          shopAddress,
        };
        enrichedCache.current.set(cacheKey, rec);
        return rec;
      };

      const seen = new Map();
      const perOrder = await Promise.all((items || []).map(async (o) => {
        const ref = tab === 'Sell'
          ? (o.referenceId || o.payload?.sellOrderId)
          : (o.payload?.bookingId || o.referenceId);
        const cacheKey = tab === 'Sell' ? `sell:${ref}` : tab === 'Buy' ? `buy:${buyProductId(o) || o.id}` : `bk:${ref || o.id}`;
        if (!seen.has(cacheKey)) seen.set(cacheKey, enrichOne(o));
        const rec = await seen.get(cacheKey);
        return [o.id, rec];
      }));
      if (cancelled) return;
      const next = {};
      for (const [id, rec] of perOrder) if (rec) next[id] = rec;
      setDetails(next);
    })();
    return () => { cancelled = true; };
  }, [items, tab, detailsTick]);

  const sellBucket = (o) => details[o.id]?.sell?.bucket || rowBucket(o.status);
  const sellCounts = tab === 'Sell'
    ? items.reduce((c, o) => { c[sellBucket(o)] += 1; return c; }, { PENDING: 0, COMPLETED: 0, CANCELLED: 0 })
    : null;
  const visibleItems = tab === 'Sell' && sellFilter !== 'ALL' ? items.filter((o) => sellBucket(o) === sellFilter) : items;
  const filterWord = { PENDING: 'pending', COMPLETED: 'completed', CANCELLED: 'cancelled' }[sellFilter];

  // Buy orders have no detail screen of their own — open the (first) product.
  const openOrder = (o) => {
    if (tab === 'Buy') {
      const pid = buyProductId(o);
      if (pid) navigation.navigate('BuyProductDetails', { productId: pid });
      return;
    }
    if (tab === 'Sell') {
      const sid = o.referenceId || o.payload?.sellOrderId;
      if (sid) navigation.navigate('SellOrderDetails', { sellOrderId: sid });
      return;
    }
    const ticketId = o.payload?.ticketId;
    if (tab === 'Service' && ticketId) {
      navigation.navigate('ServiceTicketDetails', { ticketId, fromOrders: true });
      return;
    }
    const ref = o.payload?.bookingId || o.referenceId;
    if (!ref) return;
    if (REPAIR_TABS.has(tab)) {
      navigation.navigate('RepairOrderDetails', { bookingId: ref, fromOrders: true });
    }
  };

  const openTimeline = (o) => {
    const ref = o.payload?.bookingId || o.referenceId;
    if (!ref) return;
    const isPickup = tab === 'Pickup' || o.payload?.serviceMode === 'PICKUP' || details[o.id]?.isPickup;
    navigation.navigate(isPickup ? 'RepairPickupStatus' : 'RepairOrderHistory', { bookingId: ref });
  };

  const onReschedule = (o) => {
    const ref = o.payload?.bookingId || o.referenceId;
    if (ref) navigation.navigate('RepairPickupSlot', { rescheduleBookingId: ref, shopId: o.payload?.shopId });
  };

  const openReceipt = (o) => {
    const ref = o.payload?.bookingId || o.referenceId;
    if (ref) navigation.navigate('ServiceReceipt', { bookingId: ref });
  };

  const openInvoice = (o) => {
    const ref = o.payload?.bookingId || o.referenceId;
    if (ref) navigation.navigate('InvoiceReceipt', { bookingId: ref });
  };

  const renderCard = (o) => {
    const p = o.payload || {};
    const d = details[o.id] || {};
    const TabIcon = TABS.find((t) => t.key === tab)?.icon || Package;
    const lines = tab === 'Buy' ? buyLines(o) : [];
    const baseTitle = (tab === 'Buy' && (lines[0]?.title || d.name)) || d.name || p.deviceName || p.title || o.orderType;
    const title = lines.length > 1 ? `${baseTitle} +${lines.length - 1} more` : baseTitle;
    const sell = tab === 'Sell' ? d.sell : null;
    const liveStatus = sell ? sell.label : ((tab === 'Service' || tab === 'Pickup') && o.phaseLabel) ? o.phaseLabel : o.status;
    const showActions = tab !== 'Sell';
    // Sell cards: confirmed final price, else the accepted offer, else the best quote.
    const sellAmount = tab === 'Sell' ? (sell ? sell.amount : null) : o.totalAmount;
    const imgBox = 50;
    const shopName = d.shopName || p.shopName;
    const hasAmount = sellAmount != null && Number(sellAmount) > 0;
    const when = o.createdAt ? new Date(o.createdAt) : null;
    const whenLabel = when
      ? `${when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
      : null;

    return (
      <Pressable
        key={o.id}
        onPress={() => openOrder(o)}
        className="active:opacity-90"
        style={{
          backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, marginBottom: 10,
          borderRadius: 16, shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 }, elevation: 2,
        }}
      >
        <View style={{ padding: 10 }}>
          {/* Header: image · title + status + order no + date (one column). */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View
              style={{
                height: imgBox, width: imgBox, borderRadius: 12, marginRight: 10,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                backgroundColor: d.image ? '#FFFFFF' : BRAND.greenSoft, borderWidth: 1, borderColor: BRAND.line,
              }}
            >
              {d.image ? (
                <Image source={{ uri: d.image }} style={{ width: imgBox - 8, height: imgBox - 8 }} resizeMode="contain" />
              ) : (
                <TabIcon size={22} color={BRAND.green} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text className="font-extrabold" style={{ color: BRAND.ink, flex: 1, fontSize: rf(13.5), lineHeight: rf(17), paddingRight: 4 }} numberOfLines={2}>
                  {title}
                </Text>
                <ChevronRight size={16} color={BRAND.muted} style={{ marginTop: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <View style={{ flexShrink: 1, flexDirection: 'row' }}>
                  <OrderStatusPill status={liveStatus} tone={sell?.tone} />
                </View>
                <View style={{ flex: 1 }} />
                {hasAmount ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: BRAND.greenSoft }}>
                    {sell?.amountLabel ? <Text style={{ color: BRAND.greenDeep, fontSize: rf(10), fontWeight: '700', marginRight: 3 }}>{sell.amountLabel}</Text> : null}
                    <IndianRupee size={11} color={BRAND.greenDeep} />
                    <Text className="font-extrabold" style={{ color: BRAND.greenDeep, fontSize: rf(12) }}>{Number(sellAmount).toLocaleString('en-IN')}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <CalendarDays size={11} color={BRAND.green} />
                <Text style={{ flex: 1, color: BRAND.muted, fontSize: rf(10.5), marginLeft: 4 }} numberOfLines={1}>
                  {[hashed((tab === 'Sell' && d.sellNumber) || o.orderNumber), whenLabel].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
            </View>
          </View>

          {/* Spec chips — full width under the header so they never squeeze the title. */}
          {(d.chips?.length || (tab === 'Service' && d.services?.length)) ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
              {(d.chips || []).map((c) => <SpecChip key={c} label={c} />)}
              {tab === 'Service' && d.services?.length ? <SpecChip label={`${d.services.length} Part(s)`} /> : null}
            </View>
          ) : null}

          {/* Sell journey progress: step x of N · what happens next. */}
          {sell ? (
            <View style={{ marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: BRAND.line, overflow: 'hidden' }}>
                <View style={{ height: 6, borderRadius: 3, width: `${Math.round(((sell.step + 1) / sell.total) * 100)}%`, backgroundColor: sell.cancelled ? BRAND.red : BRAND.green }} />
              </View>
              <Text style={{ marginTop: 5, color: BRAND.muted, fontSize: rf(10.5) }} numberOfLines={1}>
                {sell.cancelled
                  ? `Cancelled at step ${sell.step + 1} of ${sell.total}`
                  : sell.sold
                    ? 'Selling completed'
                    : `Step ${sell.step + 1} of ${sell.total}${sell.next ? `  ·  Next: ${sell.next}` : ''}`}
              </Text>
            </View>
          ) : null}

          {d.services?.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
              <Settings size={14} color={BRAND.muted} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
                <Text className="font-extrabold uppercase" style={{ color: BRAND.muted, fontSize: rf(10), letterSpacing: 1.2 }}>Booked Services</Text>
                {d.services.slice(0, 3).map((sv, i) => (
                  <Text key={i} style={{ color: BRAND.ink, fontSize: rf(11.5), marginTop: 3 }} numberOfLines={1}>{i + 1}. {sv}</Text>
                ))}
                {d.services.length > 3 ? (
                  <Text className="mt-1 font-bold" style={{ color: BRAND.greenDeep, fontSize: rf(11) }}>+ {d.services.length - 3} more</Text>
                ) : null}
              </View>
            </View>
          ) : d.issueSummary && tab !== 'Service' ? (
            <Text style={{ color: BRAND.muted, fontSize: rf(11.5), marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: HAIRLINE }} numberOfLines={2}>
              {d.issueSummary}
            </Text>
          ) : null}

          {/* Shop / provider — only when known (amount sits in the header). */}
          {shopName ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
              <Store size={14} color={BRAND.green} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 7 }}>
                <Text className="font-bold" style={{ color: BRAND.ink, fontSize: rf(12) }} numberOfLines={1}>{shopName}</Text>
                {d.shopAddress ? (
                  <Text style={{ color: BRAND.muted, fontSize: rf(10.5), marginTop: 1, lineHeight: rf(14) }} numberOfLines={1}>{d.shopAddress}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {showActions ? (
            tab === 'Service' ? (
              <ActionRow>
                <ActionBtn compact icon={FileText} label="Details" color={BRAND.green} onPress={() => openOrder(o)} />
                <ActionBtn compact icon={Clock} label="History" color={BRAND.yellow} onPress={() => openTimeline(o)} withDivider />
                <ActionBtn compact icon={Receipt} label="Receipt" color={BRAND.green} onPress={() => openReceipt(o)} withDivider />
                <ActionBtn
                  compact
                  icon={ReceiptText}
                  label="Invoice"
                  color={BRAND.green}
                  onPress={() => openInvoice(o)}
                  disabled={String(o.status || '').toUpperCase() !== 'COMPLETED'}
                  withDivider
                />
              </ActionRow>
            ) : tab === 'Buy' ? (
              <ActionRow>
                <ActionBtn compact icon={FileText} label="View Product" color={BRAND.green} onPress={() => openOrder(o)} disabled={!buyProductId(o)} />
                <ActionBtn compact icon={MessageCircle} label="Chat Shop" color={BRAND.green} onPress={() => navigation.navigate('ShopChat', { shopId: d.shopId })} disabled={!d.shopId} withDivider />
                <ActionBtn compact icon={ShoppingBag} label="Shop More" color={BRAND.green} onPress={() => goToTab(navigation, 'Buy')} withDivider />
              </ActionRow>
            ) : (
              <ActionRow>
                <ActionBtn icon={FileText} label="Details" color={BRAND.green} onPress={() => openOrder(o)} />
                <ActionBtn icon={MapPin} label={tab === 'Pickup' ? 'Track' : 'Track'} color={BRAND.green} onPress={() => openTimeline(o)} withDivider />
                {tab === 'Pickup' ? (() => {
                  const live = String(o.phaseStatus || o.status || '').toUpperCase();
                  const reschedulable = !live
                    || live === 'PENDING'
                    || live === 'ORDER_PLACED'
                    || live === 'PICKUP_REQUESTED'
                    || live === 'PICKUP_ACCEPTED'
                    || live === 'ORDER_SERVICE_CONFIRMED'
                    || live === 'SERVICE_ACCEPTED';
                  return reschedulable ? (
                    <ActionBtn icon={CalendarClock} label="Re-Schedule" color={BRAND.yellow} onPress={() => onReschedule(o)} withDivider />
                  ) : (
                    <ActionBtn icon={Receipt} label="Receipt" color={BRAND.green} onPress={() => openReceipt(o)} withDivider />
                  );
                })() : (
                  <ActionBtn icon={Receipt} label="Receipt" color={BRAND.green} onPress={() => (REPAIR_TABS.has(tab) ? openReceipt(o) : openOrder(o))} withDivider />
                )}
              </ActionRow>
            )
          ) : sell?.awaitingChoice ? (
            <ActionRow>
              <ActionBtn icon={FileText} label="Details" color={BRAND.green} onPress={() => openOrder(o)} />
              <ActionBtn
                icon={Store}
                label={`View Quotations (${d.quotationsCount})`}
                color={BRAND.yellow}
                onPress={() => navigation.navigate('SellQuotation', { sellOrderId: d.sellOrderId })}
                withDivider
              />
            </ActionRow>
          ) : sell && (sell.sold || sell.cancelled) ? (
            <ActionRow>
              <ActionBtn icon={FileText} label="Details" color={BRAND.green} onPress={() => openOrder(o)} />
              <ActionBtn icon={Tag} label={sell.sold ? 'Sell Another' : 'Sell Again'} color={BRAND.green} onPress={() => goToTab(navigation, 'Sell')} withDivider />
            </ActionRow>
          ) : sell && d.shopId ? (
            <ActionRow>
              <ActionBtn icon={MapPin} label="Track Order" color={BRAND.green} onPress={() => openOrder(o)} />
              <ActionBtn icon={MessageCircle} label="Chat Shop" color={BRAND.green} onPress={() => navigation.navigate('ShopChat', { shopId: d.shopId })} withDivider />
            </ActionRow>
          ) : (
            <ActionRow>
              <ActionBtn icon={FileText} label="View Details" color={BRAND.green} onPress={() => openOrder(o)} />
            </ActionRow>
          )}
        </View>
      </Pressable>
    );
  };

  const canGoBack = navigation.canGoBack();

  return (
    <ScreenContainer edges={[]}>
      <PageHeader
        title={isRepairList ? 'Repair Orders' : 'My Orders'}
        subtitle={isRepairList ? 'Track your service, pickup and enquiry bookings' : 'Track your buy and sell orders'}
        onBack={canGoBack ? () => navigation.goBack() : undefined}
        right={<HeaderIconButton icon={Bell} label="Notifications" onPress={() => navigation.navigate('Notifications')} badge={unread} badgeColor={BRAND.red} />}
      />

      {/* Order-type tabs (no status filter — every status is listed). */}
      <View style={{ backgroundColor: BRAND.bg, paddingTop: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
        >
          {shownTabs.map((t) => (
            <TabPill key={t.key} tab={t} active={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>
        {tab === 'Sell' && !loading && !error && items.length ? (
          <FilterChipRow
            value={sellFilter}
            onChange={setSellFilter}
            options={[
              { value: 'ALL', label: `All · ${items.length}` },
              { value: 'PENDING', label: `Pending · ${sellCounts.PENDING}` },
              { value: 'COMPLETED', label: `Completed · ${sellCounts.COMPLETED}` },
              { value: 'CANCELLED', label: `Cancelled · ${sellCounts.CANCELLED}` },
            ]}
          />
        ) : null}
        {!loading && !error && visibleItems.length ? (
          <Text style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 2, fontSize: rf(11), fontWeight: '700', color: BRAND.muted }}>
            {visibleItems.length} {visibleItems.length === 1 ? 'order' : 'orders'}
          </Text>
        ) : null}
      </View>

      {/* List / loading / empty / error all sit on the page background. */}
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        {loading ? (
          <SkeletonList rows={5} rowHeight={120} />
        ) : error ? (
          <ErrorState
            title={authRejected ? 'Please log in again' : undefined}
            description={error}
            onRetry={authRejected ? forceRelogin : () => load()}
            retryLabel={authRejected ? 'Log in again' : undefined}
            accent={BRAND.greenDeep}
            alertColor={BRAND.red}
          />
        ) : visibleItems.length === 0 ? (
          <EmptyState
            icon={<Package size={36} color={BRAND.green} />}
            accentSoft="#EAF8EC"
            title={tab === 'Sell' && filterWord && items.length ? `No ${filterWord} sell orders` : `No ${tab.toLowerCase()} orders`}
            description={tab === 'Sell' && filterWord && items.length ? `None of your sell orders are ${filterWord}.` : `You don't have any ${tab.toLowerCase()} orders yet.`}
          />
        ) : (
          <FlatList
            data={visibleItems}
            keyExtractor={(o) => o.id}
            style={{ backgroundColor: BRAND.bg }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#09AD2A" colors={['#09AD2A']} />}
            renderItem={({ item }) => renderCard(item)}
            removeClippedSubviews
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
