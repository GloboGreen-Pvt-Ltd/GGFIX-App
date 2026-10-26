import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell, PackageCheck, Tag, ShieldCheck, CheckCircle2,
} from 'lucide-react-native';
import { EmptyState, Badge, Loader } from '../../../components/rnr';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../../../api/notifications';
import { rf, rlh } from '../../../utils/responsive';
import PageHeader from '../../../components/PageHeader';
import { BRAND } from '../../../theme/brand';

// Brand palette (09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141).
const GREEN = BRAND.green;
const GREEN_DARK = '#078F23'; // green text on white (#09AD2A shaded)
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const MUTED = '#6B6B6B';

const FILTERS = ['All', 'Orders', 'Offers', 'System'];

const META_BY_TYPE = {
  orders: { icon: PackageCheck, color: GREEN_DARK,   bg: MINT },
  offers: { icon: Tag,          color: BRAND.yellow, bg: '#FEF6DA' },
  system: { icon: ShieldCheck,  color: BRAND.ink,    bg: BRAND.line },
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

function NotifHeader({ navigation, unreadCount }) {
  return (
    <PageHeader
      title="Notifications"
      subtitle={unreadCount ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'Stay in the loop'}
      onBack={() => navigation.goBack()}
    />
  );
}


function FilterPill({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} className="active:opacity-80" accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View
        style={{
          paddingHorizontal: 13, paddingVertical: 7,
          borderRadius: 999, marginRight: 7,
          backgroundColor: active ? GREEN : '#fff',
          borderWidth: 1, borderColor: active ? GREEN : LINE,
        }}
      >
        <Text style={{ fontSize: rf(12), fontWeight: '800', color: active ? '#fff' : BRAND.ink }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen({ navigation }) {
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
        <NotifHeader navigation={navigation} unreadCount={0} />
        <Loader label="Loading notifications..." />
      </View>
    );
  }

  const visible = items.filter((m) => {
    if (filter === 'All') return true;
    return (m.type || 'orders') === filter.toLowerCase();
  });

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <NotifHeader navigation={navigation} unreadCount={unreadCount} />

      <View
        style={{
          backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: LINE,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10 }}
        >
          {FILTERS.map((f) => (
            <FilterPill key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </View>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} color={GREEN} />}
          accent={GREEN}
          accentSoft={MINT}
          title="You're all caught up"
          description="We'll ping you when something new happens with your bookings."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#09AD2A" colors={['#09AD2A']} />}
        >
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10, paddingHorizontal: 2,
            }}
          >
            <Text style={{ fontSize: rf(12), color: MUTED, fontWeight: '600' }}>
              {visible.length} notification{visible.length > 1 ? 's' : ''}
            </Text>
            {unreadCount > 0 ? (
              <Pressable onPress={onMarkAll} className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CheckCircle2 size={14} color={GREEN_DARK} />
                <Text style={{ fontSize: rf(12), fontWeight: '800', color: GREEN_DARK, marginLeft: 4 }}>
                  Mark all read
                </Text>
              </Pressable>
            ) : null}
          </View>

          {visible.map((n) => {
            const meta = META_BY_TYPE[n.type] || META_BY_TYPE.orders;
            const Icon = meta.icon;
            return (
              <Pressable key={n.id} onPress={() => onOpen(n)} className="active:opacity-90">
                <View
                  style={{
                    backgroundColor: !n.read ? '#F7FCF8' : '#fff', borderRadius: 14,
                    padding: 11, marginBottom: 9,
                    borderWidth: 1,
                    borderColor: !n.read ? 'rgba(9,173,42,0.45)' : LINE,
                    shadowColor: BRAND.ink, shadowOpacity: 0.04,
                    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View
                      style={{
                        height: 36, width: 36, borderRadius: 18,
                        backgroundColor: meta.bg,
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Icon size={17} color={meta.color} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink }}
                        >
                          {n.title}
                        </Text>
                        {!n.read ? (
                          <View
                            style={{
                              backgroundColor: MINT, borderRadius: 999,
                              paddingHorizontal: 8, paddingVertical: 2,
                              marginLeft: 6,
                            }}
                          >
                            <Text style={{ color: GREEN_DARK, fontSize: rf(9.5), fontWeight: '800', letterSpacing: 0.4 }}>
                              NEW
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {n.body ? (
                        <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 3, lineHeight: rlh(17) }}>
                          {n.body}
                        </Text>
                      ) : null}
                      <Text style={{ fontSize: rf(10.5), color: 'rgba(30,30,30,0.45)', marginTop: 5 }}>
                        {ago(n.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
