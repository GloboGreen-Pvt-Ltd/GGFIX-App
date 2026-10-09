import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import PageHeader, { HEADER } from '../../../components/PageHeader';
import { useFocusEffect } from '@react-navigation/native';
import { MessageCircle, Search, Store, MapPin } from 'lucide-react-native';
import { Avatar, EmptyState, Loader } from '../../../components/rnr';
import { listChats, pingChatPresence } from '../../../api/marketplace';
import { listNearbyShops } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { tokens } from '../../../theme/colors';
import { rf } from '../../../utils/responsive';

const NEARBY_RADIUS_KM = 20;

// WhatsApp-style inbox of the customer's open conversations with shops. Polls
// every ~7s while focused so new shop replies bump to the top without manual
// pull-to-refresh.

function shortTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = (now - d) / 86400000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function initial(name) {
  const w = (name || 'S').trim().split(/\s+/);
  return ((w[0]?.[0] || 'S') + (w[1]?.[0] || '')).toUpperCase();
}

export default function CustomerChatInboxScreen({ navigation }) {
  const [threads, setThreads] = useState([]);
  const [nearbyShops, setNearbyShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const pollRef = useRef(null);
  const { lat, lng, addressLabel: gpsLabel } = useCustomerLocation();

  const load = useCallback(async () => {
    try {
      pingChatPresence().catch(() => {});
      const [data, shops] = await Promise.all([
        listChats().catch(() => []),
        lat != null && lng != null
          ? listNearbyShops({ lat, lng, radiusKm: NEARBY_RADIUS_KM }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setThreads(data || []);
      setNearbyShops(shops || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lat, lng]);

  useFocusEffect(useCallback(() => {
    load();
    pollRef.current = setInterval(load, 7000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <Loader label="Loading messages..." />;

  const filtered = q
    ? threads.filter((t) =>
        (t.counterpartName || '').toLowerCase().includes(q.toLowerCase()) ||
        (t.lastMessagePreview || '').toLowerCase().includes(q.toLowerCase())
      )
    : threads;

  const totalUnread = threads.reduce((n, t) => n + (t.unreadCount || 0), 0);

  // Hide shops the customer already has a thread with so the "start a new
  // chat" rail doesn't duplicate rows that already appear above as inbox
  // entries. Then honour the same search query for parity.
  const activeShopIds = new Set(threads.map((t) => t.shopId).filter(Boolean));
  const fresheShops = nearbyShops.filter((s) => !activeShopIds.has(s.id));
  const filteredShops = q
    ? fresheShops.filter((s) =>
        (s.name || '').toLowerCase().includes(q.toLowerCase()) ||
        (s.address || s.city || '').toLowerCase().includes(q.toLowerCase())
      )
    : fresheShops;

  const openShopEnquiry = (shopId) =>
    navigation.navigate('ShopChat', { shopId, mode: 'ENQUIRY' });

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background }}>
      <PageHeader
        title="Messages"
        subtitle={`${threads.length} shops${totalUnread > 0 ? ` · ${totalUnread} unread` : ''} · Encrypted`}
        onBack={() => navigation.goBack()}
      >
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F3F3', borderRadius: 16, borderWidth: 1, borderColor: '#E6E6E6', paddingHorizontal: 12, height: 44 }}>
          <Search size={16} color={HEADER.action} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search shop or message"
            placeholderTextColor="#8E8E8E"
            className="flex-1 text-text ml-2" style={{ fontSize: rf(13), outlineStyle: 'none' }}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      </PageHeader>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#09AD2A" colors={['#09AD2A']} />}
      >
        {filtered.length > 0 ? (
          <>
            <SectionHeader title="Your conversations" subtitle={`${filtered.length} active`} />
            {filtered.map((t, idx) => {
              const unread = t.unreadCount || 0;
              const typing = !!t.counterpartTyping;
              const online = !!t.counterpartOnline;
              const preview = typing
                ? 'typing…'
                : (t.lastMessagePreview || 'Tap to open the conversation');
              return (
                <Pressable
                  key={t.id}
                  onPress={() => navigation.navigate('ShopChat', { shopId: t.shopId, threadId: t.id })}
                  className="flex-row items-center px-4 py-3 bg-card active:opacity-80"
                  style={{ borderBottomWidth: idx === filtered.length - 1 ? 0 : 1, borderColor: '#E2E8F0' }}
                >
                  <View>
                    <Avatar source={t.counterpartAvatarUrl} fallback={initial(t.counterpartName)} size={50} />
                    {online ? (
                      <View
                        style={{
                          position: 'absolute', right: -1, bottom: -1, height: 12, width: 12,
                          borderRadius: 6, backgroundColor: '#004C40', borderWidth: 2, borderColor: '#FFFFFF',
                        }}
                      />
                    ) : null}
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="font-extrabold text-text flex-1" style={{ fontSize: rf(14) }} numberOfLines={1}>
                        {t.counterpartName || 'Shop'}
                      </Text>
                      <Text className={` font-semibold ${unread > 0 ? 'text-primary' : 'text-text-muted'}`} style={{ fontSize: rf(10) }}>
                        {shortTime(t.lastMessageAt)}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-0.5">
                      <Text
                        className={`flex-1 ${typing ? 'italic font-semibold text-primary' : (unread > 0 ? 'font-bold text-text' : 'text-text-muted')}`} style={{ fontSize: rf(12) }}
                        numberOfLines={1}
                      >
                        {preview}
                      </Text>
                      {unread > 0 ? (
                        <View className="ml-2 rounded-full px-2 min-w-[20px] h-5 items-center justify-center" style={{ backgroundColor: tokens.primary }}>
                          <Text className="text-white font-extrabold" style={{ fontSize: rf(10) }}>{unread > 99 ? '99+' : unread}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {/* Nearby shops within 20km — the "Service Enquiry" entry point.
            Tapping a shop opens ShopChat in ENQUIRY mode so the customer
            can directly message that shop owner. */}
        <SectionHeader
          title="Start a new enquiry"
          subtitle={
            lat == null || lng == null
              ? 'Enable location to discover shops nearby'
              : `Shops within ${NEARBY_RADIUS_KM} km${gpsLabel ? ` of ${gpsLabel}` : ''}`
          }
        />
        {lat == null || lng == null ? (
          <View className="px-4 mt-2">
            <EmptyState
              icon={<MapPin size={26} color={tokens.primary} />}
              title="Location needed"
              description="Allow location from Home to see nearby shops you can message."
            />
          </View>
        ) : filteredShops.length === 0 ? (
          <View className="px-4 mt-2">
            <EmptyState
              icon={<Store size={26} color={tokens.primary} />}
              title={q ? 'No matching shops' : 'No nearby shops yet'}
              description={q
                ? 'Try a different keyword.'
                : `We couldn't find shops within ${NEARBY_RADIUS_KM} km. Pull to refresh.`}
            />
          </View>
        ) : (
          filteredShops.map((s, idx) => (
            <Pressable
              key={s.id}
              onPress={() => openShopEnquiry(s.id)}
              className="flex-row items-center px-4 py-3 bg-card active:opacity-80"
              style={{ borderBottomWidth: idx === filteredShops.length - 1 ? 0 : 1, borderColor: '#E2E8F0' }}
            >
              <View
                className="h-12 w-12 rounded-2xl items-center justify-center"
                style={{ backgroundColor: tokens.primarySoft }}
              >
                <Store size={22} color={tokens.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>
                  {s.name || 'Shop'}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <MapPin size={11} color="#94A3B8" />
                  <Text className="text-text-muted ml-1 flex-1" style={{ fontSize: rf(11.5) }} numberOfLines={1}>
                    {s.address || s.city || 'Nearby'}
                    {s.distanceKm != null ? ` · ${s.distanceKm.toFixed(1)} km` : ''}
                  </Text>
                </View>
              </View>
              <View
                className="rounded-full flex-row items-center px-2.5 py-1 ml-2"
                style={{ backgroundColor: tokens.primarySoft }}
              >
                <MessageCircle size={12} color={tokens.primary} />
                <Text className="font-extrabold ml-1" style={{ fontSize: rf(10.5), color: tokens.primary }}>
                  Chat
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <View className="px-4 pt-4 pb-2">
      <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }}>{title}</Text>
      {subtitle ? (
        <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11.5) }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}
