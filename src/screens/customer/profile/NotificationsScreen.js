import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell, PackageCheck, Tag, ShieldCheck, CheckCircle2, ArrowLeft,
} from 'lucide-react-native';
import { EmptyState, Badge, Loader } from '../../../components/rnr';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../../../api/notifications';
import { rf, rlh } from '../../../utils/responsive';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';

const FILTERS = ['All', 'Orders', 'Offers', 'System'];

const META_BY_TYPE = {
  orders: { icon: PackageCheck, color: GREEN_DARK, bg: '#DCFCE7' },
  offers: { icon: Tag,          color: '#C2410C',  bg: '#FFEDD5' },
  system: { icon: ShieldCheck,  color: '#7C3AED',  bg: '#F5F3FF' },
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
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: rf(12.5), fontWeight: '800', letterSpacing: 0.6 }}>
              NOTIFICATIONS
            </Text>
            <Text style={{ color: '#fff', fontSize: rf(19), fontWeight: '800', marginTop: 2, letterSpacing: -0.2 }}>
              {unreadCount ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'Stay in the loop'}
            </Text>
          </View>
          <View
            style={{
              height: 36, width: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Bell size={18} color="#fff" />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          paddingHorizontal: 14, paddingVertical: 8,
          borderRadius: 999, marginRight: 8,
          backgroundColor: active ? GREEN : '#fff',
          borderWidth: 1, borderColor: active ? GREEN : '#E5E7EB',
        }}
      >
        <Text style={{ fontSize: rf(12), fontWeight: '800', color: active ? '#fff' : '#0F172A' }}>
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
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <NotifHeader navigation={navigation} unreadCount={unreadCount} />

      <View
        style={{
          backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}
        >
          {FILTERS.map((f) => (
            <FilterPill key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </View>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} color={GREEN} />}
          title="You're all caught up"
          description="We'll ping you when something new happens with your bookings."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
        >
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10, paddingHorizontal: 2,
            }}
          >
            <Text style={{ fontSize: rf(12), color: '#64748B', fontWeight: '600' }}>
              {visible.length} notification{visible.length > 1 ? 's' : ''}
            </Text>
            {unreadCount > 0 ? (
              <Pressable onPress={onMarkAll} style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              <Pressable key={n.id} onPress={() => onOpen(n)}>
                <View
                  style={{
                    backgroundColor: '#fff', borderRadius: 16,
                    padding: 12, marginBottom: 10,
                    borderWidth: 1,
                    borderColor: !n.read ? '#BBF7D0' : '#F1F5F9',
                    shadowColor: '#0F172A', shadowOpacity: 0.04,
                    shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View
                      style={{
                        height: 40, width: 40, borderRadius: 20,
                        backgroundColor: meta.bg,
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Icon size={18} color={meta.color} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: rf(13.5), fontWeight: '800', color: '#0F172A' }}
                        >
                          {n.title}
                        </Text>
                        {!n.read ? (
                          <View
                            style={{
                              backgroundColor: '#DCFCE7', borderRadius: 999,
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
                        <Text style={{ fontSize: rf(12), color: '#64748B', marginTop: 4, lineHeight: rlh(18) }}>
                          {n.body}
                        </Text>
                      ) : null}
                      <Text style={{ fontSize: rf(10.5), color: '#94A3B8', marginTop: 6 }}>
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
