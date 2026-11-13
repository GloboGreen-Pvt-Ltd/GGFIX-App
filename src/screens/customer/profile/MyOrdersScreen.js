import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, Linking, Pressable, ScrollView, Text, View, FlatList, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FileText, Clock, Receipt, Package, Truck, MessageCircle,
  ShoppingBag, Tag, Wrench, Store, CheckCircle2, ReceiptText,
  ChevronRight, CalendarClock, IndianRupee, Bell, Settings, CalendarDays, MapPin, XCircle,
  ArrowLeft, Phone, Smartphone, Crown, MessageSquareText,
} from 'lucide-react-native';
import { SQ, ago } from '../sell/useSellOrder';
import { getSeenQuotes, markQuotesSeen, notifyNewSellQuotes } from '../../../utils/sellQuoteSeen';
import {
  SkeletonList, EmptyState, ErrorState, Chip, StatusChip,
  Card,
} from '../../../components/rnr';
import { BRAND } from '../../../theme/brand';

const GREEN = BRAND.green;
import { listMyOrders, getRepairBooking, getSellOrder, getSellOrderQuotations } from '../../../api/orders';
import { sellProgress, rowBucket } from '../../../utils/sellStatus';
import { getShop } from '../../../api/shops';
import { getProduct, listChats } from '../../../api/marketplace';
import { listBuyOrders, toMyOrdersRow } from '../../../api/buyOrders';
import { getUnreadCount } from '../../../api/notifications';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { cleanIssueSummary } from '../../../utils/pickupEstimateMeta';
import { rf } from '../../../utils/responsive';
import { forceRelogin } from '../../../auth/session';
import { goToTab } from '../../../navigation/goToTab';
import { StaticTabBar } from '../../../navigation/CustomTabBar';
import EnquiryNearbyShops from './EnquiryNearbyShops';
import PageHeader, { HeaderIconButton } from '../../../components/PageHeader';
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
const LINE = '#E8EAEE'; // card / pill borders (BRAND.line is too faint on #F3F4F6)

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

// ── Repair Orders (Service / Pickup / Enquiry) in the Partner app's Jobs
// layout (screens/owner/AllBooking/JobsScreen.js): a left status rail of
// tinted tiles with a solid icon disc + count, and product-card tiles (image
// panel with a status ribbon and VIEW, details on the right).
const JOB_TEAL = '#035C6C';
const JOB_MINT = '#E5F3F5';
const JOB_LINE = '#E5E7EB';
// Left rail scopes — brand-sheet colours, same as the Partner Jobs rail.
const REPAIR_SCOPES = [
  { key: 'ALL',       label: 'All',       icon: FileText,     tone: '#035C6C' },
  { key: 'ACTIVE',    label: 'Active',    icon: Clock,        tone: '#0788C9' },
  { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2, tone: '#609138' },
  { key: 'CANCELLED', label: 'Cancelled', icon: XCircle,      tone: '#F32C26' },
];
// My Orders (Buy / Sell) rail — the same tiles, "Pending" for open orders.
const COMMERCE_SCOPES = [
  { key: 'ALL',       label: 'All',       icon: FileText,     tone: '#035C6C' },
  { key: 'PENDING',   label: 'Pending',   icon: Clock,        tone: '#0788C9' },
  { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2, tone: '#609138' },
  { key: 'CANCELLED', label: 'Cancelled', icon: XCircle,      tone: '#F32C26' },
];
// Partner rail sizing (components/report/ReportRail railSizes).
function jobRailSizes(w) {
  if (w < 360) return { font: 9.5, line: 12, disc: 30, icon: 14, badge: 9 };
  if (w < 400) return { font: 10.5, line: 13, disc: 34, icon: 16, badge: 9 };
  if (w < 600) return { font: 11, line: 14, disc: 34, icon: 16, badge: 9.5 };
  if (w < 900) return { font: 12, line: 15, disc: 38, icon: 17, badge: 10 };
  return { font: 13, line: 16, disc: 40, icon: 18, badge: 10.5 };
}
// Which rail scope an order sits in, from its row status / live phase.
function repairScope(o) {
  const s = `${o?.status || ''} ${o?.phaseStatus || ''}`.toUpperCase();
  if (/CANCEL|REJECT/.test(s)) return 'CANCELLED';
  if (/COMPLETE|DELIVERED\b|CLOSED/.test(s)) return 'COMPLETED';
  return 'ACTIVE';
}
// Ribbon colour — the Partner TONE_STYLE foregrounds (amber / red / teal).
function ribbonColor(status) {
  const t = pillTone(status);
  if (t === 'red') return '#B91C1C';
  if (t === 'orange') return '#B45309';
  return JOB_TEAL;
}
const jobDate = (d) => {
  const x = d ? new Date(d) : null;
  return x && !Number.isNaN(x.getTime()) ? x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
};
const jobTime = (d) => {
  const x = d ? new Date(d) : null;
  return x && !Number.isNaN(x.getTime()) ? x.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
};

// Small round action (Partner call / copy buttons): mint disc, teal glyph.
function JobAction({ icon: Icon, label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      className="items-center justify-center active:opacity-70"
      style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: JOB_MINT, marginRight: 8, opacity: disabled ? 0.4 : 1 }}
    >
      <Icon size={13} color={JOB_TEAL} />
    </Pressable>
  );
}

export default function MyOrdersScreen({ navigation, route }) {
  const isRepairList = route?.name === 'RepairOrders';
  const tabKeys = isRepairList ? REPAIR_TAB_KEYS : COMMERCE_TABS;
  const shownTabs = TABS.filter((t) => tabKeys.includes(t.key));
  // Opened from the Buy module: Buy orders only, in the Buy layout (see buyView below).
  const buyView = !isRepairList && route?.params?.view === 'buy';
  const presetTab = buyView ? 'Buy' : tabKeys.includes(route?.params?.initialTab) ? route.params.initialTab : tabKeys[0];
  const { width: screenW } = useWindowDimensions();

  const [tab, setTab] = useState(presetTab);
  // Sell tab only: All / Pending / Completed / Cancelled, from each sell order's journey.
  const [sellFilter, setSellFilter] = useState('ALL');
  // Repair list only: the left-rail scope (All / Active / Completed / Cancelled).
  const [scope, setScope] = useState('ALL');
  const [detailsTick, setDetailsTick] = useState(0);
  useEffect(() => { setSellFilter('ALL'); setScope('ALL'); }, [tab]);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [details, setDetails] = useState({});
  const [seenQuotes, setSeenQuotes] = useState({}); // sellOrderId → quotations seen (red dot)
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
      // Fixed-price buy orders live in marketplace-service; shown in the same Buy tab.
      if (tab === 'Buy') calls.push(listBuyOrders().then((rows) => (Array.isArray(rows) ? rows : []).map(toMyOrdersRow)));
      const settled = await Promise.allSettled(calls);
      const ok = settled.filter((r) => r.status === 'fulfilled');
      // Only an error when nothing loaded at all; a single failed status call
      // still shows the orders that did load.
      if (!ok.length) throw settled[0]?.reason || new Error('Failed to load orders');
      const byId = {};
      ok.flatMap((r) => r.value || []).forEach((o) => { if (o && o.id) byId[o.id] = o; });
      // Enquiry tab: an enquiry is a chat with a shop (GET /customer/chats),
      // not an order — list those threads too, newest message first.
      let chatRows = [];
      if (tab === 'Enquiry') {
        const chats = await listChats().catch(() => []);
        chatRows = (Array.isArray(chats) ? chats : []).filter((t) => t && t.id).map((t) => ({
          id: `chat:${t.id}`, _chat: t, createdAt: t.lastMessageAt || t.updatedAt || t.createdAt,
        }));
      }
      const merged = [...Object.values(byId), ...chatRows].sort(
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
        if (o._chat) return null;
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
            // Compact Sell card: storage · colour, highest quote, latest quote time.
            storageLine: ramStorage || null,
            color: so.color || null,
            bestQuote: prog.price.bestQuote,
            latestQuoteAt: quotes.map((q) => q.createdAt).filter(Boolean).sort().pop() || null,
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
      // New quotations since the last check → one "New Buyer Enquiry" banner each.
      if (tab === 'Sell') {
        notifyNewSellQuotes(Object.values(next).map((r) => ({ sellOrderId: r.sellOrderId, count: r.quotationsCount, name: r.name })));
        getSeenQuotes().then(setSeenQuotes).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [items, tab, detailsTick]);

  const sellBucket = (o) => details[o.id]?.sell?.bucket || rowBucket(o.status);
  // My Orders (Buy / Sell): the left rail's status scope for an order — a sell
  // order's live journey, a buy order's row status.
  const commerceScope = (o) => {
    if (tab === 'Sell') return sellBucket(o);
    const s = String(o?.status || '').toUpperCase();
    if (/CANCEL|REJECT/.test(s)) return 'CANCELLED';
    if (/COMPLETE|DELIVERED\b|CLOSED/.test(s)) return 'COMPLETED';
    return 'PENDING';
  };
  const commerceCounts = !isRepairList
    ? items.reduce((c, o) => { c[commerceScope(o)] += 1; return c; }, { ALL: items.length, PENDING: 0, COMPLETED: 0, CANCELLED: 0 })
    : null;
  const repairCounts = isRepairList
    ? items.reduce((c, o) => { c[repairScope(o)] += 1; return c; }, { ALL: items.length, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 })
    : null;
  const visibleItems = isRepairList
    ? (scope !== 'ALL' ? items.filter((o) => repairScope(o) === scope) : items)
    : (sellFilter !== 'ALL' ? items.filter((o) => commerceScope(o) === sellFilter) : items);

  const openOrder = (o) => {
    if (tab === 'Buy') {
      navigation.navigate(o._fixed ? 'BuyFixedOrder' : 'BuyOrderDetails', { orderId: o.id });
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

  // Compact Sell order card (app theme: teal · gold · green · navy). Quotes
  // received → count badge (red dot when unseen), highest quote + latest
  // enquiry, View Quotes / View Details; none yet → "Awaiting Quotes" with the
  // journey bar. All live: GET /sell-orders/{id} and its quotations.
  const renderSellCard = (o) => {
    const d = details[o.id] || {};
    const sell = d.sell;
    const sid = d.sellOrderId || o.referenceId || o.payload?.sellOrderId;
    const count = Number(d.quotationsCount) || 0;
    const unread = count > (seenQuotes[sid] || 0);
    const sub = [d.storageLine, d.color].filter(Boolean).join(' · ');
    const dateTxt = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const best = Number(d.bestQuote) || 0;
    const viewQuotes = () => {
      if (!sid) return;
      markQuotesSeen(sid, count);
      setSeenQuotes((m) => ({ ...m, [sid]: Math.max(m[sid] || 0, count) }));
      navigation.navigate('SellQuotesReceived', { sellOrderId: sid });
    };
    // Until this order's live data is in, don't guess "Awaiting Quotes" — an
    // order with quotations would flash the wrong state.
    const checking = !sell;
    const badge = checking
      ? { Icon: Clock, text: 'Checking quotes…', fg: SQ.muted, bg: '#F1F2F4' }
      : count > 0
        ? { Icon: MessageSquareText, text: `${count} Quotation${count > 1 ? 's' : ''} Received`, fg: SQ.success, bg: SQ.successSoft }
        : sell.cancelled
          ? { Icon: XCircle, text: 'Cancelled', fg: SQ.red, bg: SQ.redSoft }
          : { Icon: Clock, text: 'Awaiting Quotes', fg: '#8A5A00', bg: SQ.goldSoft };
    return (
      <Pressable
        key={o.id}
        onPress={() => openOrder(o)}
        accessibilityRole="button"
        className="active:opacity-90"
        style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: SQ.line, padding: 12, marginBottom: 12, shadowColor: SQ.navy, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 65, height: 65, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {d.image ? <Image source={{ uri: d.image }} style={{ width: 60, height: 60 }} resizeMode="contain" /> : <Tag size={24} color={SQ.primary} />}
          </View>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <Text numberOfLines={1} style={{ fontSize: rf(15), fontWeight: '800', color: SQ.navy }}>{d.name || o.payload?.deviceName || 'Sell Device'}</Text>
            {sub ? <Text numberOfLines={1} style={{ fontSize: rf(12.5), color: SQ.muted, marginTop: 2 }}>{sub}</Text> : null}
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: badge.bg }}>
              <badge.Icon size={13} color={badge.fg} />
              <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: badge.fg }}>{badge.text}</Text>
              {count > 0 && unread ? <View accessibilityLabel="New enquiry" style={{ position: 'absolute', top: -2, right: -2, height: 9, width: 9, borderRadius: 5, backgroundColor: SQ.red, borderWidth: 1.5, borderColor: '#FFFFFF' }} /> : null}
            </View>
          </View>
          <ChevronRight size={20} color={SQ.navy} />
        </View>

        {count > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 14, backgroundColor: '#EEF7EF', paddingVertical: 10, paddingHorizontal: 12 }}>
            <Crown size={22} color={SQ.gold} fill={SQ.goldSoft} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: rf(11), color: SQ.navy }}>Highest Quote</Text>
              <Text style={{ fontSize: rf(17), fontWeight: '800', color: SQ.navy, marginTop: 1 }}>{best ? `₹${best.toLocaleString('en-IN')}` : '—'}</Text>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#D5E7D7', marginHorizontal: 10 }} />
            <Clock size={20} color={SQ.primary} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(11), color: SQ.navy }}>Latest Enquiry</Text>
              <Text numberOfLines={1} style={{ fontSize: rf(14), fontWeight: '800', color: SQ.navy, marginTop: 1 }}>{ago(d.latestQuoteAt) || '—'}</Text>
            </View>
          </View>
        ) : sell ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E6EBEE', overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 3, width: `${Math.round(((sell.step + 1) / sell.total) * 100)}%`, backgroundColor: sell.cancelled ? SQ.red : SQ.primary }} />
            </View>
            <Text numberOfLines={1} style={{ marginTop: 6, fontSize: rf(12), color: SQ.muted }}>
              {sell.cancelled
                ? `Cancelled at step ${sell.step + 1} of ${sell.total}`
                : sell.sold ? 'Selling completed' : `Step ${sell.step + 1} of ${sell.total}${sell.next ? `  ·  Next: ${sell.next}` : ''}`}
            </Text>
          </View>
        ) : null}

        <Text numberOfLines={1} style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F2F4', fontSize: rf(11.5), color: SQ.muted }}>
          {[hashed(d.sellNumber || o.orderNumber), dateTxt].filter(Boolean).join('  ·  ')}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {/* View Quotes on every live sell order (the screen shows its own
              "No quotations yet" while shops haven't quoted). */}
          {sid && !sell?.cancelled ? (
            <Pressable onPress={viewQuotes} accessibilityRole="button" accessibilityLabel={count > 0 ? `View Quotes, ${count}` : 'View Quotes'} className="active:opacity-80" style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 12, borderWidth: 1.5, borderColor: SQ.primary, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
              <MessageSquareText size={15} color={SQ.primary} />
              <Text numberOfLines={1} style={{ flexShrink: 1, marginLeft: 5, fontSize: rf(12.5), fontWeight: '800', color: SQ.primary, includeFontPadding: false }}>View Quotes</Text>
              {count > 0 ? (
                <View style={{ marginLeft: 5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: SQ.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: '#FFFFFF', includeFontPadding: false }}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          <Pressable onPress={() => openOrder(o)} accessibilityRole="button" className="active:opacity-85" style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 12, backgroundColor: SQ.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text numberOfLines={1} style={{ fontSize: rf(12.5), fontWeight: '800', color: '#FFFFFF', includeFontPadding: false }}>View Details</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderCard = (o) => {
    if (tab === 'Sell') return renderSellCard(o);
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

  // Partner Jobs tile (row layout): image panel with the status ribbon top-left
  // and VIEW bottom-right, then #order · ₹ amount, device, shop, services,
  // date · time, and the order's actions as round buttons.
  const jobRow = screenW - (screenW >= 680 ? 104 : screenW < 360 ? 70 : 78) < 680;
  // Enquiry chat tile: shop avatar · name, last message, time, unread · Open.
  const renderChatTile = (t) => {
    const unread = Number(t.unreadCount) || 0;
    const when = t.lastMessageAt || t.updatedAt || t.createdAt;
    return (
      <Pressable
        key={`chat:${t.id}`}
        onPress={() => navigation.navigate('ShopChat', { shopId: t.shopId, mode: 'ENQUIRY' })}
        accessibilityRole="button"
        accessibilityLabel={`Enquiry chat with ${t.counterpartName || 'shop'}`}
        className="active:opacity-90"
        style={{ flex: 1, marginBottom: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: JOB_LINE, flexDirection: 'row', alignItems: 'center', padding: 12 }}
      >
        <View style={{ height: 48, width: 48, borderRadius: 24, backgroundColor: '#E5F3F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {t.counterpartAvatarUrl ? (
            <Image source={{ uri: t.counterpartAvatarUrl }} style={{ width: 48, height: 48 }} resizeMode="cover" />
          ) : (
            <MessageCircle size={22} color={JOB_TEAL} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: '#111111' }} numberOfLines={1}>{t.counterpartName || 'Shop'}</Text>
            <Text style={{ fontSize: 11, color: unread ? JOB_TEAL : '#6B7280', fontWeight: unread ? '800' : '400', marginLeft: 8 }} numberOfLines={1}>
              {[jobDate(when), jobTime(when)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Text style={{ flex: 1, fontSize: 12.5, color: t.counterpartTyping ? JOB_TEAL : '#6B7280' }} numberOfLines={1}>
              {t.counterpartTyping ? 'typing…' : (t.lastMessagePreview || 'Enquiry chat · tap to continue')}
            </Text>
            {unread ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, marginLeft: 8, backgroundColor: JOB_TEAL, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#E5F3F5' }}>
              <MessageCircle size={11} color={JOB_TEAL} />
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: JOB_TEAL, marginLeft: 4 }}>ENQUIRY</Text>
            </View>
            {t.counterpartOnline ? <Text style={{ fontSize: 11, color: '#609138', fontWeight: '700', marginLeft: 8 }}>● Online</Text> : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderJobTile = (o) => {
    if (o._chat) return renderChatTile(o._chat);
    const p = o.payload || {};
    const d = details[o.id] || {};
    const title = d.name || p.deviceName || p.title || o.orderType;
    const liveStatus = o.phaseLabel || o.status;
    const amount = Number(o.totalAmount) || 0;
    const shopName = d.shopName || p.shopName;
    const services = d.services?.length ? d.services : null;
    const live = String(o.phaseStatus || o.status || '').toUpperCase();
    const reschedulable = !live || ['PENDING', 'ORDER_PLACED', 'PICKUP_REQUESTED', 'PICKUP_ACCEPTED', 'ORDER_SERVICE_CONFIRMED', 'SERVICE_ACCEPTED'].includes(live);
    const FallbackIcon = tab === 'Pickup' ? Truck : tab === 'Enquiry' ? MessageCircle : Smartphone;
    const dateStr = jobDate(o.createdAt);
    const timeStr = jobTime(o.createdAt);
    return (
      <Pressable
        key={o.id}
        onPress={() => openOrder(o)}
        className="active:opacity-90"
        style={{
          flex: 1, marginBottom: 12, borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden',
          borderWidth: 1, borderColor: JOB_LINE, ...(jobRow ? { flexDirection: 'row' } : null),
        }}
      >
        <View
          className="items-center justify-center overflow-hidden"
          style={jobRow
            ? { width: 116, minHeight: 116, alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: JOB_LINE }
            : { aspectRatio: 1, backgroundColor: '#FFFFFF' }}
        >
          {d.image ? (
            <Image source={{ uri: d.image }} style={{ width: '76%', height: '76%' }} resizeMode="contain" />
          ) : (
            <FallbackIcon size={40} color={JOB_TEAL} />
          )}
          {/* Status ribbon, top-left corner. */}
          <View style={{ position: 'absolute', top: 0, left: 0, maxWidth: '78%', backgroundColor: ribbonColor(liveStatus), paddingHorizontal: 8, paddingVertical: 4, borderBottomRightRadius: 12 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' }} numberOfLines={1}>{humanizeStatus(liveStatus) || 'Unknown'}</Text>
          </View>
          {/* VIEW, bottom-right — the whole tile opens the details too. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: JOB_TEAL, borderRadius: 10,
              ...(jobRow ? { right: 6, bottom: 6, paddingHorizontal: 10, paddingVertical: 3 } : { right: 8, bottom: 8, paddingHorizontal: 14, paddingVertical: 5 }),
            }}
          >
            <Text style={{ color: JOB_TEAL, fontSize: jobRow ? 11 : 12, fontWeight: '800' }}>VIEW</Text>
          </View>
        </View>

        <View style={jobRow ? { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingBottom: 8 } : { paddingHorizontal: 8, paddingBottom: 8 }}>
          {/* Order number (left) · amount (right). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: JOB_TEAL }} numberOfLines={1}>{hashed(o.orderNumber) || '—'}</Text>
            <View style={{ marginLeft: 6, backgroundColor: JOB_TEAL, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }} numberOfLines={1}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '800', lineHeight: 16, color: '#111111' }} numberOfLines={2}>{title}</Text>
          {shopName ? <Text style={{ marginTop: 2, fontSize: 12, color: '#6B7280' }} numberOfLines={1}>{shopName}</Text> : null}
          {services ? (
            <Text style={{ marginTop: 1, fontSize: 11, color: '#6B7280' }} numberOfLines={1}>
              {services[0]}{services.length > 1 ? ` +${services.length - 1} more` : ''}
            </Text>
          ) : null}
          {/* Date left, time right. */}
          {dateStr || timeStr ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }} numberOfLines={1}>{dateStr}</Text>
              <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 6 }} numberOfLines={1}>{timeStr}</Text>
            </View>
          ) : null}
          {/* Actions (left) · call the shop (right). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            {tab === 'Service' ? (
              <>
                <JobAction icon={Clock} label="History" onPress={() => openTimeline(o)} />
                <JobAction icon={Receipt} label="Receipt" onPress={() => openReceipt(o)} />
                <JobAction icon={ReceiptText} label="Invoice" onPress={() => openInvoice(o)} disabled={String(o.status || '').toUpperCase() !== 'COMPLETED'} />
              </>
            ) : (
              <>
                <JobAction icon={MapPin} label="Track" onPress={() => openTimeline(o)} />
                {tab === 'Pickup' && reschedulable ? (
                  <JobAction icon={CalendarClock} label="Re-Schedule" onPress={() => onReschedule(o)} />
                ) : (
                  <JobAction icon={Receipt} label="Receipt" onPress={() => openReceipt(o)} />
                )}
              </>
            )}
            <View style={{ flex: 1 }} />
            {d.shopPhone ? (
              <JobAction icon={Phone} label={`Call ${shopName || 'shop'}`} onPress={() => Linking.openURL(`tel:${d.shopPhone}`)} />
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const canGoBack = navigation.canGoBack();

  // Buy module "My Orders" (opened from Buy with view: 'buy'): status chips over
  // compact order cards, Buy tab highlighted. Same live orders / filters as below.
  if (buyView) {
    const chips = [['ALL', 'All'], ['PENDING', 'In Progress'], ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled']];
    const fmtWhen = (v, withTime) => {
      const d = v ? new Date(v) : null;
      if (!d || Number.isNaN(d.getTime())) return '';
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      const today = new Date().toDateString() === d.toDateString();
      if (withTime && today) return `Today, ${time}`;
      const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return withTime ? `${date}, ${time}` : date;
    };
    const renderBuyRow = (o) => {
      const d = details[o.id] || {};
      const lines = buyLines(o);
      const name = (lines[0]?.title || d.name || o.payload?.title || 'Order') + (lines.length > 1 ? ` +${lines.length - 1} more` : '');
      const sc = commerceScope(o);
      const pill = sc === 'COMPLETED' ? { bg: '#E3F6EE', fg: '#01805A', text: 'Completed' }
        : sc === 'CANCELLED' ? { bg: '#FEEBEA', fg: '#F32C26', text: 'Cancelled' }
          : { bg: '#FFF4D6', fg: '#B57900', text: 'In Progress' };
      const whenText = sc === 'PENDING' ? `Ordered: ${fmtWhen(o.createdAt, true)}` : `${pill.text}: ${fmtWhen(o.updatedAt || o.createdAt, false)}`;
      return (
        <Pressable onPress={() => openOrder(o)} accessibilityRole="button" accessibilityLabel={`${o.orderNumber || ''} ${name}`} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#E8EAEE', backgroundColor: '#FFFFFF', shadowColor: '#111111', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
          <View style={{ width: 60, height: 72, borderRadius: 12, backgroundColor: '#F4F2FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {d.image ? <Image source={{ uri: d.image }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <ShoppingBag size={24} color={SQ.primary} />}
          </View>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: rf(13.5), fontWeight: '800', color: '#111111' }}>{o.orderNumber || 'Order'}</Text>
              <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: pill.bg }}>
                <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: pill.fg }}>{pill.text}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={{ marginTop: 3, fontSize: rf(13), color: '#111111' }}>{name}</Text>
            {Number(o.totalAmount) > 0 ? <Text style={{ marginTop: 2, fontSize: rf(16), fontWeight: '800', color: SQ.primary }}>₹{Number(o.totalAmount).toLocaleString('en-IN')}</Text> : null}
            <Text numberOfLines={1} style={{ marginTop: 3, fontSize: rf(11.5), color: '#606E87' }}>{whenText}</Text>
          </View>
          <ChevronRight size={20} color="#111111" style={{ marginLeft: 6 }} />
        </Pressable>
      );
    };
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <PageHeader
          title="My Orders"
          subtitle="Your buying orders"
          onBack={canGoBack ? () => navigation.goBack() : undefined}
          right={<HeaderIconButton icon={Bell} label="Notifications" onPress={() => navigation.navigate('Notifications')} badge={unread} badgeColor="#F32C26" />}
        />
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
            {chips.map(([k, label]) => {
              const on = sellFilter === k;
              return (
                <Pressable key={k} onPress={() => setSellFilter(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? SQ.primary : '#E8EAEE', backgroundColor: on ? SQ.primary : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: on ? '#FFFFFF' : '#111111' }}>{label} ({commerceCounts[k] ?? 0})</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        {loading ? (
          <View style={{ padding: 14 }}><SkeletonList count={4} /></View>
        ) : (
          <FlatList
            data={visibleItems}
            keyExtractor={(o) => String(o.id)}
            renderItem={({ item }) => renderBuyRow(item)}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 16, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={SQ.primary} colors={[SQ.primary]} />}
            ListEmptyComponent={<EmptyState title="No orders here" description="Your buy orders will show up here." />}
          />
        )}
        <StaticTabBar navigation={navigation} active="Buy" />
      </View>
    );
  }

  // Both lists use the Partner Jobs / Notifications layout: a fixed status rail
  // on the left, the order cards scrolling on the right. Repair Orders shows
  // job tiles (2 columns on wide screens); My Orders keeps its Buy / Sell cards.
  {
    const railW = screenW >= 680 ? 104 : screenW < 360 ? 70 : 78;
    const numCols = isRepairList && screenW - railW >= 680 ? 2 : 1;
    const rz = jobRailSizes(screenW);
    const scopes = isRepairList ? REPAIR_SCOPES : COMMERCE_SCOPES;
    const current = isRepairList ? scope : sellFilter;
    const setCurrent = isRepairList ? setScope : setSellFilter;
    const counts = isRepairList ? repairCounts : commerceCounts;
    const shownCount = counts[current] ?? 0;
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {/* White header: back · centred eyebrow + count · notifications (Partner Jobs). */}
        <View style={{ backgroundColor: '#FFFFFF', paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: JOB_LINE }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {canGoBack ? (
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Back"
                className="h-9 w-9 rounded-full items-center justify-center mr-2.5 active:opacity-70"
                style={{ backgroundColor: '#F3F4F6' }}
              >
                <ArrowLeft size={19} color="#111111" />
              </Pressable>
            ) : <View style={{ height: 36, width: 36 }} />}
            {/* Title block centred on the screen, padded clear of the buttons. */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -4, bottom: -4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 60 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#6B7280', textAlign: 'center' }} numberOfLines={1}>{tab.toUpperCase()}</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#111111', marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
                {shownCount} {shownCount === 1 ? 'Order' : 'Orders'}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              className="h-9 w-9 rounded-full items-center justify-center active:opacity-80"
              style={{ backgroundColor: JOB_MINT }}
            >
              <Bell size={16} color={JOB_TEAL} />
              {unread > 0 ? (
                <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F32C26', borderWidth: 1.5, borderColor: '#FFFFFF' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Service / Pickup / Enquiry switch (kept from the old screen). */}
        <View style={{ paddingTop: 8, borderBottomWidth: 1, borderBottomColor: JOB_LINE }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6 }}>
            {shownTabs.map((t) => (
              <TabPill key={t.key} tab={t} active={tab === t.key} onPress={() => setTab(t.key)} />
            ))}
          </ScrollView>
        </View>

        {/* Left: status rail · Right: orders list. */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <ScrollView
            style={{ width: railW, flexGrow: 0, borderRightWidth: 1, borderRightColor: JOB_LINE, backgroundColor: '#FFFFFF' }}
            contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 5, paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {scopes.map((s) => {
              const Icon = s.icon;
              const active = current === s.key;
              const tone = s.tone;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setCurrent(s.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${s.label}, ${counts[s.key] ?? 0}`}
                  className="active:opacity-80"
                  style={{
                    marginVertical: 4, borderRadius: 14, backgroundColor: '#FFFFFF',
                    shadowColor: tone, shadowOpacity: active ? 0.12 : 0.06, shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 }, elevation: active ? 2 : 1,
                  }}
                >
                  {/* White at the top fading to a light tint of the tile's colour. */}
                  <LinearGradient
                    colors={['#FFFFFF', `${tone}${active ? '24' : '10'}`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      alignItems: 'center', paddingVertical: 9, paddingHorizontal: 3, borderRadius: 14,
                      borderWidth: active ? 1.5 : 1, borderColor: active ? tone : `${tone}22`,
                    }}
                  >
                    <View>
                      <View style={{ width: rz.disc, height: rz.disc, borderRadius: rz.disc / 2, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={rz.icon} color="#FFFFFF" strokeWidth={2.2} />
                      </View>
                      <View style={{ position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tone, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: rz.badge, fontWeight: '800', color: tone }} numberOfLines={1}>{counts[s.key] ?? 0}</Text>
                      </View>
                    </View>
                    <Text
                      style={{ marginTop: 5, fontSize: rz.font, lineHeight: rz.line, fontWeight: active ? '800' : '700', color: tone, textAlign: 'center' }}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {s.label}
                    </Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flex: 1 }}>
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
            ) : (
              <FlatList
                data={visibleItems}
                key={numCols}
                numColumns={numCols}
                columnWrapperStyle={numCols > 1 ? { gap: 12 } : undefined}
                keyExtractor={(o) => o.id}
                renderItem={({ item }) => (isRepairList ? renderJobTile(item) : renderCard(item))}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={JOB_TEAL} colors={[JOB_TEAL]} />}
                contentContainerStyle={{
                  paddingHorizontal: 10, paddingTop: 10, paddingBottom: insets.bottom + 16,
                  ...(numCols === 1 ? { width: '100%', maxWidth: 720, alignSelf: 'center' } : null),
                  ...(visibleItems.length === 0 ? { flexGrow: 1 } : null),
                }}
                ListFooterComponent={tab === 'Enquiry' ? <EnquiryNearbyShops navigation={navigation} /> : null}
                ListEmptyComponent={(
                  <EmptyState
                    icon={<Package size={36} color={JOB_TEAL} />}
                    accentSoft={JOB_MINT}
                    title={current === 'ALL' ? `No ${tab.toLowerCase()} orders` : `No ${scopes.find((x) => x.key === current)?.label.toLowerCase()} ${tab.toLowerCase()} orders`}
                    description={current === 'ALL' ? `You don't have any ${tab.toLowerCase()} orders yet.` : 'Try another status on the left.'}
                  />
                )}
                removeClippedSubviews
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={7}
              />
            )}
          </View>
        </View>
      </View>
    );
  }
}
