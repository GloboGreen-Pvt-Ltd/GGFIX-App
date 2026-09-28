import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Package,
  Wrench, Search, ClipboardList, ChevronRight, ArrowRight, Zap, Camera, Mic, ScanLine,
  ShieldCheck, UserRound, Truck, BadgeCheck, ThumbsUp, IndianRupee, Headset,
} from 'lucide-react-native';
import { OfferBanner, EmptyState, Loader } from '../../../components/rnr';
import { getDeviceCategories, getBanners } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const DEEP = '#004C40';
const PRIMARY = '#006B57';
const BRIGHT = '#00A86B';
const MINT = '#E8F7F2';
const SOFT_MINT = '#F4FBF8';
const PAGE_BG = '#F8FCFA';
const BORDER = '#DCE7E2';
const TEXT = '#111827';
const MUTED = '#667085';
const BLUE = '#3B82F6';
const PURPLE = '#8B5CF6';
const ORANGE = '#F97316';
const PINK = '#EC4899';

const MAX_W = 720;
const PAD = 16;
const GAP = 10;

// Presentation-only styling per category code: icon, icon-tile colours, the
// pastel behind the artwork and a generic tagline. Unknown codes fall back.
const MOBILE_META = { icon: Smartphone, color: BRIGHT, tile: '#D7F3E6', tint: '#EAF7F0', sub: 'iPhone, Android\nAll Brands' };
const LAPTOP_META = { icon: Laptop, color: '#1D4ED8', tile: '#DCE8FC', tint: '#EEF3FC', sub: 'Apple, Dell, HP\nLenovo, Asus' };
const TABLET_META = { icon: Tablet, color: PURPLE, tile: '#EDE6FD', tint: '#F4F0FD', sub: 'iPad, Galaxy Tab\nAll Models' };
const WATCH_META = { icon: Watch, color: ORANGE, tile: '#FFE6D5', tint: '#FFF4EC', sub: 'Apple Watch,\nWear OS, Fitness' };
const AUDIO_META = { icon: Headphones, color: PINK, tile: '#FCE4F1', tint: '#FDF0F6', sub: 'Earbuds &\nHeadphones' };
const ACCESSORY_META = { icon: Package, color: PRIMARY, tile: '#D7F3E6', tint: '#EFF5F8', sub: 'Charger, Cable, Case\n& More' };
const CODE_META = {
  MOBILE: MOBILE_META,
  SMARTPHONE: MOBILE_META,
  LAPTOP: LAPTOP_META,
  TABLET: TABLET_META,
  SMARTWATCH: WATCH_META,
  SMARTWATCHES: WATCH_META,
  WATCH: WATCH_META,
  AUDIO: AUDIO_META,
  AUDIO_DEVICE: AUDIO_META,
  AUDIO_DEVICES: AUDIO_META,
  ACCESSORY: ACCESSORY_META,
  ACCESSORIES: ACCESSORY_META,
};
const DEFAULT_META = { icon: Smartphone, color: BRIGHT, tile: '#D7F3E6', tint: SOFT_MINT, sub: 'Tap to see\nall brands' };

// Display order for the grid (backend returns categories alphabetically).
// Unknown codes follow, alphabetically.
const CATEGORY_ORDER = [
  'MOBILE', 'SMARTPHONE', 'LAPTOP', 'TABLET', 'SMARTWATCH', 'SMARTWATCHES', 'WATCH',
  'AUDIO', 'AUDIO_DEVICE', 'AUDIO_DEVICES', 'ACCESSORY', 'ACCESSORIES',
];
function sortCategories(list) {
  const rank = (c) => {
    const i = CATEGORY_ORDER.indexOf((c.code || '').toUpperCase());
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || ''));
}

const TRUST = [
  { icon: ShieldCheck, label: 'Genuine\nParts', color: BRIGHT, tile: '#D7F3E6', bg: '#F1FAF6' },
  { icon: UserRound, label: 'Expert\nTechnicians', color: BLUE, tile: '#DCE8FC', bg: '#F2F6FE' },
  { icon: Truck, label: 'Doorstep\nService', color: PURPLE, tile: '#EDE6FD', bg: '#F6F3FE' },
  { icon: BadgeCheck, label: 'Warranty\non Repairs', color: ORANGE, tile: '#FFE6D5', bg: '#FFF6EF' },
];

const WHY = [
  { icon: ThumbsUp, title: 'Quality Repair', sub: 'Original parts\n& quality check', color: BRIGHT, tile: '#D7F3E6' },
  { icon: IndianRupee, title: 'Affordable', sub: 'Best service\nat fair price', color: BLUE, tile: '#DCE8FC' },
  { icon: Truck, title: 'Fast Service', sub: 'Quick turnaround\ntime', color: PURPLE, tile: '#EDE6FD' },
  { icon: Headset, title: '24/7 Support', sub: "We're here\nto help", color: ORANGE, tile: '#FFE6D5' },
];

// Banner box ratio (spec: ~2.25–2.45 : 1). Admin artwork is drawn with
// `cover`, so its own size never changes the box.
const BANNER_RATIO = 2.45;

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

// One Text per line so a two-line label never re-wraps mid-word; native
// shrinks a line slightly rather than truncating it.
function Lines({ text, style }) {
  return String(text).split('\n').map((line) => (
    <Text key={line} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={style}>
      {line}
    </Text>
  ));
}

// NOTE: every Pressable here takes a plain style object. NativeWind's
// cssInterop wrapper drops function-form `style={({ pressed }) => ...}` on
// native, which collapsed this layout on Android; press feedback uses the
// `active:` className instead.
function RepairCategoryCard({ category, width, onPress }) {
  const code = (category.code || '').toUpperCase();
  const meta = CODE_META[code] || DEFAULT_META;
  const Icon = meta.icon;
  const uri = imgUri(category);
  const imgH = Math.round(width * 0.66);
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-90"
      accessibilityRole="button"
      accessibilityLabel={category.name}
      style={{
        width,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 5,
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <View
        style={{
          height: imgH, borderRadius: 14, backgroundColor: meta.tint,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: width - 16, height: imgH - 8, marginLeft: 10 }} resizeMode="contain" />
        ) : (
          <Icon size={Math.round(imgH * 0.42)} color={meta.color} />
        )}
        <View
          style={{
            position: 'absolute', top: 6, left: 6,
            height: 28, width: 28, borderRadius: 9,
            backgroundColor: meta.tile,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={15} color={meta.color} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 4, paddingTop: 7, paddingBottom: 4 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: rf(13), fontWeight: '800', color: TEXT, letterSpacing: -0.2 }}>
          {category.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Lines text={meta.sub} style={{ fontSize: rf(8.5), lineHeight: rf(12), color: MUTED }} />
          </View>
          <View
            style={{
              height: 24, width: 24, borderRadius: 12, backgroundColor: MINT,
              alignItems: 'center', justifyContent: 'center', marginLeft: 2,
            }}
          >
            <ChevronRight size={14} color={DEEP} strokeWidth={2.6} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function RepairHomeScreen({ navigation }) {
  const [cats, setCats] = useState([]);
  const [repairBanner, setRepairBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  useEffect(() => {
    (async () => {
      try {
        const [list, banners] = await Promise.all([
          getDeviceCategories(),
          getBanners().catch(() => []),
        ]);
        setCats(sortCategories((list || []).filter((c) => c.isActive !== false)));
        // Hero shows ONLY the admin banner whose title is "Repair" (image only).
        const rb = (banners || []).find(
          (b) => b.isActive !== false && String(b.title || '').trim().toLowerCase() === 'repair',
        );
        setRepairBanner(imgUri(rb));
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader label="Loading categories..." />;

  const contentW = Math.min(width, MAX_W);
  const availableWidth = contentW - PAD * 2;
  const cardWidth = Math.floor((availableWidth - GAP * 2) / 3);
  const trustGap = 7;
  const trustW = Math.floor((availableWidth - trustGap * 3) / 4);
  const bannerH = Math.round(availableWidth / BANNER_RATIO);
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  const goToDevice = (extra = {}) =>
    navigation.navigate('RepairSelectDevice', { flow: 'REPAIR', ...extra });

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* Hero: gradient + soft translucent curves, title row, search bar. */}
      <LinearGradient
        colors={[DEEP, '#005A4B', PRIMARY, BRIGHT]}
        locations={[0, 0.45, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 1.1, height: width * 1.1, borderRadius: width,
            right: -width * 0.55, top: -width * 0.66, backgroundColor: 'rgba(255,255,255,0.07)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width,
            left: -width * 0.5, bottom: -width * 0.6, backgroundColor: 'rgba(0,0,0,0.10)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: width,
            right: -width * 0.28, bottom: -width * 0.45, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
          }}
        />

        <SafeAreaView edges={['top']}>
          <View style={[centered, { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  height: 50, width: 50, borderRadius: 15, marginRight: 12,
                  backgroundColor: 'rgba(0,168,107,0.35)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Wrench size={25} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: rf(26), lineHeight: rf(31), letterSpacing: -0.5 }}>
                  Repair
                </Text>
                <Text numberOfLines={1} style={{ color: 'rgba(230,248,240,0.92)', fontSize: rf(13) }}>
                  Get your devices fixed by experts
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('MyOrders', { initialTab: 'Service' })}
                accessibilityLabel="My repair orders"
                className="active:opacity-80"
                style={{
                  height: 44, width: 44, borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ClipboardList size={21} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Search field — magnifier, placeholder, camera / mic / scan and
                the FAST pill all sit inside the one white field. */}
            <Pressable
              onPress={() => goToDevice()}
              className="active:opacity-95"
              accessibilityRole="search"
              style={{
                flexDirection: 'row', alignItems: 'center',
                height: 58, borderRadius: 29,
                backgroundColor: '#FFFFFF',
                paddingLeft: 16, paddingRight: 7,
                marginTop: 14,
                shadowColor: '#0F172A', shadowOpacity: 0.14,
                shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5,
              }}
            >
              <Search size={20} color={TEXT} />
              <Text numberOfLines={1} style={{ flex: 1, marginLeft: 9, color: MUTED, fontSize: rf(13) }}>
                Search repairs, devices, brands...
              </Text>
              <Camera size={19} color={TEXT} style={{ marginLeft: 4 }} />
              <Mic size={19} color={TEXT} style={{ marginLeft: 10 }} />
              <View style={{ width: 1, height: 22, backgroundColor: BORDER, marginLeft: 10 }} />
              <ScanLine size={19} color={TEXT} style={{ marginLeft: 10 }} />
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  height: 42, borderRadius: 21, marginLeft: 8,
                  backgroundColor: MINT, paddingHorizontal: 11,
                }}
              >
                <Zap size={14} color={DEEP} fill={DEEP} />
                <Text style={{ color: DEEP, fontSize: rf(12), fontWeight: '900', marginLeft: 4 }}>FAST</Text>
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
        <View style={centered}>
          {/* Hero banner — admin-managed "Repair" banner (image only). Falls
              back to the built-in offer banner when it isn't published. */}
          <View style={{ paddingHorizontal: PAD, marginTop: 12 }}>
            {repairBanner ? (
              <Pressable
                onPress={() => goToDevice()}
                accessibilityRole="imagebutton"
                accessibilityLabel="Repair offer banner"
                style={{ width: availableWidth, height: bannerH, borderRadius: 24, overflow: 'hidden', backgroundColor: SOFT_MINT }}
              >
                <Image source={{ uri: repairBanner }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Pressable>
            ) : (
              <OfferBanner
                badge="LIMITED TIME"
                title="Flat 15% OFF on first repair"
                subtitle="Use code FIRSTFIX at checkout — auto-applied for new users."
                cta="Book now"
                palette="emerald"
                onPress={() => goToDevice()}
              />
            )}
          </View>

          {/* Trust strip — four equal cards in one row. */}
          <View style={{ flexDirection: 'row', paddingHorizontal: PAD, marginTop: 10 }}>
            {TRUST.map((t, i) => {
              const Icon = t.icon;
              return (
                <View
                  key={t.label}
                  style={{
                    width: trustW, marginLeft: i === 0 ? 0 : trustGap,
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: t.bg, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
                    paddingVertical: 9, paddingLeft: 4, paddingRight: 3,
                  }}
                >
                  <View
                    style={{
                      height: 22, width: 22, borderRadius: 8, marginRight: 3,
                      backgroundColor: t.tile, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon size={13} color={t.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Lines text={t.label} style={{ fontSize: rf(8.5), lineHeight: rf(11.5), fontWeight: '700', color: TEXT, letterSpacing: -0.2 }} />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ paddingHorizontal: PAD, marginTop: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(19), fontWeight: '800', color: TEXT, letterSpacing: -0.3 }}>
                Browse by category
              </Text>
              <Text numberOfLines={1} style={{ fontSize: rf(12), color: MUTED, marginTop: 2 }}>
                Select a device type to continue
              </Text>
            </View>
            <Pressable
              onPress={() => goToDevice()}
              className="active:opacity-70"
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginLeft: 8 }}
            >
              <Text style={{ color: DEEP, fontWeight: '700', fontSize: rf(13), marginRight: 3 }}>See all</Text>
              <ArrowRight size={16} color={DEEP} />
            </Pressable>
          </View>

          {cats.length === 0 ? (
            <View style={{ paddingHorizontal: PAD }}>
              <EmptyState title="No categories yet" description="The admin hasn't published any device categories." />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: PAD }}>
              {cats.map((c, i) => (
                <View
                  key={c.id}
                  style={{ width: cardWidth, marginLeft: i % 3 === 0 ? 0 : GAP, marginBottom: GAP }}
                >
                  <RepairCategoryCard
                    category={c}
                    width={cardWidth}
                    onPress={() => navigation.navigate('RepairSelectDevice', {
                      flow: 'REPAIR', categoryId: c.id, categoryCode: (c.code || '').toUpperCase(), categoryName: c.name,
                    })}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Why choose GGFIX — one soft panel, four equal columns. */}
          <View
            style={{
              marginHorizontal: PAD, marginTop: 6,
              backgroundColor: '#F7FBFD', borderRadius: 22, borderWidth: 1, borderColor: BORDER,
              paddingTop: 12, paddingBottom: 12, paddingHorizontal: 6,
              shadowColor: '#0F172A', shadowOpacity: 0.03, shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 }, elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 10 }}>
              <Text style={{ flex: 1, fontSize: rf(17), fontWeight: '800', color: TEXT, letterSpacing: -0.3 }}>
                Why choose GGFIX?
              </Text>
              <Pressable
                onPress={() => navigation.navigate('AboutUs')}
                className="active:opacity-70"
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: DEEP, fontWeight: '700', fontSize: rf(12.5), marginRight: 3 }}>Learn more</Text>
                <ArrowRight size={15} color={DEEP} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {WHY.map((w, i) => {
                const Icon = w.icon;
                return (
                  <View
                    key={w.title}
                    style={{
                      flex: 1, alignItems: 'center', paddingHorizontal: 2,
                      borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: BORDER,
                    }}
                  >
                    <View
                      style={{
                        height: 36, width: 36, borderRadius: 12, marginBottom: 6,
                        backgroundColor: w.tile, alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon size={19} color={w.color} />
                    </View>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: rf(10.5), fontWeight: '800', color: TEXT, textAlign: 'center' }}>
                      {w.title}
                    </Text>
                    <View style={{ marginTop: 2, alignItems: 'center' }}>
                      <Lines text={w.sub} style={{ fontSize: rf(8.5), lineHeight: rf(11.5), color: MUTED, textAlign: 'center' }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
