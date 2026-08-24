import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones,
  Wrench, Clock,
  Search, ClipboardList, ChevronRight,
} from 'lucide-react-native';
import { OfferBanner, EmptyState, Loader } from '../../../components/rnr';
import { getDeviceCategories, getBanners } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';

const CODE_META = {
  MOBILE:        { icon: Smartphone, color: '#004C40', bg: '#DCFCE7', emoji: '📱', sub: 'iPhone, Android · all brands' },
  SMARTPHONE:    { icon: Smartphone, color: '#004C40', bg: '#DCFCE7', emoji: '📱', sub: 'iPhone, Android · all brands' },
  LAPTOP:        { icon: Laptop,     color: '#7C3AED', bg: '#F5F3FF', emoji: '💻', sub: 'Apple, Dell, HP, Lenovo' },
  SMARTWATCH:    { icon: Watch,      color: '#B45309', bg: '#FFFBEB', emoji: '⌚', sub: 'Apple Watch, Wear OS' },
  WATCH:         { icon: Watch,      color: '#B45309', bg: '#FFFBEB', emoji: '⌚', sub: 'Apple Watch, Wear OS' },
  TABLET:        { icon: Tablet,     color: '#0369A1', bg: '#F0F9FF', emoji: '📲', sub: 'iPad, Galaxy Tab' },
  AUDIO:         { icon: Headphones, color: '#BE185D', bg: '#FFF1F2', emoji: '🎧', sub: 'Earbuds, headphones' },
  AUDIO_DEVICES: { icon: Headphones, color: '#BE185D', bg: '#FFF1F2', emoji: '🎧', sub: 'Earbuds, headphones' },
};
const DEFAULT_META = { icon: Smartphone, color: '#004C40', bg: '#DCFCE7', emoji: '📱', sub: 'Tap to see all brands' };

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

const PROMISES = [
  { icon: Wrench, label: 'Certified Techs', sub: 'Expert professionals', tint: '#FFEDD5', color: '#C2410C' },
  { icon: Clock,  label: 'Same-day Fix',    sub: 'Quick & reliable',     tint: '#FEF3C7', color: '#B45309' },
];

function columnsFor(width) {
  if (width >= 1000) return 4;
  if (width >= 720)  return 3;
  if (width >= 360)  return 2;
  return 1;
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
        setCats((list || []).filter((c) => c.isActive !== false));
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

  const padH = 16;
  const numCols = columnsFor(width);
  const gridGap = 12;
  const cardW = Math.floor((width - padH * 2 - gridGap * (numCols - 1)) / numCols);
  const imgH = Math.round(cardW * 0.52);

  const goToDevice = (extra = {}) =>
    navigation.navigate('RepairSelectDevice', { flow: 'REPAIR', ...extra });

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
                <Wrench size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(22) }}>Repair</Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('MyOrders', { initialTab: 'Service' })}
                accessibilityLabel="My repair orders"
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
              onPress={() => goToDevice()}
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
                Search repairs, devices, brands
              </Text>
              <View style={{ backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: GREEN_DARK, fontSize: rf(11), fontWeight: '800' }}>FAST</Text>
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
                  paddingVertical: 14, paddingHorizontal: 8,
                  alignItems: 'center',
                  borderWidth: 1, borderColor: '#F1F5F9',
                }}
              >
                <View
                  style={{
                    height: 40, width: 40, borderRadius: 20,
                    backgroundColor: p.tint,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Icon size={19} color={p.color} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: rf(12.5), fontWeight: '800', color: '#0F172A', textAlign: 'center' }}
                >
                  {p.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: rf(10.5), color: '#64748B', textAlign: 'center', marginTop: 2 }}
                >
                  {p.sub}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Hero — admin-managed "Repair" banner (image only). Falls back to the
            built-in offer banner when that banner isn't published. */}
        <View style={{ paddingHorizontal: padH, marginTop: 18 }}>
          {repairBanner ? (
            <Pressable
              onPress={() => goToDevice()}
              accessibilityRole="imagebutton"
              accessibilityLabel="Repair offer banner"
              style={{ borderRadius: 18, overflow: 'hidden' }}
            >
              <Image
                source={{ uri: repairBanner }}
                style={{ width: '100%', aspectRatio: 2076 / 757, borderRadius: 18, backgroundColor: '#F1F5F9' }}
                resizeMode="cover"
              />
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

        <View style={{ paddingHorizontal: padH, marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(17), fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 }}>
              Browse by category
            </Text>
            <Text style={{ fontSize: rf(12), color: '#64748B', marginTop: 2 }}>
              Tap a category to see brands & models
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
                  onPress={() => navigation.navigate('RepairSelectDevice', {
                    flow: 'REPAIR', categoryId: c.id, categoryCode: code, categoryName: c.name,
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
                      marginBottom: 8,
                    }}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: Math.min(44, imgH * 0.5) }}>{meta.emoji}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: rf(14), fontWeight: '800', color: '#0F172A' }}
                      >
                        {c.name}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{ fontSize: rf(11), color: '#64748B', marginTop: 2 }}
                      >
                        {meta.sub}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 26, width: 26, borderRadius: 13,
                        backgroundColor: '#DCFCE7',
                        alignItems: 'center', justifyContent: 'center', marginLeft: 6,
                      }}
                    >
                      <ChevronRight size={15} color={GREEN_DARK} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
