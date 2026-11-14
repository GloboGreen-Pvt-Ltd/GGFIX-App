import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell, PackageCheck, Tag, ShieldCheck, CheckCircle2,
} from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../../../api/notifications';
import { listMyOrders } from '../../../api/orders';
import { rf, rlh } from '../../../utils/responsive';
import PageHeader from '../../../components/PageHeader';
import { BRAND } from '../../../theme/brand';

// Notifications in the Partner Jobs visual design: a fixed rail of filter
// tiles on the left (colour disc, count badge, tinted border, selected
// highlight) and Jobs-style cards scrolling on the right. Types, messages,
// unread state, APIs and navigation are unchanged.
const TEAL = '#035C6C';
const NAVY = '#1C3053';
const BLUE = '#0788C9';
const ORANGE = '#FAA700';
const RED = '#F32C26';
const LINE = '#E5E7EB';   // Partner card / rail border
const MUTED = '#606E87';

const FILTERS = [
  { key: 'All', icon: Bell, tone: TEAL },
  { key: 'Orders', icon: PackageCheck, tone: BLUE },
  { key: 'Offers', icon: Tag, tone: ORANGE },
  { key: 'System', icon: ShieldCheck, tone: NAVY },
];

const META_BY_TYPE = {
  orders: { icon: PackageCheck, tone: BLUE, label: 'Orders' },
  offers: { icon: Tag, tone: ORANGE, label: 'Offers' },
  system: { icon: ShieldCheck, tone: NAVY, label: 'System' },
};

const ago = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return 'Yesterday';
  return d.toLocaleDateString();
};

// Rail geometry — the Partner Jobs numbers (components/report/ReportRail).
function railSizes(winW) {
  if (winW < 360) return { font: 9.5, line: 12, disc: 30, icon: 14, badge: 9 };
  if (winW < 400) return { font: 10.5, line: 13, disc: 34, icon: 16, badge: 9 };
  if (winW < 600) return { font: 11, line: 14, disc: 34, icon: 16, badge: 9.5 };
  if (winW < 900) return { font: 12, line: 15, disc: 38, icon: 17, badge: 10 };
  return { font: 13, line: 16, disc: 40, icon: 18, badge: 10.5 };
}

function NotifHeader({ navigation, unreadCount, total }) {
  return (
    <PageHeader
      title="Notifications"
      subtitle={total
        ? `${unreadCount ? `${unreadCount} unread` : 'All read'} · ${total} total`
        : 'Stay in the loop'}
      onBack={() => navigation.goBack()}
    />
  );
}

// Partner Jobs rail tile: white fading to a tint of the filter colour, a solid
// colour disc with a white icon, a count badge, the label underneath.
function RailTile({ filter, count, active, sizes, onPress }) {
  const { key, icon: Icon, tone } = filter;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${key}, ${count}`}
      className="active:opacity-80"
      style={{
        marginVertical: 4, borderRadius: 8, backgroundColor: '#FFFFFF',
        shadowOpacity: 0, elevation: 0,
      }}
    >
      <LinearGradient
        colors={active ? ['#E5F3F5', '#E5F3F5'] : ['#FFFFFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ alignItems: 'center', paddingVertical: 9, paddingHorizontal: 3, borderRadius: 8, borderWidth: active ? 2 : 1, borderColor: active ? '#035C6C' : '#E5E7EB', backgroundColor: active ? '#E5F3F5' : '#FFFFFF' }}
      >
        <View>
          <View style={{ width: sizes.disc, height: sizes.disc, borderRadius: sizes.disc / 2, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={sizes.icon} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tone, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: sizes.badge, fontWeight: '800', color: tone }} numberOfLines={1}>{count}</Text>
          </View>
        </View>
        <Text
          style={{ marginTop: 5, fontSize: sizes.font, lineHeight: sizes.line, fontWeight: active ? '800' : '700', color: active ? '#035C6C' : '#111111', textAlign: 'center' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {key}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

export default function NotificationsScreen({ navigation }) {
  const { width: winW } = useWindowDimensions();
  const [filter, setFilter] = useState('All');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await listNotifications()); } catch (_) { setItems([]); }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => { await load(); if (active) setLoading(false); })();
    return () => { active = false; };
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onOpen = async (n) => {
    if (!n.read) {
      try { await markNotificationRead(n.id); } catch (_) {}
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    openNotificationTarget(n);
  };

  // Open the page the notification is about (bookingId is the record's id):
  // sell quotes → Quotations Received; a revised (final) price → Final Price
  // Request; other sell updates → Sell Device Details;
  // a buy order (ORDER_PLACED carries only its order number) → Order Details;
  // anything else with a bookingId is a repair booking.
  const openNotificationTarget = async (n) => {
    const key = String(n.statusKey || '').toUpperCase();
    if (key.startsWith('SELL_')) {
      if (!n.bookingId) return navigation.navigate('MyOrders', { initialTab: 'Sell' });
      if (key === 'SELL_QUOTE' || key === 'SELL_QUOTE_UPDATED') return navigation.navigate('SellQuotesReceived', { sellOrderId: n.bookingId });
      if (key === 'SELL_PRICE_REVISED') return navigation.navigate('SellFinalOffer', { sellOrderId: n.bookingId });
      return navigation.navigate('SellOrderDetails', { sellOrderId: n.bookingId });
    }
    if (key === 'ORDER_PLACED' && !n.bookingId) {
      const no = String(n.bookingNumber || '').replace(/^#+/, '');
      const rows = no ? await listMyOrders({ orderType: 'BUY' }).catch(() => []) : [];
      const o = (rows || []).find((r) => String(r.orderNumber || '').replace(/^#+/, '') === no);
      return o?.id ? navigation.navigate('BuyOrderDetails', { orderId: o.id }) : navigation.navigate('MyOrders', { initialTab: 'Buy', view: 'buy' });
    }
    if (n.bookingId) navigation.navigate('RepairOrderDetails', { bookingId: n.bookingId, fromOrders: true });
  };

  const onMarkAll = async () => {
    try { await markAllNotificationsRead(); } catch (_) {}
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  const unreadCount = items.filter((x) => !x.read).length;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <NotifHeader navigation={navigation} unreadCount={0} total={0} />
        <Loader label="Loading notifications..." />
      </View>
    );
  }

  const typeOf = (m) => (m.type || 'orders');
  const counts = {
    All: items.length,
    Orders: items.filter((m) => typeOf(m) === 'orders').length,
    Offers: items.filter((m) => typeOf(m) === 'offers').length,
    System: items.filter((m) => typeOf(m) === 'system').length,
  };
  const visible = items.filter((m) => {
    if (filter === 'All') return true;
    return typeOf(m) === filter.toLowerCase();
  });

  // ---- layout: Partner Jobs proportions ----
  const sizes = railSizes(winW);
  const railW = winW >= 680 ? 104 : (winW < 360 ? 70 : 78);
  const numCols = winW >= 680 ? 2 : 1;
  const colGap = 10;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <NotifHeader navigation={navigation} unreadCount={unreadCount} total={items.length} />

      <View style={{ flex: 1 }}>
        {/* Top: filter tiles in one row. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 }}>
          {FILTERS.map((f, i) => (
            <View key={f.key} style={{ flex: 1, minWidth: 72, marginLeft: i ? 6 : 0 }}>
              <RailTile filter={f} count={counts[f.key] ?? 0} active={filter === f.key} sizes={sizes} onPress={() => setFilter(f.key)} />
            </View>
          ))}
        </ScrollView>

        {/* Right: notification cards */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 32, flexGrow: 1, ...(numCols === 1 ? { width: '100%', maxWidth: 720, alignSelf: 'center' } : null) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} colors={[TEAL]} />}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: rf(12), color: MUTED, fontWeight: '700' }}>
              {visible.length} notification{visible.length === 1 ? '' : 's'}
            </Text>
            {unreadCount > 0 ? (
              <Pressable onPress={onMarkAll} hitSlop={8} accessibilityRole="button" className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CheckCircle2 size={14} color={TEAL} />
                <Text style={{ fontSize: rf(12), fontWeight: '800', color: TEAL, marginLeft: 4 }}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Bell size={28} color={TEAL} />}
              accent={TEAL}
              accentSoft="#E5F3F5"
              title="You're all caught up"
              description="We'll ping you when something new happens with your bookings."
            />
          ) : (
            <View style={numCols === 2 ? { flexDirection: 'row', flexWrap: 'wrap', columnGap: colGap } : null}>
              {visible.map((n) => {
                const meta = META_BY_TYPE[n.type] || META_BY_TYPE.orders;
                const Icon = meta.icon;
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => onOpen(n)}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}`}
                    className="active:opacity-90"
                    style={{
                      width: numCols === 2 ? `${(100 - 2) / 2}%` : '100%',
                      flexDirection: 'row', marginBottom: 10, borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden',
                      borderWidth: 1, borderColor: n.read ? LINE : `${meta.tone}66`,
                      shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
                    }}
                  >
                    {/* Left panel (Jobs card image panel): the type's colour disc. */}
                    <View style={{ width: 58, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10, backgroundColor: `${meta.tone}10`, borderRightWidth: 1, borderRightColor: LINE }}>
                      <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: meta.tone, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} color="#FFFFFF" strokeWidth={2.2} />
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: rf(13), fontWeight: '800', color: NAVY }}>
                          {n.title}
                        </Text>
                        {!n.read ? (
                          <View style={{ backgroundColor: 'rgba(243,44,38,0.10)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 }}>
                            <Text style={{ color: RED, fontSize: rf(9), fontWeight: '800', letterSpacing: 0.4 }}>NEW</Text>
                          </View>
                        ) : null}
                      </View>
                      {n.body ? (
                        <Text numberOfLines={2} style={{ fontSize: rf(11.5), color: MUTED, marginTop: 3, lineHeight: rlh(16) }}>
                          {n.body}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <View style={{ backgroundColor: `${meta.tone}14`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 }}>
                          <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: meta.tone }}>{meta.label}</Text>
                        </View>
                        <Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', fontSize: rf(10.5), color: 'rgba(17,17,17,0.5)' }}>
                          {ago(n.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
