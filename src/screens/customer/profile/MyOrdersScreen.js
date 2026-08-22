import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, Pressable, ScrollView, Text, View, FlatList, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  FileText, Clock, Receipt, Package, Truck, MessageCircle,
  ShoppingBag, Tag, Wrench, Store, CheckCircle2, ReceiptText,
  ChevronRight, CalendarClock, IndianRupee, ArrowLeft, Bell,
} from 'lucide-react-native';
import {
  ScreenContainer, SkeletonList, EmptyState, ErrorState, Chip, StatusChip,
  Card, FilterChipRow,
} from '../../../components/rnr';
import { tokens } from '../../../theme/colors';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';
import { listMyOrders, getRepairBooking, getSellOrder } from '../../../api/orders';
import { getShop } from '../../../api/shops';
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

function TabPill({ tab, active, onPress }) {
  const Icon = tab.icon;
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 14, paddingVertical: 8,
          borderRadius: 999, marginRight: 8,
          backgroundColor: active ? GREEN : '#fff',
          borderWidth: 1, borderColor: active ? GREEN : '#E5E7EB',
        }}
      >
        <Icon size={14} color={active ? '#fff' : tokens.text} />
        <Text
          style={{
            marginLeft: 6, fontSize: rf(12), fontWeight: '800',
            color: active ? '#fff' : tokens.text,
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
    <View className="flex-row mt-3 pt-3 border-t border-border">
      {children}
    </View>
  );
}

function ActionBtn({ icon: Icon, label, color, onPress, disabled, withDivider }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center py-1.5 ${withDivider ? 'border-l border-border' : ''} ${disabled ? 'opacity-40' : 'active:opacity-70'}`}
    >
      <Icon size={12} color={color} />
      <Text className="ml-1 font-bold" style={{ fontSize: rf(11), color }}>{label}</Text>
    </Pressable>
  );
}

export default function MyOrdersScreen({ navigation, route }) {
  const presetTab = route?.params?.initialTab;
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

    return (
      <Pressable
        key={o.id}
        onPress={() => openOrder(o)}
        className="bg-card border border-border mb-3 active:opacity-90"
        style={{ borderRadius: 18, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}
      >
        <View className="p-4">
          <View className="flex-row items-start">
            <View className={`h-12 w-12 rounded-2xl items-center justify-center overflow-hidden mr-3 ${d.image ? 'bg-surface-muted' : 'bg-primary-soft'}`}>
              {d.image ? (
                <Image source={{ uri: d.image }} style={{ width: 48, height: 48 }} resizeMode="cover" />
              ) : (
                <TabIcon size={20} color={tokens.primary} />
              )}
            </View>
            <View className="flex-1 pr-2">
              <Text className="font-extrabold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>{title}</Text>
              <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }} numberOfLines={1}>
                {hashed(o.orderNumber)}{d.specs ? ` · ${d.specs}` : ''}
              </Text>
              {tab === 'Service' && d.services?.length ? (
                <View className="self-start mt-1.5 px-2 py-0.5 rounded-full bg-primary-soft">
                  <Text className="font-extrabold text-primary-dark" style={{ fontSize: rf(10) }}>{d.services.length} Part(s)</Text>
                </View>
              ) : null}
            </View>
            <StatusChip status={liveStatus} size="sm" />
          </View>

          {d.services?.length ? (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="font-extrabold text-text-muted uppercase tracking-widest" style={{ fontSize: rf(10.5) }}>Booked Services</Text>
              {d.services.slice(0, 3).map((s, i) => (
                <Text key={i} className="text-text mt-1" style={{ fontSize: rf(12) }} numberOfLines={1}>{i + 1}. {s}</Text>
              ))}
              {d.services.length > 3 ? (
                <Text className="text-primary mt-1 font-bold" style={{ fontSize: rf(11) }}>+ {d.services.length - 3} more</Text>
              ) : null}
            </View>
          ) : d.issueSummary && tab !== 'Service' ? (
            <Text className="text-text-muted mt-3 pt-3 border-t border-border" style={{ fontSize: rf(12) }} numberOfLines={2}>
              {d.issueSummary}
            </Text>
          ) : null}

          {(d.shopName || p.shopName) ? (
            <View className="mt-3 pt-3 border-t border-border">
              <View className="flex-row items-center">
                <Store size={13} color={tokens.primary} />
                <Text className="font-extrabold text-text ml-1.5 flex-1" style={{ fontSize: rf(12.5) }} numberOfLines={1}>{d.shopName || p.shopName}</Text>
              </View>
              {d.shopAddress ? (
                <Text className="text-text-muted mt-1" style={{ fontSize: rf(11) }} numberOfLines={2}>{d.shopAddress}</Text>
              ) : null}
            </View>
          ) : null}

          <View className="flex-row items-center justify-between mt-3">
            <View className="flex-row items-center">
              {o.totalAmount != null && Number(o.totalAmount) > 0 ? (
                <>
                  <IndianRupee size={14} color={tokens.primary} />
                  <Text className="font-extrabold text-primary" style={{ fontSize: rf(15) }}>{Number(o.totalAmount).toLocaleString('en-IN')}</Text>
                </>
              ) : <View />}
            </View>
            <Text className="text-text-subtle" style={{ fontSize: rf(10.5) }}>
              {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
            </Text>
          </View>

          {showActions ? (
            tab === 'Service' ? (
              <ActionRow>
                <ActionBtn icon={FileText} label="Details" color={tokens.primary} onPress={() => openOrder(o)} />
                <ActionBtn icon={Clock} label="History" color={tokens.accent} onPress={() => openTimeline(o)} withDivider />
                <ActionBtn icon={Receipt} label="Receipt" color={tokens.primary} onPress={() => openReceipt(o)} withDivider />
                <ActionBtn
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
                <ActionBtn icon={Clock} label={tab === 'Pickup' ? 'Track' : 'Track'} color={tokens.accent} onPress={() => openTimeline(o)} withDivider />
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
      <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
        <LinearGradient
          colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 12,
            paddingBottom: 18,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            {canGoBack ? (
              <Pressable
                onPress={() => navigation.goBack()}
                style={{
                  height: 36, width: 36, borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <ArrowLeft size={18} color="#fff" />
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: rf(12.5), fontWeight: '800', letterSpacing: 0.6 }}>
                MY ORDERS
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: rf(19), fontWeight: '800', marginTop: 2, letterSpacing: -0.2 }}>
                Bookings & purchases
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              style={{
                height: 36, width: 36, borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bell size={18} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}
        >
          {TABS.map((t) => (
            <TabPill key={t.key} tab={t} active={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>
        <FilterChipRow
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          variant="soft"
          className="bg-card"
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
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
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
