import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp, ShieldCheck, Sparkles, Search, Tag, ClipboardList,
} from 'lucide-react-native';
import { OfferBanner, EmptyState, Loader } from '../../../components/rnr';
import { getDeviceCategories, getBanners } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';

const CODE_META = {
  MOBILE:        { bg: '#DCFCE7', emoji: '📱', sub: 'Get instant quote' },
  SMARTPHONE:    { bg: '#DCFCE7', emoji: '📱', sub: 'Get instant quote' },
  LAPTOP:        { bg: '#F5F3FF', emoji: '💻', sub: 'Fair market value' },
  SMARTWATCH:    { bg: '#FFFBEB', emoji: '⌚', sub: 'All brands accepted' },
  SMARTWATCHES:  { bg: '#FFFBEB', emoji: '⌚', sub: 'All brands accepted' },
  TABLET:        { bg: '#F0F9FF', emoji: '📲', sub: 'Top price guaranteed' },
  AUDIO:         { bg: '#FFF1F2', emoji: '🎧', sub: 'Earbuds & headphones' },
  AUDIO_DEVICES: { bg: '#FFF1F2', emoji: '🎧', sub: 'Earbuds & headphones' },
};
const DEFAULT_META = { bg: '#DCFCE7', emoji: '📱', sub: 'Get the best price' };

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

const PROMISES = [
  { icon: TrendingUp,  label: 'Best Price',     tint: '#DCFCE7', color: GREEN_DARK },
  { icon: ShieldCheck, label: 'Verified Shops', tint: '#FFEDD5', color: '#C2410C' },
  { icon: Sparkles,    label: 'Free Pickup',    tint: '#FEF3C7', color: '#B45309' },
];

const STEPS = [
  { n: 1, title: 'Tell us about your device', sub: 'Model · condition · accessories' },
  { n: 2, title: 'Get quotes from shops',     sub: 'Up to 5 instant quotes' },
  { n: 3, title: 'Pickup at your doorstep',   sub: 'Pick the best · free pickup' },
];

function columnsFor(width) {
  if (width >= 1000) return 4;
  if (width >= 720)  return 3;
  if (width >= 360)  return 2;
  return 1;
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
  const imgH = Math.round(cardW * 0.52);

  const goPickDevice = (extra = {}) =>
    navigation.navigate('SellSelectDevice', { flow: 'SELL', ...extra });

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
        <LinearGradient
          colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 10,
            paddingBottom: 16,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View style={{ paddingHorizontal: padH }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Tag size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(22) }}>Sell</Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('MyOrders', { initialTab: 'Sell' })}
                accessibilityLabel="My sell listings"
                style={{
                  height: 36, width: 36, borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ClipboardList size={18} color="#fff" />
              </Pressable>
            </View>

            <Pressable
              onPress={() => goPickDevice()}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#fff', borderRadius: 16,
                paddingHorizontal: 14, paddingVertical: 12,
                marginTop: 16,
                shadowColor: '#0F172A', shadowOpacity: 0.12,
                shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4,
              }}
            >
              <Search size={18} color={GREEN} />
              <Text
                numberOfLines={1}
                style={{ flex: 1, marginLeft: 10, color: '#64748B', fontSize: rf(14) }}
              >
                Search devices to sell
              </Text>
              <View style={{ backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: GREEN_DARK, fontSize: rf(11), fontWeight: '800' }}>QUOTE</Text>
              </View>
            </Pressable>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={{ flexDirection: 'row', paddingHorizontal: padH, marginTop: 16 }}>
          {PROMISES.map((p) => {
            const Icon = p.icon;
            return (
              <View
                key={p.label}
                style={{
                  flex: 1, marginHorizontal: 4,
                  backgroundColor: '#fff', borderRadius: 14,
                  paddingVertical: 12, paddingHorizontal: 6,
                  alignItems: 'center',
                  borderWidth: 1, borderColor: '#F1F5F9',
                }}
              >
                <View
                  style={{
                    height: 32, width: 32, borderRadius: 16,
                    backgroundColor: p.tint,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}
                >
                  <Icon size={16} color={p.color} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: rf(10.5), fontWeight: '700', color: '#0F172A', textAlign: 'center' }}
                >
                  {p.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Hero — admin-managed "Sell" banner (image only). Falls back to the
            built-in offer banner when that banner isn't published. */}
        <View style={{ paddingHorizontal: padH, marginTop: 18 }}>
          {sellBanner ? (
            <Pressable
              onPress={() => goPickDevice()}
              accessibilityRole="imagebutton"
              accessibilityLabel="Sell offer banner"
              style={{ borderRadius: 18, overflow: 'hidden' }}
            >
              <Image
                source={{ uri: sellBanner }}
                style={{ width: '100%', aspectRatio: 2076 / 757, borderRadius: 18, backgroundColor: '#F1F5F9' }}
                resizeMode="cover"
              />
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

        <View style={{ paddingHorizontal: padH, marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(17), fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 }}>
              Select category
            </Text>
            <Text style={{ fontSize: rf(12), color: '#64748B', marginTop: 2 }}>
              What are you selling today?
            </Text>
          </View>
          <View
            style={{
              backgroundColor: '#DCFCE7', borderRadius: 999,
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <Text style={{ color: GREEN_DARK, fontSize: rf(11), fontWeight: '800' }}>
              {cats.length} options
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
              const meta = CODE_META[code] || DEFAULT_META;
              const uri = imgUri(c);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => navigation.navigate('SellSelectDevice', {
                    flow: 'SELL', categoryId: c.id, categoryCode: code, categoryName: c.name,
                  })}
                  style={{
                    width: cardW,
                    marginLeft: i % numCols === 0 ? 0 : gridGap,
                    marginBottom: gridGap,
                    backgroundColor: '#fff',
                    borderRadius: 18,
                    padding: 10,
                    borderWidth: 1, borderColor: '#F1F5F9',
                    shadowColor: '#0F172A', shadowOpacity: 0.05,
                    shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: '100%', height: imgH, borderRadius: 14,
                      backgroundColor: uri ? '#FFFFFF' : meta.bg,
                      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      marginBottom: 10,
                    }}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: Math.min(44, imgH * 0.5) }}>{meta.emoji}</Text>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: rf(14), fontWeight: '800', color: '#0F172A' }}
                  >
                    {c.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: rf(11), color: '#64748B', marginTop: 2 }}
                  >
                    {meta.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ paddingHorizontal: padH, marginTop: 22, marginBottom: 6 }}>
          <Text style={{ fontSize: rf(17), fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 }}>
            How it works
          </Text>
          <Text style={{ fontSize: rf(12), color: '#64748B', marginTop: 2 }}>
            Three steps to cash in hand
          </Text>
        </View>
        <View style={{ paddingHorizontal: padH }}>
          {STEPS.map((s) => (
            <View key={s.n} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
              <View
                style={{
                  height: 28, width: 28, borderRadius: 14,
                  backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
                  marginRight: 10, marginTop: 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: rf(12), fontWeight: '800' }}>{s.n}</Text>
              </View>
              <View
                style={{
                  flex: 1, backgroundColor: '#fff', borderRadius: 12,
                  paddingHorizontal: 12, paddingVertical: 10,
                  borderWidth: 1, borderColor: '#F1F5F9',
                }}
              >
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#0F172A' }}>{s.title}</Text>
                <Text style={{ fontSize: rf(11), color: '#64748B', marginTop: 2 }}>{s.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
