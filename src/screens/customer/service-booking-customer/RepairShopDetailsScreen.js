import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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
  Bookmark,
  MapPin,
  Award,
  Check,
  Apple,
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
import { FLOW as BASE_FLOW, FlowCta, useHideStackHeader } from './FlowChrome';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
import PageHeader, { HeaderIconButton, HEADER } from '../../../components/PageHeader';

const HERO_HEIGHT = 168;
const MAX_W = 600;

// Brand palette in the FLOW shape (09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141).
const FLOW = {
  ...BASE_FLOW,
  primary: BRAND.green,
  deep: '#078F23', // green text / icons (#09AD2A shaded)
  ink: BRAND.ink,
  muted: '#6B6B6B',
  mint: '#EAF8EC',
  softMint: '#F4FBF5',
  tint: '#F4FBF5',
  border: '#E6E6E6',
  bg: BRAND.bg,
};
const YELLOW_SOFT = '#FEF6DA';
const RED_SOFT = '#FEECEC';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

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
  const { width: SCREEN_W } = useWindowDimensions();

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
      <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
        <PageHeader title="Shop Details" subtitle="Shop info & services" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ height: 56, width: 56, borderRadius: 28, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <Store size={24} color={FLOW.deep} />
          </View>
          <Text style={{ fontSize: rf(13.5), color: FLOW.muted, textAlign: 'center' }}>We couldn't load this shop.</Text>
        </View>
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
  const imgBox = Math.min(112, Math.round(Math.min(SCREEN_W, MAX_W) * 0.26));
  const cardGap = 10;
  const tileW = Math.floor((Math.min(SCREEN_W, MAX_W) - 32 - cardGap) / 2);
  const twoCol = tileW >= 140; // collapse to one column on very narrow screens
  const subtitle = shop.tagline || shop.description
    || (shop.city ? `Your trusted device care partner in ${shop.city}` : null);
  // One grid: the two selectable options (existing `selected` state), then the
  // existing informational items. Only the selectable ones carry a chevron.
  const TILE = {
    ENQUIRY:  { sub: 'Get help & ask questions', tint: FLOW.mint, color: FLOW.deep },
    PICKUP:   { sub: 'We pick up from your home', tint: FLOW.mint, color: FLOW.deep },
    REPAIR:   { sub: 'Professional repair service', tint: BRAND.line, color: BRAND.ink },
    EXCHANGE: { sub: 'Upgrade to a new device', tint: RED_SOFT, color: BRAND.red },
    VERIFIED: { sub: 'Trusted & authenticated', tint: YELLOW_SOFT, color: BRAND.yellow },
    FREEPICK: { sub: 'No extra charges', tint: FLOW.mint, color: FLOW.deep },
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
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: 9, paddingLeft: 10, paddingRight: isSel ? 26 : 8 }}>
        <View
          style={{
            height: 36, width: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 9,
            backgroundColor: isSel ? 'rgba(255,255,255,0.14)' : t.tint,
            borderWidth: isSel ? 1 : 0, borderColor: 'rgba(255,255,255,0.35)',
          }}
        >
          <Icon size={18} color={isSel ? '#fff' : t.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: isSel ? '#fff' : FLOW.ink }} numberOfLines={2}>{title}</Text>
          <Text style={{ fontSize: rf(10.5), color: isSel ? 'rgba(255,255,255,0.9)' : FLOW.muted, marginTop: 1 }} numberOfLines={2}>{t.sub}</Text>
        </View>
        {selectable && !isSel ? <ChevronRight size={16} color={FLOW.muted} style={{ marginLeft: 3 }} /> : null}
      </View>
    );
    const shell = {
      width: twoCol ? tileW : '100%', marginBottom: cardGap, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: isSel ? BRAND.green : FLOW.border, backgroundColor: '#fff',
      ...(isSel ? { shadowColor: BRAND.green, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 } : cardShadow),
    };
    const inner = isSel ? (
      <LinearGradient colors={[BRAND.green, '#0A9E27']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
        {body}
        <View style={{ position: 'absolute', top: 6, right: 6, height: 20, width: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={12} color={FLOW.deep} strokeWidth={3} />
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

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <PageHeader
        title="Shop Details"
        subtitle="Shop info & services"
        onBack={() => navigation.goBack()}
        right={(
          <HeaderIconButton
            icon={Bookmark}
            label="Save shop"
            color={bookmarked ? HEADER.action : HEADER.title}
            fill={bookmarked ? HEADER.action : undefined}
            onPress={() => setBookmarked((v) => !v)}
          />
        )}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        {/* Hero — soft map-style illustration (decorative only). */}
        <LinearGradient colors={['#EAF8EC', '#F8F8F8', '#F1FAF2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 34, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {/* map blocks */}
            {[[0.52, 30, 70, 40], [0.7, 90, 60, 36], [0.86, 20, 54, 44], [0.6, 150, 80, 34], [0.08, 90, 70, 30], [0.3, 20, 60, 28]].map(([x, y, w, h], i) => (
              <View key={`b${i}`} style={{ position: 'absolute', left: SCREEN_W * x, top: y, width: w, height: h, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.75)', transform: [{ rotate: '-18deg' }] }} />
            ))}
            {/* roads */}
            <View style={{ position: 'absolute', left: SCREEN_W * 0.4, top: -40, width: 14, height: 320, backgroundColor: 'rgba(255,255,255,0.9)', transform: [{ rotate: '35deg' }] }} />
            <View style={{ position: 'absolute', left: SCREEN_W * 0.1, top: 110, width: SCREEN_W * 1.2, height: 12, backgroundColor: 'rgba(255,255,255,0.8)', transform: [{ rotate: '-14deg' }] }} />
            <View style={{ position: 'absolute', right: SCREEN_W * 0.08, top: 150, width: 12, height: 160, borderRadius: 6, backgroundColor: 'rgba(30,30,30,0.08)', transform: [{ rotate: '-30deg' }] }} />
            {/* trees */}
            {[[0.64, 6, 16], [0.94, 64, 18], [0.7, 196, 20], [0.9, 222, 22], [0.66, 300, 20], [0.82, 4, 14]].map(([x, y, s], i) => (
              <View key={`t${i}`} style={{ position: 'absolute', left: SCREEN_W * x, top: y, alignItems: 'center' }}>
                <View style={{ width: s, height: s * 1.3, borderRadius: s, backgroundColor: 'rgba(9,173,42,0.30)' }} />
                <View style={{ width: 2, height: 10, backgroundColor: 'rgba(30,30,30,0.18)' }} />
              </View>
            ))}
            {/* big map pin with store */}
            <View style={{ position: 'absolute', right: SCREEN_W * 0.16, top: 42, alignItems: 'center' }}>
              <MapPin size={78} color="#fff" fill={BRAND.green} strokeWidth={1.2} />
              <View style={{ position: 'absolute', top: 16, height: 34, width: 34, borderRadius: 17, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center' }}>
                <Store size={18} color="#fff" />
              </View>
              <View style={{ width: 28, height: 7, borderRadius: 14, backgroundColor: 'rgba(30,30,30,0.10)', marginTop: -5 }} />
            </View>
          </View>

          <View style={[centered, { paddingHorizontal: 18, paddingTop: 14, paddingRight: Math.min(SCREEN_W, MAX_W) * 0.38 }]}>
            <Text style={{ fontSize: rf(22), fontWeight: '900', color: FLOW.ink, letterSpacing: -0.5 }} numberOfLines={2}>{shop.name}</Text>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: open ? BRAND.green : BRAND.red }}>
                <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 6 }} />
                <Text style={{ color: '#fff', fontSize: rf(10.5), fontWeight: '800', letterSpacing: 0.6 }}>{open ? 'OPEN NOW' : 'CLOSED'}</Text>
              </View>
            </View>
            {subtitle ? (
              <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 6, lineHeight: rf(17) }} numberOfLines={3}>{subtitle}</Text>
            ) : null}
          </View>
        </LinearGradient>

        <View style={centered}>
          {/* Shop card */}
          <View style={{ paddingHorizontal: 16, marginTop: -22 }}>
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 18, padding: 12, shadowColor: BRAND.ink, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {/* Shop photos — same images as before (banner + storefront, or
                    the stock fallback), still swipeable with page dots. */}
                <View style={{ width: imgBox, height: imgBox, borderRadius: 14, overflow: 'hidden', backgroundColor: BRAND.line, marginRight: 11 }}>
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
                    <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: FLOW.ink, marginRight: 6 }} numberOfLines={2}>{shop.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, marginTop: 1 }}>
                      <BadgeCheck size={12} color="#fff" fill={BRAND.green} />
                      <Text style={{ fontSize: rf(8.5), fontWeight: '800', color: FLOW.deep, marginLeft: 3, letterSpacing: 0.3 }}>VERIFIED</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.green, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginRight: 7 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(12), marginRight: 3 }}>{rating.toFixed(1)}</Text>
                      <Star size={11} color={BRAND.yellow} fill={BRAND.yellow} />
                    </View>
                    <Text style={{ fontSize: rf(11.5), color: FLOW.muted }}>{(shop.reviewCount || 248).toLocaleString()} reviews</Text>
                    {shop.distanceKm != null ? (
                      <>
                        <View style={{ height: 4, width: 4, borderRadius: 2, backgroundColor: BRAND.ring, marginHorizontal: 6 }} />
                        <Text style={{ fontSize: rf(11.5), fontWeight: '700', color: FLOW.deep }}>{Number(shop.distanceKm).toFixed(1)} km</Text>
                      </>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 7 }}>
                    <MapPin size={14} color={BRAND.red} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: rf(11.5), color: BRAND.body, marginLeft: 6, lineHeight: rf(16) }} numberOfLines={3}>
                      {shop.address || `${shop.city || ''}${shop.pincode ? ' ' + shop.pincode : ''}`}
                    </Text>
                  </View>
                  {(shop.phone || shop.mobile) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Phone size={13} color={FLOW.deep} />
                      <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginLeft: 6 }}>{(shop.phone || shop.mobile)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Call / Directions — same handlers */}
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <Pressable onPress={callShop} className="active:opacity-90" accessibilityRole="button" style={{ flex: 1, marginRight: 5, height: 44, borderRadius: 14, backgroundColor: BRAND.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13.5), marginLeft: 7 }}>Call Shop</Text>
                </Pressable>
                <Pressable onPress={directions} className="active:opacity-85" accessibilityRole="button" style={{ flex: 1, marginLeft: 5, height: 44, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: BRAND.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Navigation size={15} color={BRAND.green} />
                  <Text style={{ color: FLOW.deep, fontWeight: '800', fontSize: rf(13.5), marginLeft: 7 }} numberOfLines={1}>Get Directions</Text>
                </Pressable>
              </View>

              {/* Hours */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: BRAND.line }}>
                <View style={{ height: 36, width: 36, borderRadius: 18, backgroundColor: YELLOW_SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Clock size={17} color={BRAND.yellow} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: rf(13), fontWeight: '800', color: FLOW.ink }} numberOfLines={1}>{openDays}</Text>
                  <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 1 }} numberOfLines={1}>{hoursText}</Text>
                </View>
                <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: open ? FLOW.mint : RED_SOFT }}>
                  <Text style={{ fontSize: rf(11), fontWeight: '800', color: open ? FLOW.deep : BRAND.red }}>{open ? 'OPEN' : 'CLOSED'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Services at shop */}
          <Text style={{ fontSize: rf(16.5), fontWeight: '800', color: FLOW.ink, paddingHorizontal: 16, marginTop: 18 }} numberOfLines={2}>Services at {shop.name}</Text>
          <Text style={{ fontSize: rf(11.5), color: FLOW.muted, paddingHorizontal: 16, marginTop: 1, marginBottom: 10 }}>Choose the service you need</Text>
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
              <Text style={{ fontSize: rf(15), fontWeight: '800', color: FLOW.ink, marginBottom: 8 }}>Service Categories</Text>
              {[['android', 'Android', Smartphone, FLOW.mint, FLOW.deep], ['apple', 'Apple', Apple, BRAND.line, FLOW.ink]].map(([key, label, CIcon, bg, fg]) => (serviceCats[key].length ? (
                <View key={key} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 16, padding: 11, marginBottom: 9, ...cardShadow }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                      <CIcon size={15} color={fg} />
                    </View>
                    <Text style={{ fontSize: rf(14), fontWeight: '800', color: FLOW.ink }}>{label}</Text>
                    <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginLeft: 'auto' }}>{serviceCats[key].length} services</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -3 }}>
                    {serviceCats[key].map((c) => (
                      <View key={c} style={{ margin: 3, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: key === 'android' ? FLOW.mint : BRAND.line }}>
                        <Text style={{ fontSize: rf(11), fontWeight: '700', color: key === 'android' ? FLOW.deep : FLOW.ink }}>{c}</Text>
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
          palette={BRAND_FLOW}
        />
      </BottomActionBar>
    </View>
  );
}
