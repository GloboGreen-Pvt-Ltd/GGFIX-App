import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Phone,
  Navigation,
  Star,
  Clock,
  MessageCircle,
  Truck,
  Smartphone,
  ShoppingCart,
  Share2,
  Bookmark,
  MapPin,
  Award,
  Check,
  Apple,
} from 'lucide-react-native';
import {
  BottomActionBar,
  Loader,
  Badge,
  useBottomBarInset,
} from '../../../components/rnr';
import { getShop } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { rf } from '../../../utils/responsive';
import { isShopOpen } from '../../../utils/shopHours';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = 168;
const MAX_W = 600;

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1604754742629-3e0498a8e3e0?w=1080&q=70',
  'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=1080&q=70',
  'https://images.unsplash.com/photo-1565376103889-fcf45953ddb4?w=1080&q=70',
];

const PRIMARY_OPTIONS = [
  { key: 'ENQUIRY', title: 'Service Enquiry',  icon: MessageCircle, palette: ['#004C40', '#004C40'] },
  { key: 'PICKUP',  title: 'Doorstep Pickup', icon: Truck,         palette: ['#00008B', '#2563EB'] },
];

const FEATURE_CARDS = [
  { key: 'REPAIR',   title: 'Repair your Phone',  icon: Smartphone,   accent: '#00008B', bg: 'bg-primary/10' },
  { key: 'EXCHANGE', title: 'Smart Exchange',     icon: ShoppingCart, accent: '#7C3AED', bg: 'bg-primary/10' },
];

const Dot = () => <View className="h-1 w-1 rounded-full bg-text-muted/50 mx-2" />;

export default function RepairShopDetailsScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const params = route.params || {};
  const shopId = params.shopId;
  const { lat, lng, loading: locLoading } = useCustomerLocation();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('PICKUP');
  const [page, setPage] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const scrollRef = useRef(null);

  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  useEffect(() => {
    if (locLoading) return;
    (async () => {
      try {
        const args = lat != null && lng != null ? { lat, lng } : undefined;
        const s = await getShop(shopId, args).catch(() => null);
        setShop(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [shopId, lat, lng, locLoading]);

  if (loading) return <Loader label="Loading shop..." />;
  if (!shop) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-text-muted text-center">We couldn't load this shop.</Text>
      </View>
    );
  }

  // Hero carousel = the shop's own banner + storefront photo; fall back to
  // stock imagery only when the shop has uploaded neither.
  const heroImages = [shop.bannerImageUrl, shop.frontImageUrl].filter(Boolean);
  const images = heroImages.length ? heroImages : FALLBACK_IMAGES;
  const rating = Number(shop.rating || 5);
  // Live OPEN / CLOSED from the shop's hours (same logic as the pickup list).
  const open = isShopOpen(shop) ?? true;
  const WD_LABEL = { MON_FRI: 'Monday - Friday', MON_SAT: 'Monday - Saturday', MON_SUN: 'Monday - Sunday' };
  const openDays = WD_LABEL[String(shop.workingDays || '').toUpperCase()] || shop.openDays || 'Monday - Saturday';
  const hoursText = (shop.openingTime && shop.closingTime)
    ? `${String(shop.openingTime).trim()} to ${String(shop.closingTime).trim()}`
    : (shop.hoursText || '09:30 AM to 09:00 PM');

  // What this shop repairs — {"android":[...],"apple":[...]}.
  const serviceCats = (() => {
    const raw = shop.serviceCategoriesJson;
    if (!raw) return null;
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const android = Array.isArray(obj?.android) ? obj.android.filter(Boolean) : [];
      const apple = Array.isArray(obj?.apple) ? obj.apple.filter(Boolean) : [];
      return (android.length || apple.length) ? { android, apple } : null;
    } catch (_) { return null; }
  })();

  const callShop = () => { if ((shop.phone || shop.mobile)) Linking.openURL(`tel:${(shop.phone || shop.mobile)}`).catch(() => {}); };
  const directions = () => {
    const q = encodeURIComponent(shop.address || shop.name || '');
    const url = Platform.select({ ios: `http://maps.apple.com/?q=${q}`, default: `https://maps.google.com/?q=${q}` });
    Linking.openURL(url).catch(() => {});
  };

  const onContinue = () => {
    if (selected === 'ENQUIRY') navigation.navigate('ShopChat', { ...params, shopId, mode: 'ENQUIRY' });
    else navigation.navigate('RepairSelectAddress', { ...params, shopId });
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        {/* Hero carousel */}
        <View style={{ height: HERO_HEIGHT, backgroundColor: '#E2E8F0' }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          >
            {images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={{ width: SCREEN_W, height: HERO_HEIGHT }} resizeMode="cover" />
            ))}
          </ScrollView>

          <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }} />

          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View className="flex-row items-center justify-between px-3 pt-2">
              <Pressable onPress={() => navigation.goBack()} className="h-9 w-9 rounded-full bg-white items-center justify-center active:opacity-80" style={{ elevation: 3 }}>
                <ChevronLeft size={20} color="#0F172A" />
              </Pressable>
              <View className="flex-row">
                <Pressable onPress={() => setBookmarked((v) => !v)} className="h-9 w-9 rounded-full bg-white items-center justify-center active:opacity-80 mr-2" style={{ elevation: 3 }}>
                  <Bookmark size={17} color={bookmarked ? '#00008B' : '#0F172A'} fill={bookmarked ? '#00008B' : 'transparent'} />
                </Pressable>
                <Pressable className="h-9 w-9 rounded-full bg-white items-center justify-center active:opacity-80" style={{ elevation: 3 }}>
                  <Share2 size={16} color="#0F172A" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>

          <View className={`absolute left-3 bottom-3 rounded-full px-2.5 py-0.5 flex-row items-center ${open ? 'bg-success' : 'bg-danger'}`}>
            <View className="h-1.5 w-1.5 rounded-full bg-white mr-1.5" />
            <Text className="text-white font-bold tracking-wide" style={{ fontSize: rf(10) }}>{open ? 'OPEN NOW' : 'CLOSED'}</Text>
          </View>
          <View className="absolute right-3 bottom-3 flex-row">
            {images.map((_, i) => (
              <View key={i} className={`h-1.5 rounded-full mx-0.5 ${i === page ? 'bg-white w-5' : 'bg-white/50 w-1.5'}`} />
            ))}
          </View>
        </View>

        <View style={centered}>
          {/* Shop card */}
          <View className="px-4 -mt-5">
            <View className="bg-card border border-border rounded-2xl p-3.5" style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 }}>
              <View className="flex-row items-start">
                <View className="flex-1 pr-2">
                  <Text className="font-extrabold text-text leading-5" style={{ fontSize: rf(16) }} numberOfLines={2}>{shop.name}</Text>
                  <View className="flex-row items-center mt-1.5 flex-wrap">
                    <View className="flex-row items-center bg-success rounded-md px-1.5 py-0.5 mr-2">
                      <Text className="text-white font-extrabold mr-0.5" style={{ fontSize: rf(11) }}>{rating.toFixed(1)}</Text>
                      <Star size={10} color="#fff" fill="#fff" />
                    </View>
                    <Text className="text-text-muted" style={{ fontSize: rf(11) }}>{(shop.reviewCount || 248).toLocaleString()} reviews</Text>
                    {shop.distanceKm != null ? (
                      <>
                        <Dot />
                        <Text className="text-text-muted" style={{ fontSize: rf(11) }}>{Number(shop.distanceKm).toFixed(1)} km</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <Badge variant="softSuccess">VERIFIED</Badge>
              </View>

              <View className="flex-row items-start mt-2">
                <MapPin size={13} color="#64748B" style={{ marginTop: 1 }} />
                <Text className="text-text ml-1 flex-1 leading-4" style={{ fontSize: rf(12) }}>
                  {shop.address || `${shop.city || ''}${shop.pincode ? ' ' + shop.pincode : ''}`}
                </Text>
              </View>
              {(shop.phone || shop.mobile) ? (
                <View className="flex-row items-center mt-1">
                  <Phone size={12} color="#64748B" />
                  <Text className="text-text-muted ml-1" style={{ fontSize: rf(12) }}>{(shop.phone || shop.mobile)}</Text>
                </View>
              ) : null}

              {/* Call / Directions */}
              <View className="flex-row mt-3">
                <Pressable onPress={callShop} className="flex-1 mr-2 bg-success rounded-xl flex-row items-center justify-center py-2.5 active:opacity-90">
                  <Phone size={15} color="#fff" />
                  <Text className="text-white font-extrabold ml-2" style={{ fontSize: rf(13) }}>Call Shop</Text>
                </Pressable>
                <Pressable onPress={directions} className="flex-1 ml-2 bg-card border border-success rounded-xl flex-row items-center justify-center py-2.5 active:opacity-80">
                  <Navigation size={15} color="#004C40" />
                  <Text className="text-success font-extrabold ml-2" style={{ fontSize: rf(13) }}>Get Directions</Text>
                </Pressable>
              </View>

              {/* Hours (compact, single row) */}
              <View className="bg-background rounded-xl p-2.5 mt-3 flex-row items-center">
                <View className="h-8 w-8 rounded-full bg-success/10 items-center justify-center mr-2">
                  <Clock size={15} color="#004C40" />
                </View>
                <View className="flex-1">
                  <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }} numberOfLines={1}>{openDays}</Text>
                  <Text className="text-text-muted" style={{ fontSize: rf(10) }} numberOfLines={1}>{hoursText}</Text>
                </View>
                <Badge variant={open ? 'softSuccess' : 'softDanger'}>{open ? 'OPEN' : 'CLOSED'}</Badge>
              </View>
            </View>
          </View>

          {/* Services available */}
          <Text className="font-extrabold text-text px-4 mt-4 mb-2" style={{ fontSize: rf(13) }}>Services at {shop.name}</Text>
          <View className="px-4 flex-row">
            {PRIMARY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selected === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelected(opt.key)}
                  className={`flex-1 ${opt.key === 'ENQUIRY' ? 'mr-2' : 'ml-2'} rounded-2xl overflow-hidden border ${isSelected ? 'border-transparent' : 'border-border opacity-90'}`}
                >
                  <LinearGradient colors={opt.palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 11 }}>
                    <View className="flex-row items-center justify-between">
                      <Icon size={18} color="#fff" />
                      <View className={`h-5 w-5 rounded-md border-2 border-white items-center justify-center ${isSelected ? 'bg-white' : ''}`}>
                        {isSelected ? <Check size={12} color={opt.palette[0]} strokeWidth={2} /> : null}
                      </View>
                    </View>
                    <Text className="text-white font-extrabold mt-2.5" style={{ fontSize: rf(13) }}>{opt.title}</Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>

          {/* Feature cards */}
          <View className="px-4 mt-2.5 flex-row">
            {FEATURE_CARDS.map((f, idx) => {
              const Icon = f.icon;
              return (
                <View key={f.key} className={`flex-1 ${idx === 0 ? 'mr-2' : 'ml-2'} bg-card border border-border rounded-2xl p-2.5 flex-row items-center`}>
                  <View className={`h-9 w-9 rounded-xl ${f.bg} items-center justify-center mr-2`}>
                    <Icon size={18} color={f.accent} />
                  </View>
                  <Text className="font-bold text-text flex-1" style={{ fontSize: rf(11) }} numberOfLines={2}>{f.title}</Text>
                </View>
              );
            })}
          </View>

          {/* Trust strip */}
          <View className="px-4 mt-3 flex-row">
            <View className="flex-1 mr-2 bg-card border border-border rounded-xl py-2 items-center">
              <Award size={15} color="#F59E0B" />
              <Text className="font-bold text-text mt-0.5" style={{ fontSize: rf(10) }}>Verified Shop</Text>
            </View>
            <View className="flex-1 ml-2 bg-card border border-border rounded-xl py-2 items-center">
              <Truck size={15} color="#00008B" />
              <Text className="font-bold text-text mt-0.5" style={{ fontSize: rf(10) }}>Free Pickup</Text>
            </View>
          </View>

          {/* Service categories — what this shop repairs (Android / Apple). */}
          {serviceCats ? (
            <View className="px-4 mt-4">
              <Text className="font-extrabold text-text mb-2" style={{ fontSize: rf(13) }}>Service Categories</Text>
              {serviceCats.android.length ? (
                <View className="bg-card border border-border rounded-2xl p-3 mb-2.5">
                  <View className="flex-row items-center mb-2">
                    <View className="h-6 w-6 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#DCFCE7' }}>
                      <Smartphone size={13} color="#004C40" />
                    </View>
                    <Text className="font-extrabold text-text" style={{ fontSize: rf(12.5) }}>Android</Text>
                    <Text className="text-text-muted ml-auto" style={{ fontSize: rf(10) }}>{serviceCats.android.length} services</Text>
                  </View>
                  <View className="flex-row flex-wrap -m-0.5">
                    {serviceCats.android.map((c) => (
                      <View key={c} className="m-0.5 rounded-full bg-primary/10 px-2.5 py-1">
                        <Text className="font-bold text-primary" style={{ fontSize: rf(11) }}>{c}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {serviceCats.apple.length ? (
                <View className="bg-card border border-border rounded-2xl p-3">
                  <View className="flex-row items-center mb-2">
                    <View className="h-6 w-6 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#F1F5F9' }}>
                      <Apple size={13} color="#0F172A" />
                    </View>
                    <Text className="font-extrabold text-text" style={{ fontSize: rf(12.5) }}>Apple</Text>
                    <Text className="text-text-muted ml-auto" style={{ fontSize: rf(10) }}>{serviceCats.apple.length} services</Text>
                  </View>
                  <View className="flex-row flex-wrap -m-0.5">
                    {serviceCats.apple.map((c) => (
                      <View key={c} className="m-0.5 rounded-full px-2.5 py-1" style={{ backgroundColor: '#F1F5F9' }}>
                        <Text className="font-bold text-text" style={{ fontSize: rf(11) }}>{c}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomActionBar
        title={selected === 'ENQUIRY' ? 'Start Enquiry Chat' : 'Continue with this Shop'}
        onPress={onContinue}
      />
    </View>
  );
}
