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

// Brand palette in the FLOW shape (035C6C · 111111 · F3F4F6 · F3F4F6 · FAA700 · F32C26).
const FLOW = {
  ...BASE_FLOW,
  primary: BRAND.green,
  deep: '#035C6C', // green text / icons (#035C6C shaded)
  ink: BRAND.ink,
  muted: '#606E87',
  mint: '#E5F3F5',
  softMint: '#F0F8F9',
  tint: '#F0F8F9',
  border: '#E8EAEE',
  bg: BRAND.bg,
};
const YELLOW_SOFT = '#FFF4D6';
const RED_SOFT = '#FEEBEA';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };


const PRIMARY_OPTIONS = [
  { key: 'ENQUIRY', title: 'Service Enquiry',  icon: MessageCircle, palette: ['#035C6C', '#035C6C'] },
  { key: 'PICKUP',  title: 'Doorstep Pickup', icon: Truck,         palette: ['#0788C9', '#0788C9'] },
];

const FEATURE_CARDS = [
  { key: 'REPAIR',   title: 'Repair your Phone',  icon: Smartphone,   accent: '#0788C9', bg: 'bg-primary/10' },
  { key: 'EXCHANGE', title: 'Smart Exchange',     icon: ShoppingCart, accent: '#0788C9', bg: 'bg-primary/10' },
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
  // Banner / logo URLs that failed to load — dropped so the fallback shows.
  const [failed, setFailed] = useState([]);
  // Width / height of the first shop image, so the banner keeps its shape.
  const [ratio, setRatio] = useState(16 / 9);
  // The shop photo from the Pickup shop list card (frontImageUrl) — passed
  // along, else read from this shop's own record (same field).
  const firstImage = params.shopImage || shop?.frontImageUrl || null;
  useEffect(() => {
    if (!firstImage) return;
    Image.getSize(firstImage, (w, h) => { if (w > 0 && h > 0) setRatio(w / h); }, () => {});
  }, [firstImage]);
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

  // Banner = the same shop photo the Pickup shop list shows (frontImageUrl).
  // If it fails to load, or the shop has none, no banner is shown.
  const images = [firstImage].filter((u) => u && !failed.includes(u));
  const markFailed = (uri) => setFailed((f) => (f.includes(uri) ? f : [...f, uri]));
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
  const bannerW = Math.min(SCREEN_W, MAX_W);
  // Image's own aspect ratio, kept between 2.4:1 and 4:3 (contain — never cropped).
  const bannerH = Math.round(Math.min(bannerW * 0.75, Math.max(bannerW / 2.4, bannerW / ratio)));
  const cardGap = 10;
  const tileW = Math.floor((Math.min(SCREEN_W, MAX_W) - 32 - cardGap) / 2);
  const twoCol = tileW >= 140; // collapse to one column on very narrow screens
  const subtitle = shop.tagline || shop.description
    || (shop.city ? `Your trusted device care partner in ${shop.city}` : null);
  // The two selectable options (existing `selected` state) as tiles; the
  // informational items are merged into the promo banner below them.
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
      <LinearGradient colors={[BRAND.green, '#035C6C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
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
        {/* Banner — the shop's image, full width under the header (open / closed on top). */}
        {images.length ? (
        <View style={{ width: bannerW, height: bannerH, alignSelf: 'center', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / bannerW))}
            >
              {images.map((uri) => (
                <Image key={uri} source={{ uri }} style={{ width: bannerW, height: bannerH }} resizeMode="contain" onError={() => markFailed(uri)} />
              ))}
            </ScrollView>
          <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: open ? BRAND.green : BRAND.red }}>
            <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 6 }} />
            <Text style={{ color: '#fff', fontSize: rf(10.5), fontWeight: '800', letterSpacing: 0.6 }}>{open ? 'OPEN NOW' : 'CLOSED'}</Text>
          </View>
          {images.length > 1 ? (
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' }}>
              {images.map((u, i) => (
                <View key={u} style={{ height: 6, width: i === page ? 16 : 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.6)' }} />
              ))}
            </View>
          ) : null}
        </View>
        ) : null}

        <View style={centered}>
          {/* Shop card */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 18, padding: 12, shadowColor: BRAND.ink, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
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
                  {subtitle ? (
                    <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 5, lineHeight: rf(16) }} numberOfLines={2}>{subtitle}</Text>
                  ) : null}
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
          {/* The two selectable options, on their own row. */}
          <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {PRIMARY_OPTIONS.map((opt) => (
              <ServiceTile key={opt.key} k={opt.key} title={opt.title} Icon={opt.icon} selectable />
            ))}
          </View>

          {/* Promo banner — the four info items merged into one card (display only). */}
          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <LinearGradient
              colors={[BRAND.green, '#035C6C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 18, padding: 14, overflow: 'hidden', ...cardShadow }}
            >
              <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: -30, height: 120, width: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <View pointerEvents="none" style={{ position: 'absolute', right: 40, bottom: -40, height: 90, width: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <Text style={{ fontSize: rf(10), fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.2 }}>WHY BOOK HERE</Text>
              <Text style={{ fontSize: rf(15), fontWeight: '800', color: '#fff', marginTop: 2 }} numberOfLines={2}>Repair, exchange & free pickup in one place</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 }}>
                {infoTiles.map((f) => {
                  const FIcon = f.icon;
                  return (
                    <View key={f.key} style={{ width: '50%', padding: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
                        <View style={{ height: 26, width: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
                          <FIcon size={14} color={FLOW.deep} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: '#fff' }} numberOfLines={1}>{f.title}</Text>
                          <Text style={{ fontSize: rf(9.5), color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>{TILE[f.key]?.sub}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </LinearGradient>
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
