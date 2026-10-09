import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Wrench,
  Search, ClipboardList, ArrowRight,
} from 'lucide-react-native';
import { OfferBanner, EmptyState, Loader } from '../../../components/rnr';
import { getDeviceCategories, getBanners, getCategoryMenu, categoryMenuKey, getRepairCategories } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import RepairArt, { serviceArtKey } from '../../../components/RepairArt';
import PageHeader, { HeaderIconButton, HEADER } from '../../../components/PageHeader';

// Brand palette (Partner app): green #09AD2A, ink #1E1E1E, neutrals.
const GREEN = '#09AD2A';
const GREEN_DEEP = '#078F23';   // green text
const MINT = '#EAF8EC';
const INK = '#1E1E1E';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const PAGE_BG = '#F8F8F8';

const MAX_W = 720;
const PAD = 16;
const SLIDE_MS = 3500; // banner auto-advance interval

const cardShadow = {
  shadowColor: INK, shadowOpacity: 0.06, shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 }, elevation: 2,
};

// Tile order (same as the Partner app's repair picker); unknown keys follow.
const ORDER = ['mobile', 'tablet', 'laptop', 'smartwatch', 'audiodevice'];
// Subtitle per category when the admin menu row has no description.
const FALLBACK_SUBTITLE = {
  mobile: 'Smartphones',
  tablet: 'iPad, Android Tablet',
  laptop: 'Windows, MacBook',
  smartwatch: 'Apple, Samsung, Others',
  audiodevice: 'Earbuds, Headphones',
};
// Fallback glyph when there's no image (or it fails to load).
const ICONS = { mobile: Smartphone, tablet: Tablet, laptop: Laptop, smartwatch: Watch, audiodevice: Headphones };

// Why Us (reference layout): art key, title, one-line promise.
const WHY = [
  { art: 'tag', title: 'Premium Repair', sub: 'Top quality original parts & quality check' },
  { art: 'home', title: 'Doorstep Service', sub: 'Repair at your home or office' },
  { art: 'shield', title: 'Repair Warranty', sub: 'Hassle-free warranty on parts replaced' },
  { art: 'expert', title: 'Expert Technicians', sub: 'Trained & qualified professionals' },
  { art: 'rupee', title: 'Affordable Pricing', sub: 'Best service at a fair price' },
  { art: 'headset', title: '24/7 Support', sub: "We're here to help, anytime" },
];

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

// NOTE: every Pressable here takes a plain style object. NativeWind's
// cssInterop wrapper drops function-form `style={({ pressed }) => ...}` on
// native, which collapsed this layout on Android; press feedback uses the
// `active:` className instead.
function CategoryTile({ name, subtitle, uri, iconKey, width, onPress }) {
  const [broken, setBroken] = useState(false);
  const Icon = ICONS[iconKey] || Wrench;
  const well = Math.max(32, Math.min(42, Math.round(width * 0.66)));
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${name}${subtitle ? `, ${subtitle}` : ''}`}
      style={{
        width, alignItems: 'center', paddingTop: 6, paddingBottom: 5, paddingHorizontal: 2,
        borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE,
      }}
    >
      <View style={{ width: well, height: well, borderRadius: well / 2, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {uri && !broken ? (
          <Image resizeMethod="resize" source={{ uri }} resizeMode="contain" onError={() => setBroken(true)} style={{ width: '84%', height: '84%' }} />
        ) : (
          <Icon size={Math.round(well * 0.46)} color={GREEN} strokeWidth={1.8} />
        )}
      </View>
      <Text numberOfLines={2} style={{ marginTop: 4, fontSize: rf(9), lineHeight: rf(11.5), minHeight: rf(23), letterSpacing: -0.2, fontWeight: '800', color: INK, textAlign: 'center', alignSelf: 'stretch' }}>
        {name}
      </Text>
    </Pressable>
  );
}

// "Services Available" card (reference style): two-tone art, caps label.
function ServiceTile({ name, width }) {
  return (
    <View
      accessibilityLabel={name}
      style={{
        width, height: 116, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
        borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F3F3',
        shadowColor: INK, shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
      }}
    >
      <RepairArt kind={serviceArtKey(name)} size={46} />
      <Text numberOfLines={3} style={{ marginTop: 10, fontSize: rf(9.5), lineHeight: rf(12.5), letterSpacing: 0.3, fontWeight: '600', color: INK, textAlign: 'center', alignSelf: 'stretch' }}>
        {String(name).toUpperCase()}
      </Text>
    </View>
  );
}

function SectionTitle({ title, action, onAction }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, marginTop: 18, marginBottom: 10 }}>
      <Text style={{ flex: 1, fontSize: rf(16), fontWeight: '800', color: INK }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ color: GREEN_DEEP, fontWeight: '800', fontSize: rf(12), marginRight: 3 }}>{action}</Text>
          <ArrowRight size={14} color={GREEN_DEEP} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function RepairHomeScreen({ navigation }) {
  const [cats, setCats] = useState([]);
  // categoryMenuKey -> REPAIR Category Menu row (artwork + description).
  const [menuByKey, setMenuByKey] = useState({});
  const [repairCats, setRepairCats] = useState([]); // admin repair categories ("services")
  const [banners, setBanners] = useState([]); // [{ key, uri }]
  const [bannerRatio, setBannerRatio] = useState(2.45);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerPageW, setBannerPageW] = useState(0);
  const bannerRef = useRef(null);
  const indexRef = useRef(0);
  const draggingRef = useRef(false);
  const lastSwipeRef = useRef(0); // when the user last let go of the carousel
  const focused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  useEffect(() => {
    (async () => {
      try {
        const [list, banners, menu, services] = await Promise.all([
          getDeviceCategories(),
          getBanners().catch(() => []),
          getCategoryMenu('REPAIR').catch(() => []),
          getRepairCategories().catch(() => []),
        ]);
        setRepairCats((services || []).filter((s) => s && s.isActive !== false));
        const keyOf = (c) => categoryMenuKey(c.name || c.code);
        const rank = (c) => { const i = ORDER.indexOf(keyOf(c)); return i === -1 ? ORDER.length : i; };
        setCats((list || []).filter((c) => c.isActive !== false)
          .sort((a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '')));
        const byKey = {};
        (menu || []).filter((m) => m && m.isActive === true).forEach((m) => { byKey[categoryMenuKey(m.menuName)] = m; });
        setMenuByKey(byKey);
        // Hero carousel: the admin "Repair" banner(s) first, then the general
        // "Slider" banners (same rule as the Sell tab's carousel).
        const active = (banners || []).filter((b) => b.isActive !== false);
        const bySort = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        const title = (b) => String(b.title || '').trim().toLowerCase();
        setBanners(
          [...active.filter((b) => title(b) === 'repair').sort(bySort), ...active.filter((b) => title(b).startsWith('slider')).sort(bySort)]
            .map((b) => ({ key: String(b.id), uri: imgUri(b) }))
            .filter((b) => b.uri),
        );
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // Frame the carousel at the first banner's real ratio so no edge is cut.
  useEffect(() => {
    const first = banners[0]?.uri;
    if (!first) return;
    Image.getSize(first, (w, h) => { if (w > 0 && h > 0) setBannerRatio(Math.min(3.2, Math.max(1.5, w / h))); }, () => {});
  }, [banners]);

  // Auto-advance while this tab is on screen and the user isn't dragging.
  const contentW = Math.min(width, MAX_W);
  const pageW = bannerPageW || contentW;
  useEffect(() => {
    if (!focused || banners.length <= 1 || !pageW) return undefined;
    const id = setInterval(() => {
      // Hold off while dragging and for a full interval after a manual swipe.
      if (draggingRef.current || Date.now() - lastSwipeRef.current < SLIDE_MS) return;
      const next = (indexRef.current + 1) % banners.length;
      bannerRef.current?.scrollTo({ x: next * pageW, animated: true });
      indexRef.current = next;
      setBannerIndex(next);
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, [focused, banners.length, pageW]);

  // A finger on the carousel pauses it; letting go restarts the countdown.
  // (Touch events too: react-native-web doesn't fire the drag callbacks.)
  const holdBanner = () => { draggingRef.current = true; };
  const releaseBanner = () => { draggingRef.current = false; lastSwipeRef.current = Date.now(); };

  const onBannerScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (pageW || 1));
    if (i !== indexRef.current && i >= 0 && i < banners.length) {
      indexRef.current = i;
      setBannerIndex(i);
    }
  };

  if (loading) return <Loader label="Loading categories..." />;

  const availableWidth = contentW - PAD * 2;
  const serviceW = Math.floor((availableWidth - 20) / 3);
  const bannerW = pageW - PAD * 2;
  const bannerH = Math.round(bannerW / bannerRatio);
  // Category card: every tile in one compact row (scrolls only past 5).
  const cardPad = width < 360 ? 8 : 10;
  const tileGap = width < 360 ? 5 : 6;
  const inner = availableWidth - cardPad * 2 - 2; // minus the card's 1px borders
  const cols = Math.max(1, Math.min(5, cats.length));
  const tileW = cats.length > 5 ? 64 : Math.floor((inner - tileGap * (cols - 1)) / cols);
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  const goToDevice = (extra = {}) =>
    navigation.navigate('RepairSelectDevice', { flow: 'REPAIR', ...extra });
  const goToCategory = (c) => navigation.navigate('RepairSelectDevice', {
    flow: 'REPAIR', categoryId: c.id, categoryCode: (c.code || '').toUpperCase(), categoryName: c.name,
  });

  // Services available: the first device category's (Mobile) repair categories.
  const serviceCat = cats[0];
  const services = serviceCat
    ? repairCats.filter((s) => s.deviceCategoryId === serviceCat.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || /other/i.test(a.name) - /other/i.test(b.name) || (a.name || '').localeCompare(b.name || ''))
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* Header: back · Repair · my repair orders, then the search field. */}
      <PageHeader
        title="Repair"
        subtitle="Get your devices fixed by experts"
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
        right={<HeaderIconButton icon={ClipboardList} color={HEADER.action} size={18} label="My repair orders" onPress={() => navigation.navigate('RepairOrders', { initialTab: 'Service' })} />}
      >
        <Pressable
          onPress={() => goToDevice()}
          className="active:opacity-90"
          accessibilityRole="search"
          style={{
            flexDirection: 'row', alignItems: 'center', height: 46, marginTop: 14, paddingHorizontal: 14,
            borderRadius: 16, backgroundColor: '#F3F3F3', borderWidth: 1, borderColor: LINE,
          }}
        >
          <Search size={18} color={HEADER.action} />
          <Text numberOfLines={1} style={{ flex: 1, marginLeft: 10, color: '#8E8E8E', fontSize: rf(13) }}>
            Search repairs, devices, brands...
          </Text>
        </Pressable>
      </PageHeader>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={centered}>
          {/* Hero carousel — admin "Repair" + "Slider" banners (image only),
              auto-advancing and swipeable. Falls back to the built-in offer
              banner when none are published. */}
          {banners.length ? (
            <View style={{ marginTop: 12 }}>
              <ScrollView
                ref={bannerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onLayout={(e) => setBannerPageW(Math.round(e.nativeEvent.layout.width))}
                onScroll={onBannerScroll}
                onScrollBeginDrag={holdBanner}
                onScrollEndDrag={releaseBanner}
                onTouchStart={holdBanner}
                onTouchEnd={releaseBanner}
                onTouchCancel={releaseBanner}
                onMomentumScrollEnd={onBannerScroll}
              >
                {banners.map((b, i) => (
                  <View key={b.key} style={{ width: pageW, paddingHorizontal: PAD, paddingBottom: 6 }}>
                    <Pressable
                      onPress={() => goToDevice()}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={`Repair offer banner ${i + 1} of ${banners.length}`}
                      className="active:opacity-95"
                      style={{ width: bannerW, height: bannerH, borderRadius: 24, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, ...cardShadow }}
                    >
                      <Image resizeMethod="resize" source={{ uri: b.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              {banners.length > 1 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 6 }}>
                  {banners.map((b, i) => (
                    <View key={b.key} style={{ height: 6, width: i === bannerIndex ? 18 : 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === bannerIndex ? GREEN : 'rgba(30,30,30,0.18)' }} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ paddingHorizontal: PAD, marginTop: 12 }}>
              <OfferBanner
                badge="LIMITED TIME"
                title="Flat 15% OFF on first repair"
                subtitle="Use code FIRSTFIX at checkout — auto-applied for new users."
                cta="Book now"
                palette="emerald"
                onPress={() => goToDevice()}
              />
            </View>
          )}

          {/* Category picker (Partner "Select your device category to repair") — one compact row. */}
          <View style={{ marginHorizontal: PAD, marginTop: 10, padding: cardPad, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, ...cardShadow }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ flex: 1, fontSize: rf(13.5), fontWeight: '800', color: INK }}>
                Select device <Text style={{ color: GREEN_DEEP }}>category to repair</Text>
              </Text>
            </View>
            {cats.length === 0 ? (
              <EmptyState title="No categories yet" description="The admin hasn't published any device categories." />
            ) : (
              <ScrollView horizontal scrollEnabled={cats.length > 5} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tileGap }}>
                {cats.map((c) => {
                  const key = categoryMenuKey(c.name || c.code);
                  const row = menuByKey[key] || menuByKey[categoryMenuKey(c.code)];
                  const subtitle = (row?.description && row.description.trim()) || FALLBACK_SUBTITLE[key] || '';
                  return (
                    <CategoryTile
                      key={c.id}
                      name={c.name}
                      subtitle={subtitle}
                      uri={(row && imgUri(row)) || imgUri(c)}
                      iconKey={key}
                      width={tileW}
                      onPress={() => goToCategory(c)}
                    />
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Services Available — admin repair categories, 3 per row (info only). */}
          {services.length ? (
            <>
              <SectionTitle title="Services Available for Mobiles" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: PAD, columnGap: 10, rowGap: 10 }}>
                {services.map((s) => (
                  <ServiceTile key={s.id} name={s.displayName || s.name} width={serviceW} />
                ))}
              </View>
            </>
          ) : null}

          {/* Why Us — reference layout: tinted full-width band, 2 columns,
              two-tone art, bold title, muted promise. */}
          <View style={{ marginTop: 18, backgroundColor: MINT, paddingHorizontal: PAD, paddingTop: 16, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ flex: 1, fontSize: rf(16), fontWeight: '800', color: INK }}>Why Us</Text>
              <Pressable
                onPress={() => navigation.navigate('AboutUs')}
                className="active:opacity-70"
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: GREEN_DEEP, fontWeight: '800', fontSize: rf(12), marginRight: 3 }}>Learn more</Text>
                <ArrowRight size={14} color={GREEN_DEEP} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {WHY.map((w) => (
                <View key={w.title} style={{ width: '47%', marginTop: 14 }}>
                  <RepairArt kind={w.art} size={40} />
                  <Text style={{ marginTop: 8, fontSize: rf(13.5), lineHeight: rf(17), fontWeight: '800', color: INK }}>{w.title}</Text>
                  <Text style={{ marginTop: 3, fontSize: rf(11.5), lineHeight: rf(16), color: MUTED }}>{w.sub}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
