import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  TrendingUp, ShieldCheck, Truck, ChevronRight, Smartphone, ArrowRight, Wrench, ShoppingBag,
  Package, PackageCheck, History, MessageSquare, BadgeIndianRupee,
} from 'lucide-react-native';
import { listSellOrders, getSellOrderQuotations } from '../../../api/orders';
import { OfferBanner, EmptyState, Loader } from '../../../components/rnr';
import { getDeviceCategories, getBanners, getCategoryMenuImages, categoryMenuKey } from '../../../api/masterData';
import { cardPastels } from '../../../theme/categoryTints';
import CategoryGridCard, { homeRailCardWidthFor } from '../../../components/CategoryGridCard';
import PageHeader, { HEADER_FONT, HeaderIconButton } from '../../../components/PageHeader';
import { rf } from '../../../utils/responsive';
import { sellProgress } from '../../../utils/sellStatus';
import { goToTab } from '../../../navigation/goToTab';
import { useCurrentDevice, deviceName, deviceTitle, roughEstimate } from '../../../utils/currentDevice';

// Partner app Sell palette — green #035C6C, ink #111111, neutrals #F3F4F6 / #F3F4F6.
const ACCENT = '#035C6C';
const PRIMARY = '#035C6C';      // green text
const MINT = '#E5F3F5';
const PAGE_BG = '#F3F4F6';
const BORDER = '#E8EAEE';
const TEXT = '#111111';
const MUTED = '#606E87';
const AMBER_FG = '#1C3053';
const AMBER_BG = '#FFF4D6';
const MAX_W = 1000;

const cardShadow = {
  shadowColor: TEXT, shadowOpacity: 0.06, shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 }, elevation: 2,
};

// Sell-specific category art, used when the admin's SELL Category Menu has
// no image for a category (the shared category image is also Repair's).
const SELL_IMAGES = {
  MOBILE: 'https://media.ggfix.in/buy&sell-categories-image/Sell-Phone.png',
  SMARTPHONE: 'https://media.ggfix.in/buy&sell-categories-image/Sell-Phone.png',
  LAPTOP: 'https://media.ggfix.in/buy&sell-categories-image/Sell-Laptop.png',
  SMARTWATCH: 'https://media.ggfix.in/buy&sell-categories-image/Sell-smartWatch.png',
  SMARTWATCHES: 'https://media.ggfix.in/buy&sell-categories-image/Sell-smartWatch.png',
  TABLET: 'https://media.ggfix.in/buy&sell-categories-image/Sell-Tablet.png',
  AUDIO: 'https://media.ggfix.in/buy&sell-categories-image/Sell-AudioDevice.png',
  AUDIO_DEVICE: 'https://media.ggfix.in/buy&sell-categories-image/Sell-AudioDevice.png',
  AUDIO_DEVICES: 'https://media.ggfix.in/buy&sell-categories-image/Sell-AudioDevice.png',
};

// Display order for the strip (backend returns categories alphabetically).
const CATEGORY_ORDER = ['MOBILE', 'SMARTPHONE', 'LAPTOP', 'TABLET', 'SMARTWATCH', 'SMARTWATCHES', 'WATCH', 'AUDIO', 'AUDIO_DEVICE', 'AUDIO_DEVICES'];
function sortCategories(list) {
  const rank = (c) => {
    const i = CATEGORY_ORDER.indexOf((c.code || '').toUpperCase());
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || ''));
}

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

// Benefit cards — the same three promises this page made before.
const PROMISES = [
  { icon: TrendingUp, title: 'Best Price', sub: 'Highest value guaranteed', color: ACCENT, bg: MINT },
  { icon: ShieldCheck, title: 'Verified Shops', sub: 'Trusted & verified partners', color: AMBER_FG, bg: AMBER_BG },
  { icon: Truck, title: 'Free Pickup', sub: 'Hassle-free at your doorstep', color: ACCENT, bg: MINT },
];

// Seller overview — 2×2 cards with live counts (the customer's sell orders and
// shop chats), each opening the matching My Orders list.
const NAVY = '#1C3053';
const SELL_STATS = [
  { key: 'listings', title: 'My Listings', icon: Package, tone: '#0E8A86', bg: '#EEF8F8' },
  { key: 'enquiries', title: 'Buyer Enquiries', icon: MessageSquare, tone: '#7E3AAE', bg: '#F6F0FC' },
  { key: 'quotes', title: 'Quotation Requests', icon: BadgeIndianRupee, tone: '#E0900F', bg: '#FFF6EC' },
  { key: 'sold', title: 'Sold Items', icon: PackageCheck, tone: '#2E9E3E', bg: '#EFFAF0', countTone: '#2E9E3E' },
];
// Sell order statuses (order-service SellOrder): waiting for a shop's quote,
// and a sale agreed / done.
const AWAITING = new Set(['AWAITING_QUOTATION', 'PENDING', 'DRAFT']);
const SOLD = new Set(['SELL_CONFIRMED', 'COMPLETED', 'PICKED_UP', 'SOLD']);

function StatCard({ stat, count, width, onPress }) {
  const Icon = stat.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${stat.title}, ${count ?? 'loading'}`}
      className="active:opacity-85"
      style={{
        width, height: 148, borderRadius: 18, padding: 14, justifyContent: 'space-between',
        backgroundColor: stat.bg, borderWidth: 1, borderColor: `${stat.tone}1F`,
        shadowColor: stat.tone, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
      }}
    >
      <View>
        <Icon size={28} color={stat.tone} strokeWidth={2} />
        <Text numberOfLines={2} style={{ marginTop: 8, fontSize: rf(15), lineHeight: rf(19), fontWeight: '800', color: NAVY }}>{stat.title}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: rf(28), fontWeight: '800', color: stat.countTone || NAVY }}>{count ?? '–'}</Text>
        <ChevronRight size={20} color={NAVY} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native. Press feedback
// uses the `active:` className.
// Action card under the banner: art · kicker / title / sub · CTA pill.
function ActionCard({ width, image, Icon, kicker, title, sub, cta, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-90"
      accessibilityRole="button"
      accessibilityLabel={`${kicker}: ${title}`}
      accessibilityHint={cta}
      style={{
        width, minHeight: 78, marginRight: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18,
        borderWidth: 1, borderColor: BORDER, paddingVertical: 8, paddingHorizontal: 10, overflow: 'hidden', ...cardShadow,
      }}
    >
      {image ? (
        <Image resizeMethod="resize" source={{ uri: image }} style={{ height: 56, width: 56, marginRight: 10 }} resizeMode="contain" />
      ) : (
        <View style={{ height: 52, width: 52, borderRadius: 14, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Icon size={24} color={ACCENT} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
        <Text numberOfLines={1} style={{ color: PRIMARY, fontWeight: '800', fontSize: rf(11.5) }}>{kicker}</Text>
        <Text numberOfLines={2} style={{ color: TEXT, fontWeight: '800', fontSize: rf(13), lineHeight: rf(17), marginTop: 1 }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: MUTED, fontSize: rf(11.5), marginTop: 1 }}>{sub}</Text>
      </View>
      <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
        <ArrowRight size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

export default function SellHomeScreen({ navigation }) {
  const [cats, setCats] = useState([]);
  const [menuImages, setMenuImages] = useState({});
  const [banners, setBanners] = useState([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerRatio, setBannerRatio] = useState(2.4);
  // Carousel page width = the carousel's own measured width.
  const [bannerPageW, setBannerPageW] = useState(0);
  const [loading, setLoading] = useState(true);
  const bannerRef = useRef(null);
  const { width } = useWindowDimensions();
  const currentDevice = useCurrentDevice();
  const [recent, setRecent] = useState([]); // latest 3 sell orders [{ so, p }]

  useEffect(() => {
    (async () => {
      try {
        const [list, rows, imgs] = await Promise.all([
          getDeviceCategories(),
          getBanners().catch(() => []),
          getCategoryMenuImages('SELL'),
        ]);
        setCats(sortCategories((list || []).filter((c) => c.isActive !== false)));
        setMenuImages(imgs || {});
        // Hero: the admin "Sell" banner(s) first, then the general "Slider"
        // banners (same set the Partner app's Sell carousel shows).
        const active = (rows || []).filter((b) => b.isActive !== false);
        const bySort = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        const title = (b) => String(b.title || '').trim().toLowerCase();
        setBanners(
          [...active.filter((b) => title(b) === 'sell').sort(bySort), ...active.filter((b) => title(b).startsWith('slider')).sort(bySort)]
            .map((b) => ({ key: String(b.id), uri: imgUri(b) }))
            .filter((b) => b.uri),
        );
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // Live counts for the seller overview (null while loading → shows "–").
  const [stats, setStats] = useState(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const list = await listSellOrders().catch(() => []);
      const st = (o) => String(o?.status || '').toUpperCase();
      // Buyer enquiries = shop offers on listings still open (not sold / cancelled).
      const open = (list || []).filter((o) => !SOLD.has(st(o)) && !/CANCEL/.test(st(o)));
      const quoteLists = await Promise.all(open.map((o) => getSellOrderQuotations(o.id).catch(() => [])));
      if (!alive) return;
      const qBy = new Map(open.map((o, i) => [o.id, Array.isArray(quoteLists[i]) ? quoteLists[i] : []]));
      setRecent([...(list || [])].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)).slice(0, 3)
        .map((so) => ({ so, p: sellProgress(so, qBy.get(so.id) || []) })));
      setStats({
        listings: (list || []).length,
        enquiries: quoteLists.reduce((n, q) => n + (Array.isArray(q) ? q.length : 0), 0),
        quotes: (list || []).filter((o) => AWAITING.has(st(o))).length,
        sold: (list || []).filter((o) => SOLD.has(st(o))).length,
      });
    })();
    return () => { alive = false; };
  }, []));

  // Frame the carousel at the first banner's real ratio so no edge is cut.
  useEffect(() => {
    const first = banners[0]?.uri;
    if (!first) return;
    Image.getSize(first, (w, h) => { if (w > 0 && h > 0) setBannerRatio(Math.min(3.2, Math.max(1.5, w / h))); }, () => {});
  }, [banners]);

  const contentW = Math.min(width, MAX_W);
  const padH = width >= 768 ? 24 : 16;
  const pageW = bannerPageW || contentW;
  const bannerW = pageW - padH * 2;
  const bannerH = Math.round(bannerW / bannerRatio);
  // Sell for Cash: the Repair tab's grid — pastel cards, 3 per row (5 → 3 + 2),
  // inside a white panel.
  const catCols = 3;
  const catGap = width < 360 ? 8 : 10;
  const panelPad = width < 360 ? 8 : 10;
  const catSize = Math.floor((contentW - padH * 2 - panelPad * 2 - 2 - catGap * (catCols - 1)) / catCols);
  const catTones = cardPastels(1, cats.map((c) => c.code || c.name));
  // Card names use the Home category cards' typography on this screen size.
  const homeCardW = homeRailCardWidthFor(width);
  // Action cards: one per screen with the next peeking in.
  const actionW = Math.min(360, Math.round((contentW - padH * 2) * 0.88));
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  // Auto-advance the carousel every 3.5s when there's more than one banner.
  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const id = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollTo({ x: next * pageW, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(id);
  }, [banners.length, pageW]);

  // Sell This Device: detected phone → its name + rough estimate; otherwise a generic card.
  const detected = currentDevice.ready && (deviceName(currentDevice) || currentDevice.storageGb || currentDevice.image);

  const goPickDevice = (extra = {}) =>
    navigation.navigate('SellSelectDevice', { flow: 'SELL', ...extra });

  // Seller overview cards: 2 per row; counts refresh whenever the tab is shown.
  const statGap = 12;
  const statW = Math.floor((contentW - padH * 2 - statGap) / 2);
  const openStat = (key) => {
    if (key === 'enquiries') navigation.navigate('SellBuyerEnquiries');
    else if (key === 'quotes') navigation.navigate('SellQuoteRequests');
    else navigation.navigate('MyOrders', { initialTab: 'Sell' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* ---------- Header: back · Sell on GGFIX · my sell orders ---------- */}
      <PageHeader
        title="Sell on NearGFix"
        subtitle="Sell your device. Get quotes from verified shops."
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
        right={<HeaderIconButton icon={History} label="Sell History" onPress={() => navigation.navigate('MyOrders', { initialTab: 'Sell' })} />}
      />

      {loading ? (
        <Loader label="Loading categories..." />
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={centered}>
            {/* Hero carousel (admin banners, image only). Falls back to the
                built-in offer banner when none are published. */}
            {banners.length ? (
              <View style={{ marginTop: 14 }}>
                <ScrollView
                  ref={bannerRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onLayout={(e) => setBannerPageW(Math.round(e.nativeEvent.layout.width))}
                  onMomentumScrollEnd={(e) => setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / (pageW || 1)))}
                >
                  {banners.map((b) => (
                    <View key={b.key} style={{ width: pageW, paddingHorizontal: padH }}>
                      <Pressable
                        onPress={() => goPickDevice()}
                        accessibilityRole="imagebutton"
                        accessibilityLabel="Sell offer banner"
                        className="active:opacity-95"
                        style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', ...cardShadow }}
                      >
                        <Image resizeMethod="resize" source={{ uri: b.uri }} style={{ width: bannerW, height: bannerH }} resizeMode="contain" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                {banners.length > 1 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                    {banners.map((b, i) => (
                      <View key={b.key} style={{ height: 6, width: i === bannerIndex ? 18 : 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === bannerIndex ? ACCENT : BORDER }} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ paddingHorizontal: padH, marginTop: 12 }}>
                <OfferBanner
                  badge="GUARANTEED"
                  title="Top price or free pickup"
                  subtitle="Not happy with the offer? Free pickup, no questions."
                  cta="Learn more"
                  palette="emerald"
                  onPress={() => goPickDevice()}
                />
              </View>
            )}

            {/* Action cards — sell this phone, repair it, or buy a new one. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: padH, paddingTop: 12, paddingBottom: 6 }}>
              <ActionCard
                width={actionW}
                image={detected ? currentDevice.image : null}
                Icon={Smartphone}
                kicker="Sell This Device"
                title={detected ? deviceTitle(currentDevice) : 'Old device? Get cash'}
                sub={detected ? `Get up to ₹${roughEstimate(currentDevice).toLocaleString('en-IN')}` : 'Instant quote · Free pickup'}
                cta="Sell Now"
                onPress={() => goPickDevice()}
              />
              <ActionCard
                width={actionW}
                Icon={Wrench}
                kicker="Repair Your Device"
                title={detected ? deviceTitle(currentDevice) : 'Screen, battery & more'}
                sub="Expert repair at your doorstep"
                cta="Repair"
                onPress={() => goToTab(navigation, 'Repair')}
              />
              <ActionCard
                width={actionW}
                Icon={ShoppingBag}
                kicker="Buy a Device"
                title="Let's find a new device for you"
                sub="Phones, laptops, tablets & more"
                cta="Shop"
                onPress={() => goToTab(navigation, 'Buy')}
              />
            </ScrollView>

            {/* Sell for Cash — one pastel card per category (starts a sale for it). */}
            <View style={{ marginHorizontal: padH, marginTop: 16, padding: panelPad, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, ...cardShadow }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
                <Text style={{ fontSize: rf(15), fontWeight: '800', color: TEXT }}>Sell for <Text style={{ color: PRIMARY }}>Cash</Text></Text>
                <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontSize: rf(11), color: MUTED }}>Pick your device</Text>
              </View>
              {cats.length === 0 ? (
                <EmptyState title="No categories yet" description="The admin hasn't published any device categories." />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: catGap }}>
                  {cats.map((c, idx) => {
                    const code = (c.code || '').toUpperCase();
                    const menuUri = menuImages[categoryMenuKey(c.name)] || menuImages[categoryMenuKey(c.code)] || null;
                    return (
                      <CategoryGridCard
                        key={c.id}
                        name={c.name}
                        uri={menuUri || SELL_IMAGES[code] || imgUri(c)}
                        Icon={Smartphone}
                        iconColor={PRIMARY}
                        width={catSize}
                        labelForWidth={homeCardW}
                        labelFont={HEADER_FONT.title}
                        tone={catTones[idx]}
                        onPress={() => goPickDevice({ categoryId: c.id, categoryCode: code, categoryName: c.name })}
                      />
                    );
                  })}
                </View>
              )}
            </View>

            {/* Benefit cards */}
            <View style={{ flexDirection: 'row', paddingHorizontal: padH, marginTop: 14 }}>
              {PROMISES.map((t, i) => {
                const Icon = t.icon;
                return (
                  <View key={t.title} style={{ flex: 1, marginLeft: i === 0 ? 0 : 8, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: BORDER, ...cardShadow }}>
                    <View style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                      <Icon size={15} color={t.color} strokeWidth={2.2} />
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: rf(12), fontWeight: '800', color: TEXT }}>{t.title}</Text>
                    <Text numberOfLines={2} style={{ fontSize: rf(9.5), color: MUTED, marginTop: 3, lineHeight: rf(13) }}>{t.sub}</Text>
                  </View>
                );
              })}
            </View>

            {/* Seller overview — 2×2 cards with live counts */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: statGap, paddingHorizontal: padH, marginTop: 16 }}>
              {SELL_STATS.map((s) => (
                <StatCard key={s.key} stat={s} count={stats ? stats[s.key] : null} width={statW} onPress={() => openStat(s.key)} />
              ))}
            </View>

            {/* Recent Sell Orders — only when the customer has sell orders. */}
            {recent.length ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: padH, marginTop: 18, marginBottom: 8 }}>
                  <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: TEXT }}>Recent Sell Orders</Text>
                  <Pressable onPress={() => navigation.navigate('MyOrders', { initialTab: 'Sell' })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                    <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: ACCENT }}>See All</Text>
                    <ArrowRight size={15} color={ACCENT} style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>
                {recent.map(({ so, p }) => {
                  const open = !p.cancelled && !p.sold;
                  const a = open && p.step === 2
                    ? { t: 'View Offers', go: () => navigation.navigate('SellQuotesReceived', { sellOrderId: so.id }) }
                    : { t: open && p.step >= 3 ? 'Track Order' : 'View Details', go: () => navigation.navigate('SellOrderTracking', { sellOrderId: so.id }) };
                  const [bg, fg] = { red: ['#FEECEC', '#B91C1C'], green: ['#E3F6EE', '#01805A'], blue: ['#E8F0FE', '#1D4ED8'] }[p.tone] || ['#FFF4E5', '#C2410C'];
                  const img = so.images?.front || null;
                  return (
                    <Pressable key={so.id} onPress={a.go} accessibilityRole="button" accessibilityLabel={so.modelName || 'Sell order'}
                      style={{ marginHorizontal: padH, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', padding: 8, ...cardShadow }}>
                      <View style={{ height: 52, width: 56, borderRadius: 10, backgroundColor: '#F4F5F7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Smartphone size={24} color={ACCENT} />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                        <Text numberOfLines={1} style={{ fontSize: rf(13.5), fontWeight: '800', color: TEXT }}>{so.modelName || 'Device'}</Text>
                        <View style={{ alignSelf: 'flex-start', marginTop: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: bg }}>
                          <Text numberOfLines={1} style={{ fontSize: rf(11), fontWeight: '800', color: fg }}>{p.label}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', height: 32, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5, borderColor: ACCENT }}>
                        <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: ACCENT }}>{a.t}</Text>
                        <ArrowRight size={13} color={ACCENT} style={{ marginLeft: 4 }} />
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
