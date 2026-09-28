import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp, ShieldCheck, Truck, Search, Tag, ClipboardList, ChevronRight,
  Headphones, Laptop, Smartphone, Watch, Tablet, FileText, Store,
} from 'lucide-react-native';
import { OfferBanner, EmptyState, Loader } from '../../../components/rnr';
import { getDeviceCategories, getBanners } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const DEEP = '#045B4D';
const HERO_DARK = '#004C40';
const PRIMARY = '#0B6B5C';
const BRIGHT = '#16A34A';
const MINT = '#DDF7E8';
const SOFT_MINT = '#EEF9F2';
const PAGE_BG = '#F5FBF8';
const BORDER = '#DCEAE2';
const TEXT = '#0F172A';
const MUTED = '#64748B';

// Presentation-only styling per category code: icon + tile colours, a soft
// card accent and the tagline. Unknown codes fall back to DEFAULT_META.
const MOBILE = { icon: Smartphone, color: '#A855F7', tile: '#F3E8FF', accent: '#FAF5FF', sub: 'Get instant quote' };
const LAPTOP = { icon: Laptop, color: '#3B82F6', tile: '#DBEAFE', accent: '#F3F8FF', sub: 'Fair market value' };
const WATCH = { icon: Watch, color: '#F97316', tile: '#FFEDD5', accent: '#FFF8F1', sub: 'All brands accepted' };
const TABLET = { icon: Tablet, color: '#3B82F6', tile: '#DBEAFE', accent: '#F3F8FF', sub: 'Top price guaranteed' };
const AUDIO = { icon: Headphones, color: BRIGHT, tile: MINT, accent: SOFT_MINT, sub: 'Get the best price' };
const CODE_META = {
  MOBILE, SMARTPHONE: MOBILE,
  LAPTOP,
  SMARTWATCH: WATCH, SMARTWATCHES: WATCH, WATCH,
  TABLET,
  AUDIO, AUDIO_DEVICE: AUDIO, AUDIO_DEVICES: AUDIO,
};
const DEFAULT_META = { icon: Smartphone, color: BRIGHT, tile: MINT, accent: SOFT_MINT, sub: 'Get the best price' };

// Sell-specific category art, overriding whatever image the admin has set on
// the shared master_device_categories row (that image is also used by Repair
// Home, so it isn't always right for the Sell context).
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

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

const PROMISES = [
  { icon: TrendingUp, label: 'Best Price', sub: 'Highest value\nguaranteed', tint: MINT, color: DEEP },
  { icon: ShieldCheck, label: 'Verified Shops', sub: 'Trusted &\nverified partners', tint: '#FFEDD5', color: '#EA580C' },
  { icon: Truck, label: 'Free Pickup', sub: 'Hassle-free\nat your doorstep', tint: '#FEF3C7', color: '#EA580C' },
];

const STEPS = [
  { n: 1, icon: FileText, title: 'Tell us about your device', sub: 'Model · condition · accessories' },
  { n: 2, icon: Store, title: 'Get quotes from shops', sub: 'Up to 5 instant quotes' },
  { n: 3, icon: Truck, title: 'Pickup at your doorstep', sub: 'Pick the best · free pickup' },
];

function columnsFor(width) {
  if (width >= 1000) return 4;
  if (width >= 720) return 3;
  return 2;
}

// One Text per line so a two-line label never re-wraps mid-word; native
// shrinks a line slightly rather than truncating it.
function Lines({ text, style }) {
  return String(text).split('\n').map((line) => (
    <Text key={line} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={style}>
      {line}
    </Text>
  ));
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native. Press feedback
// uses the `active:` className.
function SellCategoryCard({ category, width, height, onPress }) {
  const code = (category.code || '').toUpperCase();
  const meta = CODE_META[code] || DEFAULT_META;
  const Icon = meta.icon;
  const uri = SELL_IMAGES[code] || imgUri(category);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      className="active:opacity-90"
      style={{
        width, height, borderRadius: 18, overflow: 'hidden',
        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER,
        shadowColor: TEXT, shadowOpacity: 0.05, shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 }, elevation: 2,
      }}
    >
      <LinearGradient
        colors={['#FFFFFF', meta.accent]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Product + cash artwork fills the upper-right; the title band below
          it spans the full card width so names never collide with the art. */}
      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={{ position: 'absolute', right: 14, top: 6, height: height - 46, width: Math.round(width * 0.56) }}
        />
      ) : null}
      <View style={{ position: 'absolute', right: 6, bottom: 12 }}>
        <ChevronRight size={16} color={MUTED} />
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: 10, paddingLeft: 10, paddingBottom: 9, paddingRight: 22 }}>
        <View
          style={{
            height: 34, width: 34, borderRadius: 11, backgroundColor: meta.tile,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={18} color={meta.color} />
        </View>
        <View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: rf(14), fontWeight: '800', color: TEXT, letterSpacing: -0.2 }}>
            {category.name}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: rf(10.5), lineHeight: rf(13.5), color: MUTED, marginTop: 1 }}>
            {meta.sub}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function SellHomeScreen({ navigation }) {
  const [cats, setCats] = useState([]);
  const [sellBanner, setSellBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  useEffect(() => {
    (async () => {
      try {
        const [list, banners] = await Promise.all([
          getDeviceCategories(),
          getBanners().catch(() => []),
        ]);
        setCats((list || []).filter((c) => c.isActive !== false));
        // Hero shows ONLY the admin banner whose title is "Sell" (image only).
        const sb = (banners || []).find(
          (b) => b.isActive !== false && String(b.title || '').trim().toLowerCase() === 'sell',
        );
        setSellBanner(imgUri(sb));
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader label="Loading categories..." />;

  const padH = 16;
  const numCols = columnsFor(width);
  const gridGap = 12;
  const cardW = Math.floor((width - padH * 2 - gridGap * (numCols - 1)) / numCols);
  const cardH = Math.max(108, Math.round(cardW * 0.68));
  const benefitGap = 8;
  const benefitW = Math.floor((width - padH * 2 - benefitGap * 2) / 3);
  const bannerW = width - padH * 2;
  const bannerH = Math.round(bannerW / 2); // Sell artwork is authored at 2:1.

  const goPickDevice = (extra = {}) =>
    navigation.navigate('SellSelectDevice', { flow: 'SELL', ...extra });

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* Hero: deep-green gradient + soft curves, title row, search bar. */}
      <LinearGradient
        colors={[HERO_DARK, DEEP, PRIMARY, '#11845F']}
        locations={[0, 0.4, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 1.1, height: width * 1.1, borderRadius: width,
            right: -width * 0.6, top: -width * 0.55, backgroundColor: 'rgba(255,255,255,0.07)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width,
            left: -width * 0.45, bottom: -width * 0.62, backgroundColor: 'rgba(0,0,0,0.10)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 0.75, height: width * 0.75, borderRadius: width,
            right: -width * 0.3, bottom: -width * 0.5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
          }}
        />

        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: padH, paddingTop: 12, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  height: 46, width: 46, borderRadius: 14, marginRight: 12,
                  backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Tag size={24} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: rf(30), lineHeight: rf(35), letterSpacing: -0.5 }}>
                  Sell
                </Text>
                <Text numberOfLines={1} style={{ color: 'rgba(230,248,240,0.92)', fontSize: rf(13.5), marginTop: 1 }}>
                  Turn your devices into cash
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('MyOrders', { initialTab: 'Sell' })}
                accessibilityLabel="My sell listings"
                className="active:opacity-80"
                style={{
                  height: 48, width: 48, borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ClipboardList size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <Pressable
              onPress={() => goPickDevice()}
              accessibilityRole="search"
              className="active:opacity-95"
              style={{
                flexDirection: 'row', alignItems: 'center',
                height: 60, borderRadius: 30, marginTop: 16,
                backgroundColor: '#FFFFFF', paddingLeft: 18, paddingRight: 8,
                shadowColor: TEXT, shadowOpacity: 0.14, shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 }, elevation: 5,
              }}
            >
              <Search size={22} color={TEXT} />
              <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, color: MUTED, fontSize: rf(14.5) }}>
                Search devices to sell
              </Text>
              <View
                style={{
                  height: 44, borderRadius: 22, paddingHorizontal: 18,
                  backgroundColor: MINT, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: DEEP, fontSize: rf(13), fontWeight: '900', letterSpacing: 0.4 }}>QUOTE</Text>
              </View>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Benefit strip — three equal cards. */}
        <View style={{ flexDirection: 'row', paddingHorizontal: padH, marginTop: 14 }}>
          {PROMISES.map((p, i) => {
            const Icon = p.icon;
            return (
              <View
                key={p.label}
                style={{
                  width: benefitW, marginLeft: i === 0 ? 0 : benefitGap,
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: BORDER,
                  paddingVertical: 10, paddingHorizontal: 5,
                  shadowColor: TEXT, shadowOpacity: 0.04, shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 }, elevation: 1,
                }}
              >
                <View
                  style={{
                    height: 28, width: 28, borderRadius: 14, marginRight: 5,
                    backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={16} color={p.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Lines text={p.label} style={{ fontSize: rf(9), fontWeight: '800', color: TEXT, letterSpacing: -0.2 }} />
                  <Lines text={p.sub} style={{ fontSize: rf(8), lineHeight: rf(11), color: MUTED }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Hero — admin-managed "Sell" banner (image only). Falls back to the
            built-in offer banner when that banner isn't published. */}
        <View style={{ paddingHorizontal: padH, marginTop: 12 }}>
          {sellBanner ? (
            <Pressable
              onPress={() => goPickDevice()}
              accessibilityRole="imagebutton"
              accessibilityLabel="Sell offer banner"
              style={{ width: bannerW, height: bannerH, borderRadius: 22, overflow: 'hidden', backgroundColor: SOFT_MINT }}
            >
              <Image source={{ uri: sellBanner }} style={{ width: bannerW, height: bannerH }} resizeMode="cover" />
            </Pressable>
          ) : (
            <OfferBanner
              badge="GUARANTEED"
              title="Top price or free pickup"
              subtitle="Not happy with the offer? Free pickup, no questions."
              cta="Learn more"
              palette="emerald"
              onPress={() => goPickDevice()}
            />
          )}
        </View>

        <View style={{ paddingHorizontal: padH, marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(19), fontWeight: '800', color: TEXT, letterSpacing: -0.3 }}>
              Select category
            </Text>
            <Text numberOfLines={1} style={{ fontSize: rf(12.5), color: MUTED, marginTop: 2 }}>
              What are you selling today?
            </Text>
          </View>
          <View style={{ backgroundColor: MINT, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 }}>
            <Text style={{ color: DEEP, fontSize: rf(12), fontWeight: '800' }}>
              {cats.length} {cats.length === 1 ? 'option' : 'options'}
            </Text>
          </View>
        </View>

        {cats.length === 0 ? (
          <View style={{ paddingHorizontal: padH }}>
            <EmptyState title="No categories yet" description="The admin hasn't published any device categories." />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: padH }}>
            {cats.map((c, i) => {
              const code = (c.code || '').toUpperCase();
              return (
                <View key={c.id} style={{ width: cardW, marginLeft: i % numCols === 0 ? 0 : gridGap, marginBottom: gridGap }}>
                  <SellCategoryCard
                    category={c}
                    width={cardW}
                    height={cardH}
                    onPress={() => navigation.navigate('SellSelectDevice', {
                      flow: 'SELL', categoryId: c.id, categoryCode: code, categoryName: c.name,
                    })}
                  />
                </View>
              );
            })}
          </View>
        )}

        <View style={{ paddingHorizontal: padH, marginTop: 10, marginBottom: 10 }}>
          <Text style={{ fontSize: rf(19), fontWeight: '800', color: TEXT, letterSpacing: -0.3 }}>
            How it works
          </Text>
          <Text style={{ fontSize: rf(12.5), color: MUTED, marginTop: 2 }}>
            Three steps to cash in hand
          </Text>
        </View>
        <View style={{ paddingHorizontal: padH }}>
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <View
                key={s.n}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER,
                  paddingVertical: 10, paddingLeft: 12, paddingRight: 10, marginBottom: 8,
                  shadowColor: TEXT, shadowOpacity: 0.03, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 }, elevation: 1,
                }}
              >
                <View
                  style={{
                    height: 30, width: 30, borderRadius: 15, backgroundColor: HERO_DARK,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: rf(13), fontWeight: '800' }}>{s.n}</Text>
                </View>
                <View
                  style={{
                    height: 38, width: 38, borderRadius: 12, backgroundColor: SOFT_MINT,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}
                >
                  <Icon size={19} color={DEEP} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: rf(13.5), fontWeight: '800', color: TEXT }}>{s.title}</Text>
                  <Text numberOfLines={1} style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2 }}>{s.sub}</Text>
                </View>
                <ChevronRight size={18} color={MUTED} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
