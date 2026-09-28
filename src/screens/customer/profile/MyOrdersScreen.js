import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, Pressable, ScrollView, Text, View, FlatList, RefreshControl, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  FileText, Clock, Receipt, Package, Truck, MessageCircle,
  ShoppingBag, Tag, Wrench, Store, CheckCircle2, ReceiptText,
  ChevronRight, CalendarClock, IndianRupee, ArrowLeft, Bell, Settings, CalendarDays, MapPin, XCircle,
} from 'lucide-react-native';
import {
  ScreenContainer, SkeletonList, EmptyState, ErrorState, Chip, StatusChip,
  Card,
} from '../../../components/rnr';
import { tokens } from '../../../theme/colors';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';
import { listMyOrders, getRepairBooking, getSellOrder } from '../../../api/orders';
import { getShop } from '../../../api/shops';
import { getUnreadCount } from '../../../api/notifications';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { cleanIssueSummary } from '../../../utils/pickupEstimateMeta';
import { rf } from '../../../utils/responsive';

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

const STATUS_OPTIONS = [
  { value: 'Pending',   label: 'Active'    },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const hashed = (n) => (n ? (String(n).startsWith('#') ? n : `#${n}`) : '');

const HAIRLINE = '#E8EEEC';

function TabPill({ tab, active, onPress }) {
  const Icon = tab.icon;
  return (
    <Pressable onPress={onPress} className="active:opacity-85">
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, height: 44,
          borderRadius: 22, marginRight: 8,
          backgroundColor: active ? GREEN : '#fff',
          borderWidth: 1, borderColor: active ? GREEN : '#E3EAEC',
          shadowColor: '#0F172A', shadowOpacity: active ? 0.12 : 0.04, shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 }, elevation: active ? 3 : 1,
        }}
      >
        <Icon size={17} color={active ? '#fff' : tokens.text} />
        <Text
          style={{
            marginLeft: 7, fontSize: rf(13.5), fontWeight: '800',
            color: active ? '#fff' : tokens.text,
          }}
        >
          {tab.label}
        </Text>
      </View>
    </Pressable>
  );
}

// Active / Completed / Cancelled — soft pills. The selected filter shows how
// many orders it currently lists (`count`, from the loaded list); the others
// aren't fetched, so they show no number rather than a made-up one.
function StatusFilter({ options, value, onChange, count }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className="active:opacity-85"
            style={{
              flexDirection: 'row', alignItems: 'center',
              height: 40, paddingHorizontal: 18, borderRadius: 20, marginRight: 8,
              backgroundColor: active ? '#ECFAF3' : '#EEF2F3',
              borderWidth: 1.5, borderColor: active ? '#0B6B57' : 'transparent',
            }}
          >
            <Text style={{ fontSize: rf(13.5), fontWeight: '700', color: active ? GREEN : '#64748B' }}>
              {o.label}{active && count != null ? ` (${count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ActionRow({ children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      {children}
    </View>
  );
}

// Compact inline action: icon + label, separated by thin vertical dividers.
function ActionBtn({ icon: Icon, label, color, onPress, disabled, withDivider, compact }) {
  return (
    <>
      {withDivider ? <View style={{ width: 1, height: 26, backgroundColor: HAIRLINE }} /> : null}
      <Pressable
        disabled={disabled}
        onPress={onPress}
        className={disabled ? '' : 'active:opacity-60'}
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          height: 36, opacity: disabled ? 0.4 : 1, paddingHorizontal: 2,
        }}
      >
        <Icon size={compact ? 16 : 17} color={color} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{ marginLeft: compact ? 5 : 7, fontWeight: '700', fontSize: rf(compact ? 12 : 13), color }}
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
  green:  { bg: '#DDF7EA', fg: '#047857', icon: CheckCircle2 },
  orange: { bg: '#FFF1E7', fg: '#EA580C', icon: Clock },
  blue:   { bg: '#EAF3FF', fg: '#2563EB', icon: Wrench },
  pickup: { bg: '#EAF3FF', fg: '#2563EB', icon: Truck },
  red:    { bg: '#FFE5E7', fg: '#DC2626', icon: XCircle },
  grey:   { bg: '#EEF2F3', fg: '#64748B', icon: Clock },
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
function OrderStatusPill({ status }) {
  const t = PILL[pillTone(status)];
  const Icon = t.icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 1 }}>
      <Icon size={14} color={t.fg} />
      <Text numberOfLines={1} style={{ marginLeft: 5, color: t.fg, fontWeight: '700', fontSize: rf(11.5), flexShrink: 1 }}>
        {humanizeStatus(status) || 'Unknown'}
      </Text>
    </View>
  );
}

function SpecChip({ label }) {
  return (
    <View style={{ backgroundColor: '#F1F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginTop: 6 }}>
      <Text numberOfLines={1} style={{ color: '#334155', fontSize: rf(11), fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

export default function MyOrdersScreen({ navigation, route }) {
  const presetTab = route?.params?.initialTab;
  const { width: screenW } = useWindowDimensions();
  const presetStatus = route?.params?.initialStatus;

  const [tab, setTab] = useState(presetTab || 'Service');
  const [status, setStatus] = useState(presetStatus || 'Pending');
  const [items, setItems] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const enrichedCache = useRef(new Map());
  const masterCache = useRef(null);
  const modelsByBrand = useRef(new Map());
  const shopCache = useRef(new Map());

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const types = TAB_ORDER_TYPES[tab] || [TAB_MAP[tab]];
      const lists = await Promise.all(types.map((t) => listMyOrders({ orderType: t, status })));
      const byId = {};
      lists.flat().forEach((o) => { if (o && o.id) byId[o.id] = o; });
      const merged = Object.values(byId).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
      setItems(merged);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, status]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Unread badge on the header bell (same source as Home / Profile).
  const [unread, setUnread] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    getUnreadCount().then((n) => { if (alive) setUnread(Number(n) || 0); }).catch(() => {});
    return () => { alive = false; };
  }, []));

  useEffect(() => {
    if (!items.length || !(REPAIR_TABS.has(tab) || tab === 'Sell')) { setDetails({}); return undefined; }
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
        if (tab === 'Sell') {
          const ref = o.referenceId || o.payload?.sellOrderId;
          if (!ref) return null;
          const cacheKey = `sell:${ref}`;
          if (enrichedCache.current.has(cacheKey)) return enrichedCache.current.get(cacheKey);
          const so = await getSellOrder(ref).catch(() => null);
          if (!so) { enrichedCache.current.set(cacheKey, null); return null; }
          const model = await modelFor(so.brandId, so.modelId);
          const brandName = brandById[so.brandId]?.name;
          const ramStorage = [ramById[so.ramOptionId]?.label, storageById[so.storageOptionId]?.label].filter(Boolean).join(' / ');
          const rec = {
            name: model?.name || (brandName ? `${brandName} device` : 'Sell Device'),
            image: modelImg(model),
            specs: [brandName, so.color, ramStorage].filter(Boolean).join(' · '),
            brand: brandName || null,
            chips: [ramById[so.ramOptionId]?.label, storageById[so.storageOptionId]?.label, so.color].filter(Boolean),
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
        const cacheKey = tab === 'Sell' ? `sell:${ref}` : `bk:${ref || o.id}`;
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
  }, [items, tab]);

  const visibleItems = items;

  const openOrder = (o) => {
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
    const title = d.name || p.deviceName || p.title || o.orderType;
    const liveStatus = ((tab === 'Service' || tab === 'Pickup') && o.phaseLabel) ? o.phaseLabel : o.status;
    const showActions = tab !== 'Sell';
    const imgBox = 84;
    // The status pill sits beside the title (reference) when both fit; a long
    // title or label (e.g. "Waiting For Customer Approval") moves the pill to
    // its own line so neither is squeezed or cut.
    const longStatus = String(title || '').length + humanizeStatus(liveStatus).length > (screenW < 380 ? 21 : 25);

    return (
      <Pressable
        key={o.id}
        onPress={() => openOrder(o)}
        className="active:opacity-90"
        style={{
          backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2ECE7', marginBottom: 14,
          borderRadius: 24, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 }, elevation: 3,
        }}
      >
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View
              style={{
                height: imgBox, width: imgBox, borderRadius: 18, marginRight: 12,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                backgroundColor: d.image ? '#EEF5FB' : tokens.primarySoft,
              }}
            >
              {d.image ? (
                <Image source={{ uri: d.image }} style={{ width: imgBox - 10, height: imgBox - 10 }} resizeMode="contain" />
              ) : (
                <TabIcon size={28} color={tokens.primary} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text className="font-extrabold text-text" style={{ flex: 1, fontSize: rf(17), marginTop: 2, paddingRight: 6 }} numberOfLines={2}>
                  {title}
                </Text>
                {longStatus ? null : <OrderStatusPill status={liveStatus} />}
                <ChevronRight size={17} color="#64748B" style={{ marginLeft: 4, marginTop: 5 }} />
              </View>
              {longStatus ? (
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <OrderStatusPill status={liveStatus} />
                </View>
              ) : null}
              <Text className="text-text-muted" style={{ fontSize: rf(12.5), marginTop: 4 }} numberOfLines={1}>
                {hashed(o.orderNumber)}{d.brand ? `  ·  ${d.brand}` : (!d.chips && d.specs ? `  ·  ${d.specs}` : '')}
              </Text>
              {(d.chips?.length || (tab === 'Service' && d.services?.length)) ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(d.chips || []).map((c) => <SpecChip key={c} label={c} />)}
                  {tab === 'Service' && d.services?.length ? <SpecChip label={`${d.services.length} Part(s)`} /> : null}
                </View>
              ) : null}
            </View>
          </View>

          {d.services?.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
              <Settings size={15} color="#64748B" style={{ marginTop: 1 }} />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
                <Text className="font-extrabold text-text-muted uppercase" style={{ fontSize: rf(10), letterSpacing: 1.2 }}>Booked Services</Text>
                {d.services.slice(0, 3).map((s, i) => (
                  <Text key={i} className="text-text" style={{ fontSize: rf(12.5), marginTop: 3 }} numberOfLines={1}>{i + 1}. {s}</Text>
                ))}
                {d.services.length > 3 ? (
                  <Text className="text-primary mt-1 font-bold" style={{ fontSize: rf(11) }}>+ {d.services.length - 3} more</Text>
                ) : null}
              </View>
            </View>
          ) : d.issueSummary && tab !== 'Service' ? (
            <Text className="text-text-muted" style={{ fontSize: rf(12), marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: HAIRLINE }} numberOfLines={2}>
              {d.issueSummary}
            </Text>
          ) : null}

          {/* Shop / provider on the left, order date + time on the right. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start' }}>
              {(d.shopName || p.shopName) ? (
                <>
                  <Store size={19} color={tokens.primary} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 9 }}>
                    <Text className="font-bold text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{d.shopName || p.shopName}</Text>
                    {d.shopAddress ? (
                      <Text className="text-text-muted" style={{ fontSize: rf(11.5), marginTop: 2, lineHeight: rf(16) }} numberOfLines={2}>{d.shopAddress}</Text>
                    ) : null}
                  </View>
                </>
              ) : null}
              {o.totalAmount != null && Number(o.totalAmount) > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: (d.shopName || p.shopName) ? 8 : 0, marginTop: 1 }}>
                  <IndianRupee size={14} color={tokens.primary} />
                  <Text className="font-extrabold text-primary" style={{ fontSize: rf(14.5) }}>{Number(o.totalAmount).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
            </View>
            {o.createdAt ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', borderLeftWidth: 1, borderLeftColor: HAIRLINE, paddingLeft: 10, marginLeft: 8 }}>
                <CalendarDays size={17} color={tokens.primary} style={{ marginTop: 1 }} />
                <View style={{ marginLeft: 6 }}>
                  <Text className="text-text" style={{ fontSize: rf(12) }}>
                    {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  <Text className="text-text-muted" style={{ fontSize: rf(11.5), marginTop: 2 }}>
                    {new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {showActions ? (
            tab === 'Service' ? (
              <ActionRow>
                <ActionBtn compact icon={FileText} label="Details" color={tokens.primary} onPress={() => openOrder(o)} />
                <ActionBtn compact icon={Clock} label="History" color={tokens.accent} onPress={() => openTimeline(o)} withDivider />
                <ActionBtn compact icon={Receipt} label="Receipt" color={tokens.primary} onPress={() => openReceipt(o)} withDivider />
                <ActionBtn
                  compact
                  icon={ReceiptText}
                  label="Invoice"
                  color={tokens.primary}
                  onPress={() => openInvoice(o)}
                  disabled={String(o.status || '').toUpperCase() !== 'COMPLETED'}
                  withDivider
                />
              </ActionRow>
            ) : (
              <ActionRow>
                <ActionBtn icon={FileText} label="Details" color={tokens.primary} onPress={() => openOrder(o)} />
                <ActionBtn icon={MapPin} label={tab === 'Pickup' ? 'Track' : 'Track'} color={tokens.primary} onPress={() => openTimeline(o)} withDivider />
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
                    <ActionBtn icon={CalendarClock} label="Re-Schedule" color={tokens.accent} onPress={() => onReschedule(o)} withDivider />
                  ) : (
                    <ActionBtn icon={Receipt} label="Receipt" color={tokens.primary} onPress={() => openReceipt(o)} withDivider />
                  );
                })() : (
                  <ActionBtn icon={Receipt} label="Receipt" color={tokens.primary} onPress={() => (REPAIR_TABS.has(tab) ? openReceipt(o) : openOrder(o))} withDivider />
                )}
              </ActionRow>
            )
          ) : (
            <View className="flex-row items-center justify-end mt-2">
              <Text className="font-bold text-primary mr-1" style={{ fontSize: rf(11) }}>View Details</Text>
              <ChevronRight size={14} color={tokens.primary} />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const canGoBack = navigation.canGoBack();

  return (
    <ScreenContainer edges={[]}>
      <LinearGradient
        colors={[GREEN_DARK, GREEN, '#0B6B57']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ overflow: 'hidden' }}
      >
        {/* Soft organic curves behind the title. */}
        <View pointerEvents="none" style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, left: -170, top: -120, backgroundColor: 'rgba(0,168,107,0.18)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, right: -150, top: -170, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 42, flexDirection: 'row', alignItems: 'center' }}>
            {canGoBack ? (
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityLabel="Back"
                className="active:opacity-80"
                style={{
                  height: 46, width: 46, borderRadius: 23,
                  backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <ArrowLeft size={21} color="#fff" />
              </Pressable>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: rf(12), fontWeight: '800', letterSpacing: 1.6 }}>
                MY ORDERS
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ color: '#fff', fontSize: rf(21), fontWeight: '800', marginTop: 2, letterSpacing: -0.4 }}>
                Bookings & purchases
              </Text>
              <Text numberOfLines={2} style={{ color: 'rgba(236,253,245,0.88)', fontSize: rf(11.5), lineHeight: rf(15), marginTop: 3 }}>
                Track all your service, pickup, buy and sell orders
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
              className="active:opacity-80"
              style={{
                height: 46, width: 46, borderRadius: 23,
                backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bell size={21} color="#fff" />
              {unread > 0 ? (
                <View
                  style={{
                    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
                    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: GREEN, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: rf(9.5), fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* White sheet with rounded top corners overlapping the hero. */}
      <View style={{ backgroundColor: '#FAFCFB', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingTop: 14 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
        >
          {TABS.map((t) => (
            <TabPill key={t.key} tab={t} active={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>
        <StatusFilter
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          count={loading || error ? null : visibleItems.length}
        />
      </View>

      {loading ? (
        <SkeletonList rows={5} rowHeight={150} />
      ) : error ? (
        <ErrorState description={error} onRetry={() => load()} />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={<Package size={36} color={tokens.primary} />}
          title={`No ${tab.toLowerCase()} orders`}
          description={`You don't have any ${status.toLowerCase()} ${tab.toLowerCase()} orders yet.`}
        />
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(o) => o.id}
          style={{ backgroundColor: '#FAFCFB' }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.primary} />}
          renderItem={({ item }) => renderCard(item)}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
        />
      )}
    </ScreenContainer>
  );
}
