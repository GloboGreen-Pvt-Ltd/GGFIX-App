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
  ArrowLeft,
  ChevronRight,
  Store,
  BadgeCheck,
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
import { FLOW, cardShadow, FlowCta, useHideStackHeader } from './FlowChrome';

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
  useHideStackHeader(navigation);
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

  // ---- presentation-only values ----
  const imgBox = Math.min(140, Math.round(SCREEN_W * 0.29));
  const cardGap = 10;
  const tileW = Math.floor((Math.min(SCREEN_W, MAX_W) - 32 - cardGap) / 2);
  const twoCol = tileW >= 150; // collapse to one column on very narrow screens
  const subtitle = shop.tagline || shop.description
    || (shop.city ? `Your trusted device care partner in ${shop.city}` : null);
  // One grid: the two selectable options (existing `selected` state), then the
  // existing informational items. Only the selectable ones carry a chevron.
  const TILE = {
    ENQUIRY:  { sub: 'Get help & ask questions', tint: '#DDFBF2', color: '#00795F' },
    PICKUP:   { sub: 'We pick up from your home', tint: '#DDFBF2', color: '#00795F' },
    REPAIR:   { sub: 'Professional repair service', tint: '#ECEBFF', color: '#4338CA' },
    EXCHANGE: { sub: 'Upgrade to a new device', tint: '#F3E8FF', color: '#7C3AED' },
    VERIFIED: { sub: 'Trusted & authenticated', tint: '#FEF3D7', color: '#D97706' },
    FREEPICK: { sub: 'No extra charges', tint: '#E3EFFF', color: '#2563EB' },
  };
  const infoTiles = [
    ...FEATURE_CARDS.map((f) => ({ key: f.key, title: f.title, icon: f.icon })),
    { key: 'VERIFIED', title: 'Verified Shop', icon: Award },
    { key: 'FREEPICK', title: 'Free Pickup', icon: Truck },
  ];

  const ServiceTile = ({ k, title, Icon, selectable }) => {
    const t = TILE[k] || TILE.REPAIR;
    const isSel = selectable && selected === k;
    const body = (
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingVertical: 12, paddingLeft: 12, paddingRight: 10 }}>
        <View
          style={{
            height: 46, width: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 11,
            backgroundColor: isSel ? 'rgba(255,255,255,0.14)' : t.tint,
            borderWidth: isSel ? 1 : 0, borderColor: 'rgba(255,255,255,0.35)',
          }}
        >
          <Icon size={22} color={isSel ? '#fff' : t.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: isSel ? '#fff' : FLOW.ink }} numberOfLines={2}>{title}</Text>
          <Text style={{ fontSize: rf(11), color: isSel ? 'rgba(236,253,245,0.9)' : FLOW.muted, marginTop: 2 }} numberOfLines={2}>{t.sub}</Text>
        </View>
        {selectable && !isSel ? <ChevronRight size={18} color={FLOW.muted} style={{ marginLeft: 4 }} /> : null}
      </View>
    );
    const shell = {
      width: twoCol ? tileW : '100%', marginBottom: cardGap, borderRadius: 20, overflow: 'hidden',
      borderWidth: 1, borderColor: isSel ? '#2FBF95' : FLOW.border, backgroundColor: '#fff',
      ...(isSel ? { shadowColor: FLOW.deep, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 } : cardShadow),
    };
    const inner = isSel ? (
      <LinearGradient colors={['#006C57', '#00876A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {body}
        <View style={{ position: 'absolute', top: 7, right: 7, height: 24, width: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={14} color={FLOW.deep} strokeWidth={3} />
        </View>
      </LinearGradient>
    ) : body;
    return selectable ? (
      <Pressable onPress={() => setSelected(k)} className="active:opacity-90" accessibilityRole="button" accessibilityState={{ selected: isSel }} style={shell}>
        {inner}
      </Pressable>
    ) : (
      <View style={shell}>{inner}</View>
    );
  };

  const RoundBtn = ({ children, onPress, label, style }) => (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="active:opacity-80"
      style={{ height: 46, width: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...cardShadow, ...style }}
    >
      {children}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        {/* Hero — soft map-style illustration (decorative only). */}
        <LinearGradient colors={['#E6F7F2', '#F2FBF8', '#E8F6F8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 40, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {/* map blocks */}
            {[[0.52, 30, 70, 40], [0.7, 90, 60, 36], [0.86, 20, 54, 44], [0.6, 150, 80, 34], [0.08, 90, 70, 30], [0.3, 20, 60, 28]].map(([x, y, w, h], i) => (
              <View key={`b${i}`} style={{ position: 'absolute', left: SCREEN_W * x, top: y, width: w, height: h, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.75)', transform: [{ rotate: '-18deg' }] }} />
            ))}
            {/* roads */}
            <View style={{ position: 'absolute', left: SCREEN_W * 0.4, top: -40, width: 14, height: 320, backgroundColor: 'rgba(255,255,255,0.9)', transform: [{ rotate: '35deg' }] }} />
            <View style={{ position: 'absolute', left: SCREEN_W * 0.1, top: 110, width: SCREEN_W * 1.2, height: 12, backgroundColor: 'rgba(255,255,255,0.8)', transform: [{ rotate: '-14deg' }] }} />
            <View style={{ position: 'absolute', right: SCREEN_W * 0.08, top: 150, width: 12, height: 160, borderRadius: 6, backgroundColor: 'rgba(148,163,184,0.35)', transform: [{ rotate: '-30deg' }] }} />
            {/* trees */}
            {[[0.2, 6, 20], [0.3, 2, 26], [0.52, 190, 26], [0.9, 222, 26], [0.66, 300, 22], [0.44, 10, 18]].map(([x, y, s], i) => (
              <View key={`t${i}`} style={{ position: 'absolute', left: SCREEN_W * x, top: y, alignItems: 'center' }}>
                <View style={{ width: s, height: s * 1.3, borderRadius: s, backgroundColor: 'rgba(52,184,137,0.45)' }} />
                <View style={{ width: 2, height: 10, backgroundColor: 'rgba(0,108,87,0.35)' }} />
              </View>
            ))}
            {/* big map pin with store */}
            <View style={{ position: 'absolute', right: SCREEN_W * 0.18, top: 60, alignItems: 'center' }}>
              <MapPin size={96} color="#fff" fill="#0B8A6B" strokeWidth={1.2} />
              <View style={{ position: 'absolute', top: 20, height: 40, width: 40, borderRadius: 20, backgroundColor: '#0B8A6B', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={22} color="#fff" />
              </View>
              <View style={{ width: 34, height: 8, borderRadius: 17, backgroundColor: 'rgba(0,108,87,0.15)', marginTop: -6 }} />
            </View>
          </View>

          <SafeAreaView edges={['top']}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
              <RoundBtn onPress={() => navigation.goBack()} label="Back">
                <ArrowLeft size={21} color={FLOW.ink} />
              </RoundBtn>
              <View style={{ flexDirection: 'row' }}>
                <RoundBtn onPress={() => setBookmarked((v) => !v)} label="Save shop" style={{ marginRight: 10 }}>
                  <Bookmark size={19} color={bookmarked ? FLOW.deep : FLOW.ink} fill={bookmarked ? FLOW.deep : 'transparent'} />
                </RoundBtn>
                <RoundBtn label="Share shop">
                  <Share2 size={18} color={FLOW.ink} />
                </RoundBtn>
              </View>
            </View>
          </SafeAreaView>

          <View style={[centered, { paddingHorizontal: 20, paddingTop: 16, paddingRight: SCREEN_W * 0.4 }]}>
            <Text style={{ fontSize: rf(27), fontWeight: '900', color: FLOW.ink, letterSpacing: -0.6 }} numberOfLines={2}>{shop.name}</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: open ? FLOW.deep : '#DC2626' }}>
                <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: '#fff', marginRight: 7 }} />
                <Text style={{ color: '#fff', fontSize: rf(11.5), fontWeight: '800', letterSpacing: 0.6 }}>{open ? 'OPEN NOW' : 'CLOSED'}</Text>
              </View>
            </View>
            {subtitle ? (
              <Text style={{ fontSize: rf(13.5), color: FLOW.muted, marginTop: 8, lineHeight: rf(19) }} numberOfLines={3}>{subtitle}</Text>
            ) : null}
          </View>
        </LinearGradient>

        <View style={centered}>
          {/* Shop card */}
          <View style={{ paddingHorizontal: 16, marginTop: -26 }}>
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 26, padding: 14, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {/* Shop photos — same images as before (banner + storefront, or
                    the stock fallback), still swipeable with page dots. */}
                <View style={{ width: imgBox, height: imgBox, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E2E8F0', marginRight: 14 }}>
                  <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / imgBox))}
                  >
                    {images.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={{ width: imgBox, height: imgBox }} resizeMode="cover" />
                    ))}
                  </ScrollView>
                  {images.length > 1 ? (
                    <View pointerEvents="none" style={{ position: 'absolute', bottom: 6, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' }}>
                      {images.map((_, i) => (
                        <View key={i} style={{ height: 5, width: i === page ? 14 : 5, borderRadius: 3, marginHorizontal: 2, backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.6)' }} />
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Text style={{ flex: 1, fontSize: rf(16.5), fontWeight: '800', color: FLOW.ink, marginRight: 6 }} numberOfLines={2}>{shop.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, marginTop: 1 }}>
                      <BadgeCheck size={12} color="#fff" fill={FLOW.deep} />
                      <Text style={{ fontSize: rf(8.5), fontWeight: '800', color: FLOW.deep, marginLeft: 3, letterSpacing: 0.3 }}>VERIFIED</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: FLOW.deep, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13), marginRight: 3 }}>{rating.toFixed(1)}</Text>
                      <Star size={12} color="#fff" fill="#fff" />
                    </View>
                    <Text style={{ fontSize: rf(12.5), color: FLOW.muted }}>{(shop.reviewCount || 248).toLocaleString()} reviews</Text>
                    {shop.distanceKm != null ? (
                      <>
                        <View style={{ height: 4, width: 4, borderRadius: 2, backgroundColor: '#94A3B8', marginHorizontal: 7 }} />
                        <Text style={{ fontSize: rf(12.5), color: FLOW.muted }}>{Number(shop.distanceKm).toFixed(1)} km</Text>
                      </>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
                    <MapPin size={16} color={FLOW.muted} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: rf(12.5), color: '#334155', marginLeft: 7, lineHeight: rf(18) }}>
                      {shop.address || `${shop.city || ''}${shop.pincode ? ' ' + shop.pincode : ''}`}
                    </Text>
                  </View>
                  {(shop.phone || shop.mobile) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Phone size={15} color={FLOW.muted} />
                      <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginLeft: 7 }}>{(shop.phone || shop.mobile)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Call / Directions — same handlers */}
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <Pressable onPress={callShop} className="active:opacity-90" style={{ flex: 1, marginRight: 6, height: 52, borderRadius: 18, backgroundColor: FLOW.deep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(14.5), marginLeft: 8 }}>Call Shop</Text>
                </Pressable>
                <Pressable onPress={directions} className="active:opacity-85" style={{ flex: 1, marginLeft: 6, height: 52, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1.5, borderColor: FLOW.deep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Navigation size={17} color={FLOW.deep} />
                  <Text style={{ color: FLOW.deep, fontWeight: '800', fontSize: rf(14.5), marginLeft: 8 }} numberOfLines={1}>Get Directions</Text>
                </Pressable>
              </View>

              {/* Hours */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: FLOW.border }}>
                <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: FLOW.softMint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Clock size={23} color={FLOW.deep} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: FLOW.ink }} numberOfLines={1}>{openDays}</Text>
                  <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 2 }} numberOfLines={1}>{hoursText}</Text>
                </View>
                <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: open ? FLOW.mint : '#FEE2E2' }}>
                  <Text style={{ fontSize: rf(13), fontWeight: '800', color: open ? FLOW.deep : '#B91C1C' }}>{open ? 'OPEN' : 'CLOSED'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Services at shop */}
          <Text style={{ fontSize: rf(20), fontWeight: '800', color: FLOW.ink, paddingHorizontal: 16, marginTop: 22 }} numberOfLines={2}>Services at {shop.name}</Text>
          <Text style={{ fontSize: rf(13), color: FLOW.muted, paddingHorizontal: 16, marginTop: 3, marginBottom: 12 }}>Choose the service you need</Text>
          <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {PRIMARY_OPTIONS.map((opt) => (
              <ServiceTile key={opt.key} k={opt.key} title={opt.title} Icon={opt.icon} selectable />
            ))}
            {infoTiles.map((f) => (
              <ServiceTile key={f.key} k={f.key} title={f.title} Icon={f.icon} />
            ))}
          </View>

          {/* Service categories — what this shop repairs (Android / Apple). */}
          {serviceCats ? (
            <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
              <Text style={{ fontSize: rf(16), fontWeight: '800', color: FLOW.ink, marginBottom: 10 }}>Service Categories</Text>
              {[['android', 'Android', Smartphone, FLOW.mint, FLOW.deep], ['apple', 'Apple', Apple, '#F1F5F9', FLOW.ink]].map(([key, label, CIcon, bg, fg]) => (serviceCats[key].length ? (
                <View key={key} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 20, padding: 14, marginBottom: 10, ...cardShadow }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                      <CIcon size={15} color={fg} />
                    </View>
                    <Text style={{ fontSize: rf(14), fontWeight: '800', color: FLOW.ink }}>{label}</Text>
                    <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginLeft: 'auto' }}>{serviceCats[key].length} services</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -3 }}>
                    {serviceCats[key].map((c) => (
                      <View key={c} style={{ margin: 3, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: key === 'android' ? FLOW.softMint : '#F1F5F9' }}>
                        <Text style={{ fontSize: rf(11.5), fontWeight: '700', color: key === 'android' ? FLOW.deep : FLOW.ink }}>{c}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomActionBar>
        <FlowCta
          title={selected === 'ENQUIRY' ? 'Start Enquiry Chat' : 'Continue with this Shop'}
          onPress={onContinue}
        />
      </BottomActionBar>
    </View>
  );
}
