import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Clock, MapPin, Scale, CheckCircle2, X, Inbox, Crown, Store } from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';
import { useSellOrder, money, km, quoteState, bestQuoteId, ago, SQ, cardShadow } from './useSellOrder';
import { markQuotesSeen } from '../../../utils/sellQuoteSeen';

// Quotations Received — every quote partner shops sent for this sell order
// (GET /sell-orders/{id}), All / Active tabs, the best offer flagged, a
// side-by-side compare sheet, and a tap through to Quote Details.

function ShopThumb({ shop, size = 60 }) {
  if (shop?.frontImageUrl) {
    return <Image source={{ uri: shop.frontImageUrl }} style={{ width: size, height: size, borderRadius: 12, backgroundColor: '#F3F4F6' }} resizeMode="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: SQ.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Store size={Math.round(size * 0.42)} color={SQ.primary} />
    </View>
  );
}

export default function SellQuotesReceivedScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const sellOrderId = route?.params?.sellOrderId;
  const { loading, refreshing, error, order, quotes, device, shops, refresh, reload } = useSellOrder(sellOrderId, { poll: true });
  const [tab, setTab] = useState('all');
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    if (device) navigation.setOptions({ subtitle: `Your device: ${device.name}${device.specs ? ` (${device.specs})` : ''}` });
  }, [device, navigation]);
  // Opened → these quotations are seen (clears the My Orders red dot).
  useEffect(() => { if (order?.id === sellOrderId) markQuotesSeen(sellOrderId, quotes.length); }, [order, quotes.length, sellOrderId]);

  if (loading) return <Loader label="Loading quotations..." />;
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: SQ.page, justifyContent: 'center' }}>
        <EmptyState title="Couldn't load quotations" description={error} actionLabel="Try again" onAction={reload} />
      </View>
    );
  }

  const best = bestQuoteId(order, quotes);
  const sorted = [...quotes].sort((a, b) => Number(b.quotationPrice || 0) - Number(a.quotationPrice || 0));
  const active = sorted.filter((q) => ['open', 'accepted'].includes(quoteState(order, q)));
  const shown = tab === 'all' ? sorted : active;
  const accepted = sorted.find((q) => quoteState(order, q) === 'accepted');
  const bestPrice = Number(sorted.find((q) => q.id === best)?.quotationPrice || 0);

  const TabBtn = ({ k, label }) => {
    const on = tab === k;
    return (
      <Pressable
        onPress={() => setTab(k)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={{ flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? SQ.primary : '#FFFFFF', borderWidth: 1, borderColor: on ? SQ.primary : SQ.line, ...(on ? cardShadow : null) }}
      >
        <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: on ? '#FFFFFF' : SQ.navy }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: SQ.page }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={SQ.primary} colors={[SQ.primary]} />}
      >
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <TabBtn k="all" label={`All Quotes (${sorted.length})`} />
          <TabBtn k="active" label={`Active Only (${active.length})`} />
        </View>

        {accepted ? (
          <Pressable
            onPress={() => navigation.navigate('SellOrderDetails', { sellOrderId, focus: 'progress' })}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: SQ.successSoft, borderWidth: 1, borderColor: `${SQ.success}40`, marginBottom: 12 }}
          >
            <CheckCircle2 size={18} color={SQ.success} />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), fontWeight: '700', color: SQ.success }} numberOfLines={2}>
              You accepted {accepted.shopName || 'a shop'} · {money(order?.finalPrice || accepted.quotationPrice)}
            </Text>
            <Text style={{ fontSize: rf(12), fontWeight: '800', color: SQ.success }}>Track</Text>
            <ChevronRight size={16} color={SQ.success} />
          </Pressable>
        ) : null}

        {shown.length === 0 ? (
          <EmptyState
            icon={<Inbox size={28} color={SQ.primary} />}
            accent={SQ.primary}
            accentSoft={SQ.primarySoft}
            title={tab === 'all' ? 'No quotations yet' : 'No active quotations'}
            description="Verified shops near you will send their offers here. Pull down to refresh."
          />
        ) : shown.map((q) => {
          const shop = shops[q.shopId];
          const st = quoteState(order, q);
          const isBest = q.id === best;
          const place = [km(shop), shop?.city || q.shopCity].filter(Boolean).join(' · ');
          return (
            <Pressable
              key={q.id}
              onPress={() => navigation.navigate('SellQuoteDetails', { sellOrderId, quotationId: q.id })}
              accessibilityRole="button"
              accessibilityLabel={`${q.shopName || 'Shop'}, ${money(q.quotationPrice)}${isBest ? ', best offer' : ''}`}
              className="active:opacity-90"
              style={{
                borderRadius: 18, padding: 12, marginBottom: 12, overflow: 'hidden',
                backgroundColor: isBest ? SQ.primaryTint : '#FFFFFF',
                borderWidth: isBest || st === 'accepted' ? 1.5 : 1,
                borderColor: isBest || st === 'accepted' ? SQ.primaryLine : SQ.line,
                opacity: ['rejected', 'closed'].includes(st) ? 0.6 : 1,
                ...cardShadow,
              }}
            >
              {isBest ? (
                <View style={{ position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: SQ.gold, borderBottomLeftRadius: 12, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Crown size={12} color={SQ.navy} strokeWidth={2.4} />
                  <Text style={{ marginLeft: 4, fontSize: rf(10.5), fontWeight: '800', color: SQ.navy }}>Best Offer</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ShopThumb shop={shop} />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 12, paddingRight: isBest ? 54 : 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: rf(14.5), fontWeight: '800', color: SQ.navy }}>{q.shopName || shop?.name || 'Shop'}</Text>
                  {place ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <MapPin size={12} color={SQ.muted} />
                      <Text numberOfLines={1} style={{ marginLeft: 3, fontSize: rf(12), color: SQ.muted }}>{place}</Text>
                    </View>
                  ) : null}
                  {st !== 'open' ? (
                    <Text style={{ marginTop: 3, fontSize: rf(11.5), fontWeight: '800', color: st === 'accepted' ? SQ.success : SQ.muted }}>
                      {st === 'accepted' ? 'Accepted' : st === 'rejected' ? 'Declined' : 'Closed'}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={22} color={SQ.navy} />
              </View>
              <Text style={{ marginTop: 8, marginLeft: 72, fontSize: rf(22), fontWeight: '800', color: SQ.primary }}>{money(q.quotationPrice)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: isBest ? SQ.primaryLine : '#F1F2F4' }}>
                <Clock size={13} color={SQ.muted} />
                <Text style={{ marginLeft: 5, fontSize: rf(12), color: SQ.muted }}>Received {ago(q.createdAt)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {sorted.length > 1 ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: SQ.line }}>
          <Pressable
            onPress={() => setCompare(true)}
            accessibilityRole="button"
            className="active:opacity-85"
            style={{ height: 52, borderRadius: 16, backgroundColor: SQ.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...cardShadow }}
          >
            <Scale size={20} color="#FFFFFF" />
            <Text style={{ marginLeft: 10, fontSize: rf(15), fontWeight: '800', color: '#FFFFFF' }}>Compare Quotes</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Compare sheet — every quote side by side against the best offer. */}
      <Modal visible={compare} transparent animationType="slide" onRequestClose={() => setCompare(false)}>
        <Pressable onPress={() => setCompare(false)} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) + 10, maxHeight: '80%' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: SQ.line, marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ flex: 1, fontSize: rf(16), fontWeight: '800', color: SQ.navy }}>Compare Quotes</Text>
              <Pressable onPress={() => setCompare(false)} hitSlop={10} accessibilityLabel="Close"><X size={20} color={SQ.navy} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: SQ.line }}>
              <Text style={{ flex: 1.6, fontSize: rf(11), fontWeight: '800', color: SQ.muted }}>SHOP</Text>
              <Text style={{ flex: 0.9, fontSize: rf(11), fontWeight: '800', color: SQ.muted, textAlign: 'right' }}>DISTANCE</Text>
              <Text style={{ flex: 1.1, fontSize: rf(11), fontWeight: '800', color: SQ.muted, textAlign: 'right' }}>OFFER</Text>
            </View>
            <ScrollView>
              {sorted.map((q) => {
                const diff = bestPrice - Number(q.quotationPrice || 0);
                const isBest = q.id === best;
                return (
                  <Pressable key={q.id} onPress={() => { setCompare(false); navigation.navigate('SellQuoteDetails', { sellOrderId, quotationId: q.id }); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                    <Text numberOfLines={1} style={{ flex: 1.6, fontSize: rf(13), fontWeight: '700', color: SQ.navy }}>{q.shopName || 'Shop'}</Text>
                    <Text style={{ flex: 0.9, fontSize: rf(12), color: SQ.muted, textAlign: 'right' }}>{km(shops[q.shopId]) || '—'}</Text>
                    <View style={{ flex: 1.1, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: isBest ? SQ.primary : SQ.navy }}>{money(q.quotationPrice)}</Text>
                      <Text style={{ fontSize: rf(10.5), color: isBest ? SQ.success : SQ.red }}>{isBest ? 'Best offer' : diff > 0 ? `−₹${diff.toLocaleString('en-IN')}` : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
