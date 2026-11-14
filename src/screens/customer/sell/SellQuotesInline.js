// Quotations shown inline on Sell Device Details (expand / collapse on the same
// page). Reuses the Quotations Received data + rules (useSellOrder, quoteState,
// bestQuoteId) — real backend quotes only. Tap a card → Quote Details (accept /
// call / chat / price revision stay there); accepted quote → Track Sell Order.
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronRight, ChevronUp, Clock, Crown, MapPin, MessageCircle, Phone, Store, Tag, Truck } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { useSellOrder, money, quoteState, bestQuoteId, ago } from './useSellOrder';
import { markQuotesSeen } from '../../../utils/sellQuoteSeen';

const TEAL = '#035C6C';
const ORANGE = '#F09406';
const GREEN = '#15803D';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E5E7EB';

const STATUS = {
  open: { t: 'Pending', fg: '#B45309', bg: '#FEF3C7' },
  accepted: { t: 'Accepted', fg: GREEN, bg: '#DCFCE7' },
  rejected: { t: 'Declined', fg: '#B91C1C', bg: '#FEE2E2' },
  closed: { t: 'Expired', fg: MUTED, bg: '#F3F4F6' },
};

// Real distance only — a missing or 0.0 distance is never shown as "0.0 km".
const distanceText = (shop) => {
  const d = Number(shop?.distanceKm);
  return Number.isFinite(d) && d > 0 ? `${d.toFixed(1)} km` : null;
};

export default function SellQuotesInline({ sellOrderId, navigation, initiallyOpen = false, onTrack }) {
  const { order, quotes, shops } = useSellOrder(sellOrderId, { poll: true });
  const [open, setOpen] = useState(initiallyOpen);
  const [tab, setTab] = useState('all');
  useEffect(() => { if (open && order?.id === sellOrderId) markQuotesSeen(sellOrderId, quotes.length); }, [open, order, quotes.length, sellOrderId]);
  if (!quotes?.length) return null;

  const best = bestQuoteId(order, quotes);
  const sorted = [...quotes].sort((a, b) => Number(b.quotationPrice || 0) - Number(a.quotationPrice || 0));
  const active = sorted.filter((q) => ['open', 'accepted'].includes(quoteState(order, q)));
  const showTabs = sorted.length > 1 && active.length !== sorted.length; // filters only when they differ
  const shown = showTabs && tab === 'active' ? active : sorted;

  return (
    <View style={{ marginTop: 8 }}>
      {/* Show / Hide toggle */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#E8F5EF', borderWidth: 1, borderColor: '#CFEBDD' }}
      >
        <Tag size={15} color={GREEN} fill={GREEN} />
        <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(13), fontWeight: '800', color: INK }}>View Quotations ({sorted.length})</Text>
        {open ? <ChevronUp size={17} color={INK} /> : <ChevronDown size={17} color={INK} />}
      </Pressable>

      {open ? (
        <View style={{ marginTop: 6 }}>
          {showTabs ? (
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {[['all', `All Quotes (${sorted.length})`], ['active', `Active Only (${active.length})`]].map(([k, label], i) => {
                const on = tab === k;
                return (
                  <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={{ flex: 1, height: 30, marginLeft: i ? 6 : 0, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? TEAL : '#FFFFFF', borderWidth: 1, borderColor: on ? TEAL : LINE }}>
                    <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: on ? '#FFFFFF' : INK }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {shown.map((q) => {
            const shop = shops?.[q.shopId];
            const st = quoteState(order, q);
            const s = STATUS[st] || STATUS.open;
            const isBest = q.id === best;
            const accepted = st === 'accepted';
            const place = [distanceText(shop), shop?.city || q.shopCity].filter(Boolean).join(' · ');
            const quoted = Number(q.quotationPrice || 0);
            const finalPrice = accepted ? Number(order?.finalPrice || q.revisedPrice || q.finalPrice || 0) : Number(q.revisedPrice || 0);
            return (
              <View key={q.id} style={{ borderRadius: 12, borderWidth: isBest || accepted ? 1.5 : 1, borderColor: isBest || accepted ? '#9ED3DB' : LINE, backgroundColor: '#FFFFFF', marginBottom: 6, overflow: 'hidden', opacity: ['rejected', 'closed'].includes(st) ? 0.65 : 1 }}>
                <Pressable onPress={() => navigation.navigate('SellQuoteDetails', { sellOrderId, quotationId: q.id })} accessibilityRole="button" style={{ paddingHorizontal: 8, paddingTop: 7, paddingBottom: 6 }}>
                  {isBest ? (
                    <View style={{ position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: ORANGE, borderBottomLeftRadius: 10, borderTopRightRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Crown size={10} color={INK} strokeWidth={2.4} />
                      <Text style={{ marginLeft: 3, fontSize: rf(9.5), fontWeight: '800', color: INK }}>Best Offer</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: isBest ? 12 : 0 }}>
                    {shop?.frontImageUrl ? (
                      <Image source={{ uri: shop.frontImageUrl }} style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: '#F3F4F6' }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: '#E5F3F5', alignItems: 'center', justifyContent: 'center' }}><Store size={18} color={TEAL} /></View>
                    )}
                    <View style={{ flex: 1.3, minWidth: 0, marginLeft: 8 }}>
                      <Text numberOfLines={1} style={{ fontSize: rf(13), fontWeight: '800', color: INK }}>{q.shopName || shop?.name || 'Shop'}</Text>
                      {place ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                          <MapPin size={11} color={MUTED} />
                          <Text numberOfLines={1} style={{ marginLeft: 3, fontSize: rf(11), color: MUTED }}>{place}</Text>
                        </View>
                      ) : null}
                      <View style={{ alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: s.bg }}>
                        <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: s.fg }}>{s.t}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 6, borderLeftWidth: 1, borderLeftColor: LINE }}>
                      <Text numberOfLines={1} style={{ fontSize: rf(10), color: TEAL }}>Quoted Price</Text>
                      <Text numberOfLines={1} style={{ fontSize: rf(14), fontWeight: '800', color: INK }}>{money(quoted)}</Text>
                    </View>
                    {finalPrice > 0 ? (
                      <View style={{ flex: 1.15, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: LINE }}>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: rf(10), fontWeight: '700', color: GREEN }}>{accepted ? 'Final Accepted Price' : 'Revised Price'}</Text>
                        <Text numberOfLines={1} style={{ fontSize: rf(14), fontWeight: '800', color: GREEN }}>{money(finalPrice)}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#F1F2F4' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                      {q.createdAt ? (
                        <>
                          <Clock size={11} color={MUTED} />
                          <Text numberOfLines={1} style={{ marginLeft: 4, fontSize: rf(10.5), color: MUTED }}>Received {ago(q.createdAt)}</Text>
                        </>
                      ) : null}
                    </View>
                    {(() => {
                      const phone = shop?.mobile || q.shopPhone;
                      const btn = (on) => ({ paddingHorizontal: 10, height: 28, borderRadius: 9, borderWidth: 1.2, borderColor: '#C9CED6', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.5 });
                      return (
                        <View style={{ flexDirection: 'row' }}>
                          <Pressable onPress={() => phone && Linking.openURL(`tel:${phone}`)} disabled={!phone} accessibilityRole="button" style={btn(!!phone)}>
                            <Phone size={12} color={TEAL} />
                            <Text style={{ marginLeft: 5, fontSize: rf(11), fontWeight: '800', color: INK }}>Call Shop</Text>
                          </Pressable>
                          <Pressable onPress={() => q.shopId && navigation.navigate('ShopChat', { shopId: q.shopId })} disabled={!q.shopId} accessibilityRole="button" style={[btn(!!q.shopId), { marginLeft: 6 }]}>
                            <MessageCircle size={12} color={TEAL} />
                            <Text style={{ marginLeft: 5, fontSize: rf(11), fontWeight: '800', color: INK }}>Chat</Text>
                          </Pressable>
                        </View>
                      );
                    })()}
                  </View>
                </Pressable>
                {accepted ? (
                  <Pressable
                    onPress={() => (onTrack ? onTrack() : navigation.navigate('SellOrderDetails', { sellOrderId, focus: 'progress' }))}
                    accessibilityRole="button"
                    className="active:opacity-85"
                    style={{ marginHorizontal: 8, marginBottom: 7, height: 34, borderRadius: 9, backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Truck size={15} color="#FFFFFF" />
                    <Text style={{ marginHorizontal: 6, fontSize: rf(12.5), fontWeight: '800', color: '#FFFFFF' }}>Track Sell Order</Text>
                    <ChevronRight size={15} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
