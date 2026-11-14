import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Smartphone, Clock, Inbox, Tag, CheckCircle2, BadgePercent } from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { listSellOrders, getSellOrderQuotations } from '../../../api/orders';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { goToTab } from '../../../navigation/goToTab';
import { ago, SQ, cardShadow } from './useSellOrder';

// Quotation Requests (Sell tab card) — the customer's sell orders still waiting
// on a quote decision, each with its live quote count. Tap one → Quotations
// Received for that order.
// Same statuses as the Sell tab's "Quotation Requests" count.
const AWAITING = new Set(['AWAITING_QUOTATION', 'PENDING', 'DRAFT']);

function Hero() {
  return (
    <LinearGradient
      colors={[SQ.primarySoft, '#CFE7EB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, marginBottom: 14, overflow: 'hidden' }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: rf(18), lineHeight: rf(23), fontWeight: '800', color: SQ.navy }}>Your Devices{'\n'}In Quotation</Text>
        <Text style={{ marginTop: 6, fontSize: rf(12.5), lineHeight: rf(17), color: SQ.muted }}>Get best offers from{'\n'}verified shops</Text>
      </View>
      {/* Phone + price-tag illustration */}
      <View style={{ width: 96, height: 92, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 56, height: 84, borderRadius: 14, backgroundColor: SQ.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }], ...cardShadow }}>
          <Smartphone size={34} color="#FFFFFF" strokeWidth={1.6} />
        </View>
        <View style={{ position: 'absolute', right: 2, bottom: 6, height: 38, width: 38, borderRadius: 19, backgroundColor: SQ.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' }}>
          <BadgePercent size={20} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      </View>
    </LinearGradient>
  );
}

export default function SellQuoteRequestsScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const all = await listSellOrders();
      const open = (all || []).filter((o) => AWAITING.has(String(o?.status || '').toUpperCase()));
      const brandIds = [...new Set(open.map((o) => o.brandId).filter(Boolean))];
      const [brands, rams, storages, quoteLists, ...modelLists] = await Promise.all([
        getBrands().catch(() => []),
        getRamOptions().catch(() => []),
        getStorageOptions().catch(() => []),
        Promise.all(open.map((o) => getSellOrderQuotations(o.id).catch(() => []))),
        ...brandIds.map((id) => getModelsByBrand(id).catch(() => [])),
      ]);
      const models = modelLists.flat();
      setRows(open.map((o, i) => {
        const model = models.find((m) => m.id === o.modelId);
        const brand = (brands || []).find((b) => b.id === o.brandId);
        const quotes = quoteLists[i] || [];
        const specs = [(rams || []).find((r) => r.id === o.ramOptionId)?.label, (storages || []).find((x) => x.id === o.storageOptionId)?.label].filter(Boolean).join(' / ');
        return {
          id: o.id,
          number: o.sellNumber ? String(o.sellNumber).replace(/^#+/, '') : '',
          name: model?.name || o.modelName || (brand?.name ? `${brand.name} device` : 'Device'),
          specs,
          image: model?.imageUrl || null,
          createdAt: o.createdAt,
          count: quotes.length,
        };
      }));
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load your quotation requests.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => { await load(); if (alive) setLoading(false); })();
    return () => { alive = false; };
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <Loader label="Loading quotation requests..." />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: SQ.page }}
      contentContainerStyle={{ padding: 14, paddingBottom: 32, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SQ.primary} colors={[SQ.primary]} />}
    >
      <Hero />
      {error ? (
        <EmptyState title="Couldn't load requests" description={error} actionLabel="Try again" onAction={onRefresh} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={28} color={SQ.primary} />}
          accent={SQ.primary}
          accentSoft={SQ.primarySoft}
          title="No open quotation requests"
          description="Sell a device and verified shops near you will send their offers."
          actionLabel="Sell a device"
          onAction={() => goToTab(navigation, 'Sell')}
        />
      ) : rows.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => navigation.navigate('SellQuotesReceived', { sellOrderId: r.id })}
          accessibilityRole="button"
          accessibilityLabel={`${r.name}, ${r.count ? `${r.count} quotes received` : 'awaiting quotes'}`}
          className="active:opacity-90"
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: SQ.line, ...cardShadow }}
        >
          <View style={{ width: 64, height: 76, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {r.image ? <Image source={{ uri: r.image }} style={{ width: 58, height: 70 }} resizeMode="contain" /> : <Smartphone size={26} color={SQ.muted} />}
          </View>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <Text numberOfLines={2} style={{ fontSize: rf(14.5), lineHeight: rf(19), fontWeight: '800', color: SQ.navy }}>{r.name}{r.specs ? ` (${r.specs})` : ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Clock size={12} color={SQ.muted} />
              <Text numberOfLines={1} style={{ flex: 1, marginLeft: 4, fontSize: rf(11.5), color: SQ.muted }}>{''}</Text>
              <Text style={{ fontSize: rf(11.5), color: SQ.muted }}>{ago(r.createdAt)}</Text>
            </View>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 7, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: r.count ? SQ.successSoft : SQ.primarySoft }}>
              {r.count ? <CheckCircle2 size={13} color={SQ.success} /> : <Tag size={13} color={SQ.primary} />}
              <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: r.count ? SQ.success : SQ.primary }}>
                {r.count ? `${r.count} Quote${r.count > 1 ? 's' : ''} Received` : 'Awaiting quotes'}
              </Text>
            </View>
          </View>
          <ChevronRight size={22} color={SQ.navy} style={{ marginLeft: 6 }} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
