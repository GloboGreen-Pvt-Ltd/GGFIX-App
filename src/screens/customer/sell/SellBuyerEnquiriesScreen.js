import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronDown, ChevronUp, ChevronRight, Check, X, MessageCircle, Phone, Smartphone, Clock,
  MessageCircleMore, Sparkle, RefreshCw, ExternalLink, Inbox, BadgeCheck,
} from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { chooseSellQuotation, getSellOrderQuotations } from '../../../api/orders';
import { rf, rlh } from '../../../utils/responsive';
import { goToTab } from '../../../navigation/goToTab';
import { StaticTabBar } from '../../../navigation/CustomTabBar';
import { markQuotesSeen } from '../../../utils/sellQuoteSeen';
import {
  useSellOrder, fetchSellListings, isSold, isCancelled, money, quoteState, orderLocked, ago, fmtDateTime, SQ, cardShadow,
  useSavedPickup, quoteFulfilment, handoverAction,
} from './useSellOrder';

// Buyer Enquiries (Sell) — the interest partner shops have shown in the
// customer's listings: each shop's quotation (offer, note, time, shop profile)
// on the selected listing, with Approve (POST choose-quotation, notifies the
// shop), Chat (ShopChat) and Call. Reject has no server endpoint yet. Sold
// History lists the customer's sold listings. Everything is live data.

function Avatar({ shop, name, size = 46 }) {
  if (shop?.frontImageUrl) return <Image source={{ uri: shop.frontImageUrl }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F3F4F6' }} />;
  const initials = String(name || 'S').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SQ.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: rf(15), fontWeight: '800', color: SQ.primary }}>{initials}</Text>
    </View>
  );
}

function Thumb({ uri, size = 56 }) {
  return (
    <View style={{ width: size, height: size * 1.1, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: size - 4, height: size * 1.1 - 4 }} resizeMode="contain" /> : <Smartphone size={Math.round(size * 0.42)} color={SQ.muted} />}
    </View>
  );
}

const subLine = (l) => [l.specs, l.working].filter(Boolean).join(' · ');

function ActionBtn({ Icon, label, tone, bg, onPress, disabled, solid }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: disabled ? 0.5 : 1, ...(solid ? cardShadow : null) }}
    >
      <Icon size={18} color={tone} strokeWidth={2.4} />
      <Text style={{ marginLeft: 8, fontSize: rf(14.5), fontWeight: '800', color: tone }}>{label}</Text>
    </Pressable>
  );
}

export default function SellBuyerEnquiriesScreen({ navigation, route }) {
  const [tab, setTab] = useState('enquiries');
  const [listings, setListings] = useState(null);   // null while loading
  const [listError, setListError] = useState(null);
  const [selectedId, setSelectedId] = useState(route?.params?.sellOrderId || null);
  const [busy, setBusy] = useState(null);           // quotation id being accepted
  const lock = useRef(false);

  const [quoteCounts, setQuoteCounts] = useState({}); // listing id → enquiries (offers) on it
  const loadListings = useCallback(async () => {
    try {
      const rows = await fetchSellListings();
      setListings(rows);
      setListError(null);
      // Enquiry count per open listing, for the row chips and the tab total.
      const openRows = rows.filter((l) => !isSold(l.order) && !isCancelled(l.order));
      const counts = await Promise.all(openRows.map((l) => getSellOrderQuotations(l.id).then((q) => (Array.isArray(q) ? q.length : 0)).catch(() => 0)));
      setQuoteCounts(Object.fromEntries(openRows.map((l, i) => [l.id, counts[i]])));
    } catch (e) {
      setListError(e?.message || 'Could not load your listings.');
      setListings((l) => l || []);
    }
  }, []);
  useFocusEffect(useCallback(() => { loadListings(); }, [loadListings]));

  const open = (listings || []).filter((l) => !isSold(l.order) && !isCancelled(l.order));
  const sold = (listings || []).filter((l) => isSold(l.order));
  const { order, quotes, shops, loading: qLoading, refresh, reload } = useSellOrder(selectedId, { poll: true });
  const savedPickup = useSavedPickup(selectedId);
  const ready = !!selectedId && order?.id === selectedId && !qLoading;
  // The listing's enquiries are on screen → seen (clears the My Orders red dot).
  useEffect(() => { if (ready) markQuotesSeen(selectedId, quotes.length); }, [ready, selectedId, quotes.length]);
  const sortedQuotes = ready ? [...quotes].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) : [];

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await Promise.all([loadListings(), selectedId ? refresh() : null]); setRefreshing(false); };

  // Open a listing's enquiries in place; tapping the open one closes it.
  const toggle = (id) => setSelectedId((cur) => (cur === id ? null : id));

  const approve = async (q) => {
    if (lock.current || orderLocked(order)) return;
    const ok = await confirm({
      title: 'Approve this offer?',
      message: `Sell to ${q.shopName || 'this shop'} for ${money(q.quotationPrice)}? All other offers for this device will be declined.`,
      confirmText: 'Approve',
    });
    if (!ok) return;
    lock.current = true;
    setBusy(q.id);
    try {
      await chooseSellQuotation(selectedId, q.id);
      notify('Offer approved', `${q.shopName || 'The shop'} has been notified.`, { type: 'success' });
      // Pickup → schedule it; a shop visit (or unknown method) → its quote with the shop's details.
      if (quoteFulfilment(q) === 'PICKUP') navigation.navigate('SellSchedulePickup', { sellOrderId: selectedId });
      else navigation.navigate('SellQuoteDetails', { sellOrderId: selectedId, quotationId: q.id });
    } catch (e) {
      notify('Could not approve', e?.message || 'Please try again.', { type: 'error' });
    } finally {
      lock.current = false;
      setBusy(null);
      reload();
      loadListings();
    }
  };
  const rejectSoon = () => notify('Coming soon', 'Rejecting an offer will be available soon.', { type: 'info' });

  if (listings === null) return <Loader label="Loading enquiries..." />;

  const TabBtn = ({ k, label }) => {
    const on = tab === k;
    return (
      <Pressable onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? SQ.primary : '#F3F4F6', ...(on ? cardShadow : null) }}>
        <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: on ? '#FFFFFF' : SQ.navy }}>{label}</Text>
      </Pressable>
    );
  };

  // ---- enquiry card (one per shop offer) ----
  const EnquiryCard = ({ q }) => {
    const shop = shops[q.shopId];
    const st = quoteState(order, q);
    const next = handoverAction(quoteFulfilment(q), order, savedPickup);
    const phone = shop?.mobile || q.shopPhone;
    const badge = st === 'open' ? { t: 'Offer Received', c: SQ.success, b: SQ.successSoft }
      : st === 'accepted' ? { t: 'Approved', c: SQ.primary, b: SQ.primarySoft }
        : { t: st === 'rejected' ? 'Declined' : 'Closed', c: SQ.muted, b: '#F1F2F4' };
    return (
      <View style={{ marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: SQ.line, padding: 14, ...cardShadow }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar shop={shop} name={q.shopName} />
          <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <Text numberOfLines={1} style={{ fontSize: rf(15), fontWeight: '800', color: SQ.navy }}>{q.shopName || shop?.name || 'Shop'}</Text>
            <Text style={{ fontSize: rf(12.5), color: SQ.muted, marginTop: 2 }}>{ago(q.createdAt)}</Text>
          </View>
          <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: badge.b }}>
            <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: badge.c }}>{badge.t}</Text>
          </View>
        </View>

        {q.note ? (
          <Text style={{ marginTop: 12, fontSize: rf(13.5), lineHeight: rlh(19), color: SQ.navy, backgroundColor: '#F4F6F8', borderRadius: 14, padding: 12 }}>{q.note}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 14, backgroundColor: SQ.primaryTint, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: SQ.navy }}>Their Offer</Text>
          <View style={{ width: 1, height: 22, backgroundColor: SQ.line, marginHorizontal: 14 }} />
          <Text style={{ flex: 1, fontSize: rf(20), fontWeight: '800', color: SQ.primary, textAlign: 'center' }}>{money(q.quotationPrice)}</Text>
        </View>

        {st === 'open' ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={() => approve(q)}
              disabled={!!busy || orderLocked(order)}
              accessibilityRole="button"
              style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: SQ.success, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...cardShadow }}
            >
              {busy === q.id ? <ActivityIndicator color="#FFFFFF" /> : <Check size={18} color="#FFFFFF" strokeWidth={2.8} />}
              <Text style={{ marginLeft: 8, fontSize: rf(14.5), fontWeight: '800', color: '#FFFFFF' }}>Approve</Text>
            </Pressable>
            <ActionBtn Icon={X} label="Reject" tone={SQ.red} bg={SQ.redSoft} onPress={rejectSoon} disabled={false} />
          </View>
        ) : st === 'accepted' ? (
          <Pressable onPress={() => navigation.navigate(next.route, { sellOrderId: selectedId })} accessibilityRole="button" style={{ marginTop: 12, height: 48, borderRadius: 14, backgroundColor: SQ.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
            <BadgeCheck size={18} color="#FFFFFF" />
            <Text style={{ marginLeft: 8, fontSize: rf(14.5), fontWeight: '800', color: '#FFFFFF' }}>{next.label}</Text>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <ActionBtn Icon={MessageCircle} label="Chat" tone={SQ.primary} bg={SQ.primarySoft} onPress={() => q.shopId && navigation.navigate('ShopChat', { shopId: q.shopId })} disabled={!q.shopId} />
          <ActionBtn Icon={Phone} label="Call" tone={SQ.primary} bg={SQ.primarySoft} onPress={() => phone && Linking.openURL(`tel:${phone}`)} disabled={!phone} />
        </View>
      </View>
    );
  };

  // ---- waiting / empty card for the selected listing ----
  const Waiting = () => (
    <View style={{ marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: SQ.line, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', ...cardShadow }}>
      <View style={{ width: 150, height: 104, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 140, height: 70, bottom: 4, borderRadius: 35, backgroundColor: '#EEF6F5' }} />
        <Sparkle size={16} color={SQ.primary} fill={SQ.primary} style={{ position: 'absolute', left: 4, top: 30 }} />
        <Sparkle size={14} color={SQ.primary} fill={SQ.primary} style={{ position: 'absolute', right: 6, top: 40 }} />
        <MessageCircleMore size={64} color={SQ.primary} fill="#9ADCCF" strokeWidth={1.6} />
        <View style={{ position: 'absolute', right: 30, bottom: 8, height: 34, width: 34, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: SQ.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={18} color={SQ.primary} strokeWidth={2.6} />
        </View>
      </View>
      <Text style={{ marginTop: 10, fontSize: rf(18), fontWeight: '800', color: SQ.navy, textAlign: 'center' }}>No buyer enquiries yet</Text>
      <Text style={{ marginTop: 6, fontSize: rf(13), lineHeight: rlh(19), color: SQ.muted, textAlign: 'center' }}>
        Your listing is live. Buyer enquiries will appear here once someone shows interest.
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: SQ.successSoft }}>
        <Clock size={14} color={SQ.success} />
        <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: SQ.success }}>Waiting for enquiries</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' }}>
        <ActionBtn Icon={RefreshCw} label="Refresh" tone={SQ.navy} bg={SQ.primarySoft} onPress={onRefresh} />
        <ActionBtn Icon={ExternalLink} label="View Listing" tone={SQ.navy} bg={SQ.primarySoft} onPress={() => navigation.navigate('SellOrderDetails', { sellOrderId: selectedId })} />
      </View>
    </View>
  );

  // ---- compact listing row ----
  const ListingRow = ({ l, onPress, right }) => (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-90" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: SQ.line, padding: 12, ...cardShadow }}>
      <Thumb uri={l.image} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
        <Text numberOfLines={1} style={{ fontSize: rf(15), fontWeight: '800', color: SQ.navy }}>{l.name}</Text>
        {subLine(l) ? <Text numberOfLines={1} style={{ fontSize: rf(13), color: SQ.muted, marginTop: 3 }}>{subLine(l)}</Text> : null}
      </View>
      {right || <ChevronRight size={22} color={SQ.navy} />}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: SQ.page }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SQ.primary} colors={[SQ.primary]} />}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TabBtn k="enquiries" label={`Enquiries (${open.reduce((sum, l) => sum + (l.id === selectedId && ready ? quotes.length : (quoteCounts[l.id] || 0)), 0)})`} />
          <TabBtn k="sold" label={`Sold History (${sold.length})`} />
        </View>

        {listError ? (
          <EmptyState title="Couldn't load your listings" description={listError} actionLabel="Try again" onAction={onRefresh} />
        ) : tab === 'enquiries' ? (
          open.length === 0 ? (
            <EmptyState
              icon={<Inbox size={28} color={SQ.primary} />}
              accent={SQ.primary}
              accentSoft={SQ.primarySoft}
              title="No active listings"
              description="List a device for sale and buyer enquiries will appear here."
              actionLabel="Sell a device"
              onAction={() => goToTab(navigation, 'Sell')}
            />
          ) : (
            <>
              <Text style={{ marginTop: 12, fontSize: rf(12), color: SQ.muted }}>Tap a listing to see its buyer enquiries</Text>
              {/* Accordion: tapping a listing opens its enquiries (or the
                  waiting card) right under it; tapping again closes it. */}
              {open.map((l) => {
                const isOpen = l.id === selectedId;
                const n = isOpen && ready ? quotes.length : (quoteCounts[l.id] || 0);
                return (
                  <View key={l.id}>
                    <ListingRow
                      l={l}
                      onPress={() => toggle(l.id)}
                      right={(
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {n ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: SQ.successSoft }}>
                              <MessageCircle size={12} color={SQ.success} />
                              <Text style={{ marginLeft: 4, fontSize: rf(11.5), fontWeight: '800', color: SQ.success }}>{n}</Text>
                            </View>
                          ) : null}
                          {isOpen ? <ChevronUp size={22} color={SQ.navy} /> : <ChevronDown size={22} color={SQ.navy} />}
                        </View>
                      )}
                    />
                    {isOpen ? (
                      !ready ? (
                        <View style={{ paddingVertical: 24 }}><ActivityIndicator color={SQ.primary} /></View>
                      ) : sortedQuotes.length ? (
                        sortedQuotes.map((q) => <EnquiryCard key={q.id} q={q} />)
                      ) : (
                        <Waiting />
                      )
                    ) : null}
                  </View>
                );
              })}
            </>
          )
        ) : sold.length === 0 ? (
          <EmptyState
            icon={<Inbox size={28} color={SQ.primary} />}
            accent={SQ.primary}
            accentSoft={SQ.primarySoft}
            title="No sold devices yet"
            description="Devices you sell will be listed here."
          />
        ) : (
          sold.map((l) => (
            <ListingRow
              key={l.id}
              l={l}
              onPress={() => navigation.navigate('SellOrderDetails', { sellOrderId: l.id, focus: 'progress' })}
              right={(
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: SQ.primary }}>{money(l.order.finalPrice)}</Text>
                  <Text style={{ fontSize: rf(11), color: SQ.muted, marginTop: 2 }}>{fmtDateTime(l.order.updatedAt || l.order.createdAt, { time: false })}</Text>
                </View>
              )}
            />
          ))
        )}
      </ScrollView>
      <StaticTabBar navigation={navigation} active="Sell" />
    </View>
  );
}
