import React, { useCallback, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import {
  Bell,
  MapPin,
  ChevronDown,
  ChevronRight,
  Search,
  Camera,
  Mic,
  QrCode,
  Wrench,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Truck,
  Smartphone,
  Laptop,
  Tablet,
  Watch,
  Headphones,
  Volume2,
  Star,
  MessageCircle,
  Headset,
  Phone,
  ShieldCheck,
  BadgeCheck,
  Lock,
  Store,
  ArrowRight,
  Navigation,
  Plus,
  Check,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loader } from '../../components/rnr';
import { getDeviceCategories, getBanners } from '../../api/masterData';
import { listNearbyShops } from '../../api/shops';
import { listAddresses } from '../../api/customer';
import { listMyOrders } from '../../api/orders';
import { getUnreadCount } from '../../api/notifications';
import { listChats, getCart } from '../../api/marketplace';
import { selectSession } from '../../store/authSlice';
import { useCustomerLocation } from '../../hooks/useCustomerLocation';
import { tokens } from '../../theme/colors';
import { rf, rlh } from '../../utils/responsive';
import { isShopOpen } from '../../utils/shopHours';
import { useCurrentDevice, deviceName, deviceTitle, roughEstimate } from '../../utils/currentDevice';

// Icon fallback keyed by the admin-derived category CODE ("Mobile" -> MOBILE).
// Each tint colour also drives the circular tile background on the per-service
// Repair / Sell / Buy category rails so the home grid feels lively the way
// Swiggy / Zomato category rails do.
const CODE_META = {
  MOBILE:        { icon: Smartphone, color: tokens.primary,  tint: '#DCFCE7' },
  SMARTPHONE:    { icon: Smartphone, color: tokens.primary,  tint: '#DCFCE7' },
  LAPTOP:        { icon: Laptop,     color: '#6D28D9',       tint: '#EDE9FE' },
  TABLET:        { icon: Tablet,     color: '#0369A1',       tint: '#E0F2FE' },
  SMARTWATCH:    { icon: Watch,      color: '#B45309',       tint: '#FEF3C7' },
  SMARTWATCHES:  { icon: Watch,      color: '#B45309',       tint: '#FEF3C7' },
  WATCH:         { icon: Watch,      color: '#B45309',       tint: '#FEF3C7' },
  AUDIO:         { icon: Headphones, color: '#BE185D',       tint: '#FCE7F3' },
  AUDIO_DEVICES: { icon: Headphones, color: '#BE185D',       tint: '#FCE7F3' },
  SPEAKER:       { icon: Volume2,    color: '#0E9384',       tint: '#D1FAE5' },
  SPEAKERS:      { icon: Volume2,    color: '#0E9384',       tint: '#D1FAE5' },
};
const DEFAULT_META = { icon: Smartphone, color: tokens.primary, tint: '#DCFCE7' };

// My Orders quick-access tiles — each jumps straight to that tab of the My
// Orders screen (which reads `initialTab`). Moved here from the Profile screen.
const ORDERS_GRID = [
  { label: 'Service', icon: Wrench,      tab: 'Service', color: '#004C40', bg: '#DCFCE7' },
  { label: 'Pickup',  icon: Truck,       tab: 'Pickup',  color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Buy',     icon: ShoppingBag, tab: 'Buy',     color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Sell',    icon: Tag,         tab: 'Sell',    color: '#C2410C', bg: '#FFEDD5' },
];

// Preferred display order for category tiles (backend returns them
// alphabetically). Unknown codes fall to the end, alphabetically.
const CATEGORY_ORDER = ['MOBILE', 'SMARTPHONE', 'LAPTOP', 'TABLET', 'SMARTWATCH', 'SMARTWATCHES', 'WATCH', 'AUDIO', 'AUDIO_DEVICES', 'AUDIO_DEVICE', 'SPEAKER', 'SPEAKERS'];
function sortByPreferredOrder(list) {
  const rank = (c) => {
    const i = CATEGORY_ORDER.indexOf((c.code || '').toUpperCase());
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...list].sort((a, b) => {
    const d = rank(a) - rank(b);
    return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
  });
}

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return url || null;
}

// "0.295…" -> "295 m"; "1.23" -> "1.2 km". null when not usable.
function formatDistance(d) {
  if (d === null || d === undefined || d === '') return null;
  const n = Number(d);
  if (!isFinite(n) || n < 0) return null;
  if (n < 0.05) return '< 50 m';
  return n < 1 ? `${Math.round(n * 1000)} m away` : `${n.toFixed(1)} km away`;
}
// Rough drive-time estimate (30 km/h city average) for the shop card.
function driveEta(km) {
  const n = Number(km);
  if (!isFinite(n) || n <= 0) return '15 min';
  return `${Math.max(5, Math.round((n / 30) * 60))} min`;
}

// Hero promo carousel shown at the very top of the feed. The artwork on the
// right of each slide is assets/hero-banner.png — swap that single file to
// change the image for all slides (keep a transparent PNG for best results).
const HERO_BANNER_IMAGE = require('../../../assets/hero-banner.png');
const HERO_SLIDES = [
  {
    key: 'welcome',
    pill: 'Your Tech. Our Expertise.',
    title1: 'Fast. Trusted.',
    title2: 'Tech Solutions',
    cta: 'Explore Now',
    bg: ['#E9FBF0', '#C7F5D9'],
    accent: tokens.primary,
    route: 'Repair',
  },
  {
    key: 'repair-off',
    pill: 'Limited Period Offer',
    title1: 'Up to 30% Off',
    title2: 'Screen Repairs',
    cta: 'Book Now',
    bg: ['#E8F1FE', '#C7DEFD'],
    accent: '#2563EB',
    route: 'Repair',
  },
  {
    key: 'sell-earn',
    pill: 'Instant Quote',
    title1: 'Sell & Earn',
    title2: 'Best Resale Value',
    cta: 'Sell Now',
    bg: ['#FFF3E6', '#FEDCB6'],
    accent: tokens.accent,
    route: 'Sell',
  },
  {
    key: 'pickup',
    pill: 'Doorstep Service',
    title1: 'Free Pickup',
    title2: 'At Your Doorstep',
    cta: 'Book Pickup',
    bg: ['#F1ECFE', '#DDD0FB'],
    accent: '#7C3AED',
    route: 'RepairSelectDevice',
    params: { flow: 'REPAIR' },
  },
];

const ENQUIRY_TILE = {
  title: 'Service Enquiry',
  sub: 'Chat with nearby repair shops – pick one and message directly',
  icon: Headset,
  accent: tokens.primary,
  tint: tokens.primarySoft,
  route: 'ChatInbox',
};

// Horizontally scrolling promo strip below the shop list (Swiggy/Zomato
// bottom-of-feed offer rail). Icons stand in for promo artwork.
const PROMO_BANNERS = [
  {
    key: 'screen',
    title: 'Up to 30% OFF',
    sub: 'on Screen Repairs',
    cta: 'Book Now',
    bg: ['#E9FBF0', '#CFF6DE'],
    accent: tokens.primary,
    titleColor: tokens.text,
    icon: Smartphone,
    route: 'Repair',
  },
  {
    key: 'exchange',
    title: 'Exchange & Save',
    sub: 'Best value on old devices',
    cta: 'Get Offer',
    bg: ['#E8F1FE', '#CFE0FD'],
    accent: '#2563EB',
    titleColor: '#1D4ED8',
    icon: Repeat,
    route: 'Sell',
  },
  {
    key: 'pickup',
    title: 'Free Pickup',
    sub: 'Doorstep in 15–30 min',
    cta: 'Try Now',
    bg: ['#F1ECFE', '#DFD3FB'],
    accent: '#7C3AED',
    titleColor: '#6D28D9',
    icon: Truck,
    route: 'RepairSelectDevice',
    params: { flow: 'REPAIR' },
  },
];

// Bottom trust strip — four reassurance badges in one bordered card.
const TRUST_BADGES = [
  { key: 'trust', icon: ShieldCheck, l1: 'Trusted by', l2: '10,000+ customers' },
  { key: 'genuine', icon: BadgeCheck, l1: 'Genuine Parts', l2: '& Warranty' },
  { key: 'secure', icon: Lock, l1: 'Secure Payment', l2: '100% Safe' },
  { key: 'quick', icon: Truck, l1: 'Quick Pickup', l2: '15-30 min' },
];

const DONE_STATES = new Set(['COMPLETED', 'CANCELLED', 'DELIVERED', 'CLOSED', 'REJECTED']);

// Keep content readable on tablets/large screens.
const MAX_CONTENT_W = 720;

export default function HomeScreen({ navigation }) {
  const session = useSelector(selectSession);
  const currentDevice = useCurrentDevice();
  const { lat, lng, addressLabel: gpsLabel, source: locSource, loading: locating, detectGps } = useCustomerLocation();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);
  const [address, setAddress] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [locOpen, setLocOpen] = useState(false);
  const [gpsMode, setGpsMode] = useState(false);
  const locPickedRef = useRef(false);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [ongoing, setOngoing] = useState(null);
  const [unread, setUnread] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, a, c, orders, unreadCount, chats, cart, b] = await Promise.all([
        listNearbyShops({
          lat: lat ?? undefined,
          lng: lng ?? undefined,
          radiusKm: lat != null && lng != null ? 20 : undefined,
        }).catch(() => []),
        listAddresses().catch(() => []),
        getDeviceCategories().catch(() => []),
        listMyOrders({ orderType: 'REPAIR' }).catch(() => []),
        getUnreadCount().catch(() => 0),
        listChats().catch(() => []),
        getCart().catch(() => []),
        getBanners().catch(() => []),
      ]);
      setShops(s);
      setUnread(unreadCount || 0);
      setCartCount((cart || []).reduce((n, it) => n + (it.quantity || 1), 0));
      setCategories(sortByPreferredOrder((c || []).filter((x) => x.isActive !== false)));
      // Hero carousel is admin-managed via master_banners. Keep only active
      // rows and honour the admin's sortOrder (the endpoint already sorts, but
      // we re-sort defensively in case of mixed responses).
      setBanners(
        (b || [])
          .filter((x) => x.isActive !== false)
          .sort((m, n) => (m.sortOrder ?? 0) - (n.sortOrder ?? 0)),
      );
      setAddresses(a || []);
      // Keep the user's explicit dropdown pick across refocus/refresh; only
      // auto-select the default address on the very first load.
      const def = a.find((x) => x.isDefault) || a[0] || null;
      if (!locPickedRef.current) setAddress(def);
      const active = (orders || []).find((o) => !DONE_STATES.has(String(o.status).toUpperCase()));
      setOngoing(active || (orders || [])[0] || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lat, lng]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <Loader label="Loading your home..." />;

  const gpsResolved = gpsLabel && locSource && locSource !== 'default';
  // Show the GPS "current location" when the user explicitly picked it from
  // the dropdown, or when there's no saved address to fall back to.
  const showGps = gpsMode || !address;

  // Include the pincode at the end of the address detail line so the
  // header looks like "Bhuvanagiri, Cuddalore - 608501".
  const savedDetail = address
    ? (() => {
        const parts = [address.line1 || address.locality, address.city].filter(Boolean);
        const head = parts.join(', ');
        const pin = address.pincode ? String(address.pincode).trim() : '';
        if (head && pin) return `${head} - ${pin}`;
        return head || pin || '';
      })()
    : '';

  const locationTop = showGps
    ? (locating ? 'Locating…' : 'Current Location')
    : (address.label || address.tag || 'Home');
  const locationDetail = showGps
    ? (locating ? 'Detecting your location…' : gpsResolved ? gpsLabel : 'Tap to detect or pick')
    : savedDetail;

  // Area label for the "Repair shops in …" heading — follows the ACTIVE
  // location so picking current location updates the heading.
  const gpsArea = gpsResolved && gpsLabel ? String(gpsLabel).split(/\s*[,-]\s*/)[0].trim() : '';
  const shopsTitle = 'Nearby Repair Shops';

  // Tapping the pill opens the location dropdown (current location + saved
  // addresses) instead of silently detecting GPS.
  const onLocationPress = () => setLocOpen(true);
  const chooseGps = async () => {
    locPickedRef.current = true;
    setGpsMode(true);
    setLocOpen(false);
    await detectGps();
  };
  const chooseAddress = (a) => {
    locPickedRef.current = true;
    setGpsMode(false);
    setAddress(a);
    setLocOpen(false);
  };
  const addAddress = () => {
    setLocOpen(false);
    navigation.navigate('ManageAddress');
  };

  const contentW = Math.min(width, MAX_CONTENT_W);
  const isTablet = width >= 700;
  const centered = { width: '100%', maxWidth: MAX_CONTENT_W, alignSelf: 'center' };

  // Per-service category routing — each rail drops the customer straight into
  // that service's flow with the tapped category pre-selected (mirrors the
  // routes CategoryServiceMenu uses). "See all" jumps to the service tab.
  const catParams = (c) => ({
    categoryId: c.id,
    categoryCode: (c.code || '').toUpperCase(),
    categoryName: c.name,
  });
  const pickRepair = (c) => navigation.navigate('RepairSelectDevice', { flow: 'REPAIR', ...catParams(c) });
  const pickSell = (c) => navigation.navigate('SellSelectDevice', { flow: 'SELL', ...catParams(c) });
  const pickBuy = (c) => navigation.navigate('BuyCategory', { categoryId: c.id, categoryName: c.name });

  const openSearch = () => navigation.navigate('Repair');

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background }}>
      {/* Top app bar — brand mark + location header, then a full-width search
          row. White header (reference) with the location dropdown on tap. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: tokens.card }}>
        <View className="flex-row items-center px-4 pt-2.5 pb-2" style={centered}>
          {/* Brand mark — green "GG" monogram; taps through to Profile. */}
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            className="h-11 w-11 rounded-full items-center justify-center active:opacity-80 mr-2.5"
            style={{ backgroundColor: tokens.primary }}
          >
            <Text className="text-white font-black" style={{ fontSize: rf(15), letterSpacing: 0.5 }}>GG</Text>
          </Pressable>
          {/* Location — bold label + chevron on top, pinned address below. */}
          <Pressable
            onPress={onLocationPress}
            className="flex-1 active:opacity-80 mr-2"
          >
            <View className="flex-row items-center">
              <Text className="font-extrabold text-text mr-1" style={{ fontSize: rf(16) }} numberOfLines={1}>
                {locationTop}
              </Text>
              <ChevronDown size={16} color={tokens.text} />
            </View>
            <View className="flex-row items-center mt-0.5">
              <MapPin size={11} color={tokens.primary} style={{ marginRight: 3 }} />
              <Text className="text-text-muted flex-1" style={{ fontSize: rf(11.5) }} numberOfLines={1}>
                {locationDetail}
              </Text>
            </View>
          </Pressable>
          {/* Right-side actions: search, cart, notifications — outlined circles. */}
          <IconCircle icon={Search} onPress={openSearch} />
          <IconCircle
            icon={ShoppingCart}
            onPress={() => navigation.navigate('MyCart')}
            badge={cartCount}
            badgeColor={tokens.text}
          />
          <IconCircle
            icon={Bell}
            onPress={() => navigation.navigate('Notifications')}
            badge={unread}
            badgeColor={tokens.danger}
            last
          />
        </View>

        {/* Search row — magnifier, placeholder and camera / mic / QR actions. */}
        <View className="px-4 pb-3 pt-1" style={centered}>
          <Pressable
            onPress={openSearch}
            className="flex-row items-center rounded-2xl px-4 active:opacity-80"
            style={{ backgroundColor: tokens.surfaceMuted, borderWidth: 1, borderColor: tokens.border, height: 50 }}
          >
            <Search size={19} color={tokens.textSubtle} />
            <Text className="text-text-muted ml-2.5 flex-1" style={{ fontSize: rf(13) }} numberOfLines={1}>
              Search for products, repair, or brands...
            </Text>
            <Camera size={19} color={tokens.textMuted} style={{ marginLeft: 6 }} />
            <Mic size={19} color={tokens.textMuted} style={{ marginLeft: 12 }} />
            <QrCode size={19} color={tokens.primary} style={{ marginLeft: 12 }} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={centered}>
          {/* Hero promo carousel — full-bleed banner with device artwork,
              headline, CTA and paging dots. */}
          <HeroBanner navigation={navigation} contentW={contentW} banners={banners} />

          {/* Sell This Device — auto-detected from the phone the app runs on
              (model + RAM/storage). "Sell Now" opens the Sell flow for a real
              shop quote; the ₹ figure here is only a rough teaser estimate. */}
          {currentDevice.ready && (deviceName(currentDevice) || currentDevice.storageGb || currentDevice.image) ? (
            <View style={{ paddingHorizontal: 14, marginTop: 14 }}>
              <Pressable
                onPress={() => navigation.navigate('SellSelectDevice', { flow: 'SELL' })}
                className="active:opacity-90 flex-row items-center"
                style={{ backgroundColor: tokens.card, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, padding: 10 }}
              >
                {currentDevice.image ? (
                  <Image
                    source={{ uri: currentDevice.image }}
                    style={{ height: 54, width: 54, borderRadius: 12, backgroundColor: tokens.primarySoft, marginRight: 12 }}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={{
                      height: 54, width: 54, borderRadius: 12,
                      backgroundColor: tokens.primarySoft,
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}
                  >
                    <Smartphone size={26} color={tokens.primary} />
                  </View>
                )}
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: tokens.primary, fontWeight: '800', fontSize: rf(11) }}>Sell This Device</Text>
                  <Text style={{ color: tokens.text, fontWeight: '800', fontSize: rf(13), marginTop: 1 }} numberOfLines={1}>
                    {deviceTitle(currentDevice)}
                  </Text>
                  <Text style={{ color: tokens.textMuted, fontSize: rf(11.5), marginTop: 1 }} numberOfLines={1}>
                    Get up to <Text style={{ color: tokens.primary, fontWeight: '800' }}>₹{roughEstimate(currentDevice).toLocaleString('en-IN')}</Text>
                  </Text>
                </View>
                <View className="rounded-full" style={{ backgroundColor: tokens.primary, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(12) }}>Sell Now</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* My Orders quick-access — one tile per order type, before the
              category rails. Each jumps to that tab of the My Orders screen. */}
          <SectionHeader
            title="My Orders"
            action="View all"
            onAction={() => navigation.navigate('MyOrders', { initialTab: 'Service' })}
          />
          <View className="flex-row" style={{ paddingHorizontal: 14, columnGap: 9 }}>
            {ORDERS_GRID.map((it) => {
              const Icon = it.icon;
              return (
                <Pressable
                  key={it.tab}
                  onPress={() => navigation.navigate('MyOrders', { initialTab: it.tab })}
                  className="active:opacity-90"
                  style={{
                    flex: 1, alignItems: 'center',
                    backgroundColor: tokens.card, borderRadius: 16,
                    borderWidth: 1, borderColor: tokens.border, paddingVertical: 12,
                  }}
                >
                  <View
                    style={{
                      height: 40, width: 40, borderRadius: 14,
                      backgroundColor: it.bg,
                      alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                    }}
                  >
                    <Icon size={19} color={it.color} />
                  </View>
                  <Text style={{ color: tokens.text, fontWeight: '700', fontSize: rf(11) }} numberOfLines={1}>
                    {it.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Shop by category, split by service. Each rail lists every
              published category and drops the customer into that service's
              flow for the tapped device. "See all" opens the service tab. */}
          {categories.length === 0 ? (
            <View className="px-4 mt-4">
              <EmptyState title="No categories yet" description="Device categories will appear here once published." />
            </View>
          ) : (
            <>
              <CategoryRail
                title="Repair"
                categories={categories}
                onPick={pickRepair}
                onSeeAll={() => navigation.navigate('Repair')}
              />
              <CategoryRail
                title="Sell"
                categories={categories}
                onPick={pickSell}
                onSeeAll={() => navigation.navigate('Sell')}
              />
              <CategoryRail
                title="Buy"
                categories={categories}
                onPick={pickBuy}
                onSeeAll={() => navigation.navigate('Buy')}
              />
            </>
          )}

          {/* Service Enquiry — full-width support card with a "Chat Now" pill. */}
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Pressable
              onPress={() => navigation.navigate(ENQUIRY_TILE.route)}
              className="active:opacity-90 flex-row items-center"
              style={{
                borderRadius: 16,
                padding: 12,
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              <View
                className="h-11 w-11 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: ENQUIRY_TILE.tint }}
              >
                <ENQUIRY_TILE.icon size={20} color={ENQUIRY_TILE.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.text, fontWeight: '800', fontSize: rf(15) }} numberOfLines={1}>
                  {ENQUIRY_TILE.title}
                </Text>
                <Text style={{ color: tokens.textMuted, fontSize: rf(11.5), marginTop: 2 }} numberOfLines={2}>
                  {ENQUIRY_TILE.sub}
                </Text>
              </View>
              <View
                className="flex-row items-center rounded-full ml-2"
                style={{ backgroundColor: tokens.primarySoft, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: tokens.primary, fontWeight: '800', fontSize: rf(12), marginRight: 4 }}>
                  Chat Now
                </Text>
                <ArrowRight size={14} color={tokens.primary} />
              </View>
            </Pressable>
          </View>

          {/* Ongoing booking — promoted card so a repeat customer hits "their"
              booking without scrolling. */}
          {ongoing ? (
            <View className="px-4 mt-4">
              <Pressable
                onPress={() => {
                  const ticketRef = ongoing.payload?.ticketId;
                  if (ticketRef) {
                    navigation.navigate('ServiceTicketDetails', { ticketId: ticketRef, fromOrders: true });
                    return;
                  }
                  const bookingRef = ongoing.payload?.bookingId || ongoing.referenceId;
                  if (bookingRef) navigation.navigate('RepairOrderDetails', { bookingId: bookingRef });
                  else navigation.navigate('MyOrders');
                }}
                className="rounded-2xl p-3 active:opacity-90 flex-row items-center"
                style={{ backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }}
              >
                {(() => {
                  const p = ongoing.payload || {};
                  const thumb = p.deviceImageUrl || p.deviceImage || p.imageUrl || p.masterImageUrl || ongoing.imageUrl || null;
                  return thumb ? (
                    <Image
                      source={{ uri: thumb }}
                      className="mr-3"
                      style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: tokens.primarySoft }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      className="h-12 w-12 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: tokens.primarySoft }}
                    >
                      <Smartphone size={22} color={tokens.primary} />
                    </View>
                  );
                })()}
                <View className="flex-1 pr-2">
                  <Text className="font-extrabold mb-0.5" style={{ color: tokens.primary, letterSpacing: 1, fontSize: rf(10) }}>
                    ONGOING
                  </Text>
                  <Text className="font-extrabold text-text" style={{ fontSize: rf(13) }} numberOfLines={1}>
                    {ongoing.payload?.title || `Booking #${ongoing.orderNumber || ''}`}
                  </Text>
                  <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }} numberOfLines={1}>
                    {ongoing.payload?.deviceName || ongoing.orderType}
                    {ongoing.createdAt ? ` · ${new Date(ongoing.createdAt).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: tokens.primarySoft }}
                >
                  <Text className="font-extrabold" style={{ color: tokens.primary, fontSize: rf(10) }}>
                    {(ongoing.status || 'ACTIVE').replace(/_/g, ' ')}
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* Nearby shops — photo-led card with a green shop badge, rating row
              and quick chat / call round buttons. */}
          {shops.length > 0 ? (
            <>
              <SectionHeader
                title={shopsTitle}
                action="See all"
                onAction={() => navigation.navigate('NearbyShops')}
              />
              <View className="px-4">
                {shops.slice(0, 3).map((s) => (
                  <View key={s.id} className="mb-2.5">
                    <NearbyShopCard
                      shop={s}
                      onPress={() => navigation.navigate('ShopDetails', { shopId: s.id })}
                      onChat={() => navigation.navigate('ShopChat', { shopId: s.id, mode: 'ENQUIRY' })}
                      onCall={() => { if (s.phone) Linking.openURL(`tel:${s.phone}`); }}
                    />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Promo strip — horizontally scrolling offer cards (no heading, to
              mirror the reference bottom-of-feed offer rail). */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 2 }}
            style={{ marginTop: 18 }}
            decelerationRate="fast"
          >
            {PROMO_BANNERS.map((p) => {
              const Icon = p.icon;
              const cardW = Math.round(contentW * 0.78);
              return (
                <Pressable
                  key={p.key}
                  onPress={() => navigation.navigate(p.route, p.params)}
                  style={{ width: cardW, marginHorizontal: 4 }}
                  className="active:opacity-90"
                >
                  <LinearGradient
                    colors={p.bg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      minHeight: 116,
                      flexDirection: 'row',
                      alignItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: p.titleColor, fontWeight: '900', fontSize: rf(18) }} numberOfLines={1}>
                        {p.title}
                      </Text>
                      <Text style={{ color: tokens.textMuted, fontSize: rf(12), marginTop: 2 }} numberOfLines={1}>
                        {p.sub}
                      </Text>
                      <View
                        className="flex-row items-center rounded-full mt-3"
                        style={{ alignSelf: 'flex-start', backgroundColor: p.accent, paddingHorizontal: 13, paddingVertical: 7 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(12), marginRight: 4 }}>
                          {p.cta}
                        </Text>
                        <ArrowRight size={14} color="#FFFFFF" />
                      </View>
                    </View>
                    <View
                      className="items-center justify-center"
                      style={{ height: 62, width: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.55)' }}
                    >
                      <Icon size={30} color={p.accent} />
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Trust strip — four reassurance badges in one bordered card. */}
          <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
            <View
              className="flex-row items-stretch"
              style={{
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 16,
                paddingVertical: 12,
              }}
            >
              {TRUST_BADGES.map((b, i) => {
                const Icon = b.icon;
                return (
                  <View key={b.key} className="flex-1 flex-row items-stretch">
                    <View className="flex-1 items-center justify-center px-1">
                      <Icon size={20} color={tokens.primary} />
                      <Text
                        className="text-center mt-1.5"
                        style={{ color: tokens.text, fontSize: rf(9.5), fontWeight: '700', lineHeight: rf(12) }}
                        numberOfLines={1}
                      >
                        {b.l1}
                      </Text>
                      <Text
                        className="text-center"
                        style={{ color: tokens.textMuted, fontSize: rf(9.5), lineHeight: rf(12) }}
                        numberOfLines={1}
                      >
                        {b.l2}
                      </Text>
                    </View>
                    {i < TRUST_BADGES.length - 1 ? (
                      <View style={{ width: 1, backgroundColor: tokens.border, marginVertical: 4 }} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Location dropdown — current location + saved addresses picker. */}
      <LocationSheet
        open={locOpen}
        onClose={() => setLocOpen(false)}
        addresses={addresses}
        activeId={address?.id}
        gpsMode={gpsMode}
        gpsLabel={gpsLabel}
        gpsResolved={gpsResolved}
        locating={locating}
        onChooseGps={chooseGps}
        onChooseAddress={chooseAddress}
        onAddAddress={addAddress}
      />
    </View>
  );
}

// Outlined circular header action button with an optional count badge.
function IconCircle({ icon: Icon, onPress, badge = 0, badgeColor, last }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 rounded-full items-center justify-center active:opacity-80"
      style={{
        backgroundColor: tokens.card,
        borderWidth: 1,
        borderColor: tokens.border,
        marginRight: last ? 0 : 8,
      }}
    >
      <Icon size={19} color={tokens.text} strokeWidth={2} />
      {badge > 0 ? (
        <View
          className="absolute -top-1 -right-1 rounded-full min-w-[17px] h-[17px] px-1 items-center justify-center"
          style={{ backgroundColor: badgeColor || tokens.primary, borderWidth: 1.5, borderColor: tokens.card }}
        >
          <Text className="text-white font-bold" style={{ fontSize: rf(9) }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Nearby-shop card. Storefront thumbnail (falls back to a tinted store icon),
// a green shop badge next to the name, rating / distance / eta line, and two
// quick-action round buttons (chat + call) on the right.
function NearbyShopCard({ shop, onPress, onChat, onCall }) {
  const thumb = shop.frontImageUrl || shop.imageUrl || shop.photoUrl || shop.coverImageUrl || shop.logoUrl || null;
  const dist = formatDistance(shop.distanceKm);
  const rating = shop.rating || 4.8;
  const reviews = shop.reviewCount || shop.reviews || 245;
  // Live OPEN / CLOSED from the shop's hours; unknown hours default to open.
  const open = isShopOpen(shop) ?? true;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-90"
      style={{
        backgroundColor: tokens.card,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 16,
        padding: 10,
      }}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{ width: 62, height: 62, borderRadius: 12, backgroundColor: tokens.surfaceMuted }}
          resizeMode="cover"
        />
      ) : (
        <View
          className="items-center justify-center"
          style={{ width: 62, height: 62, borderRadius: 12, backgroundColor: tokens.primarySoft }}
        >
          <Store size={26} color={tokens.primary} />
        </View>
      )}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <View
            className="items-center justify-center rounded-md mr-1.5"
            style={{ height: 18, width: 18, backgroundColor: tokens.primary }}
          >
            <Text className="text-white font-black" style={{ fontSize: rf(10) }}>
              {(shop.name || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text className="font-extrabold text-text mr-2" numberOfLines={1} style={{ flexShrink: 1, fontSize: rf(14.5) }}>
            {shop.name}
          </Text>
          <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: open ? tokens.primarySoft : '#FEE2E2' }}>
            <Text className="font-extrabold" style={{ color: open ? tokens.primary : '#B91C1C', letterSpacing: 0.4, fontSize: rf(8.5) }}>
              {open ? 'OPEN' : 'CLOSED'}
            </Text>
          </View>
        </View>
        {shop.address || shop.city ? (
          <View className="flex-row items-center mt-1">
            <MapPin size={11} color={tokens.textMuted} />
            <Text className="text-text-muted ml-1 flex-1" style={{ fontSize: rf(11.5) }} numberOfLines={1}>
              {shop.address || shop.city}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center mt-1.5">
          <Star size={12} color={tokens.warning} fill={tokens.warning} />
          <Text className="font-bold text-text ml-1" style={{ fontSize: rf(11.5) }}>{Number(rating).toFixed(1)}</Text>
          <Text className="text-text-muted ml-1" style={{ fontSize: rf(11.5) }}>({reviews})</Text>
          {dist ? <Text className="text-text-muted mx-1.5" style={{ fontSize: rf(11.5) }}>·</Text> : null}
          {dist ? <Text className="text-text-muted" style={{ fontSize: rf(11.5) }}>{dist}</Text> : null}
          <Text className="text-text-muted mx-1.5" style={{ fontSize: rf(11.5) }}>·</Text>
          <Text className="text-text-muted" style={{ fontSize: rf(11.5) }}>{driveEta(shop.distanceKm)}</Text>
        </View>
      </View>
      <View className="flex-row items-center ml-1.5" style={{ columnGap: 8 }}>
        <Pressable
          onPress={onChat}
          className="h-10 w-10 rounded-full items-center justify-center active:opacity-80"
          style={{ backgroundColor: tokens.surfaceMuted, borderWidth: 1, borderColor: tokens.border }}
        >
          <MessageCircle size={17} color={tokens.primary} />
        </Pressable>
        <Pressable
          onPress={onCall}
          className="h-10 w-10 rounded-full items-center justify-center active:opacity-80"
          style={{ backgroundColor: tokens.primarySoft }}
        >
          <Phone size={17} color={tokens.primary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// Location picker bottom-sheet. Opened by tapping the header location pill.
// Lists "Use current location" (GPS) first with a navigation icon, then every
// saved address, then an "Add new address" action — the Swiggy/Zomato pattern.
function LocationSheet({
  open, onClose, addresses, activeId, gpsMode, gpsLabel, gpsResolved,
  locating, onChooseGps, onChooseAddress, onAddAddress,
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: tokens.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 28,
          }}
        >
          {/* Grabber */}
          <View className="items-center pt-3 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border }} />
          </View>

          <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
            <Text className="font-extrabold text-text" style={{ fontSize: rf(16) }}>Select location</Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 rounded-full items-center justify-center"
              style={{ backgroundColor: tokens.surfaceMuted }}
            >
              <X size={16} color={tokens.text} />
            </Pressable>
          </View>

          {/* Use current location */}
          <Pressable onPress={onChooseGps} className="flex-row items-center px-5 py-3 active:opacity-80">
            <View
              className="h-10 w-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: tokens.primarySoft }}
            >
              <Navigation size={18} color={tokens.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold" style={{ color: tokens.primary, fontSize: rf(14) }}>
                Use current location
              </Text>
              <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11.5) }} numberOfLines={1}>
                {locating ? 'Detecting…' : gpsResolved ? gpsLabel : 'Detect via GPS'}
              </Text>
            </View>
            {gpsMode ? (
              <Check size={18} color={tokens.primary} />
            ) : (
              <ChevronRight size={18} color={tokens.textSubtle} />
            )}
          </Pressable>

          <View style={{ height: 1, backgroundColor: tokens.border, marginHorizontal: 20, marginVertical: 4 }} />

          {/* Saved addresses */}
          {addresses.length > 0 ? (
            <>
              <Text
                className="font-extrabold text-text-muted px-5 pt-2 pb-1"
                style={{ letterSpacing: 0.6, fontSize: rf(11) }}
              >
                SAVED ADDRESSES
              </Text>
              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                {addresses.map((a) => {
                  const active = !gpsMode && a.id === activeId;
                  const detail = [a.line1 || a.locality, a.city, a.pincode].filter(Boolean).join(', ');
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => onChooseAddress(a)}
                      className="flex-row items-center px-5 py-3 active:opacity-80"
                    >
                      <View
                        className="h-10 w-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: tokens.surfaceMuted }}
                      >
                        <MapPin size={18} color={tokens.text} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="font-extrabold text-text mr-2" style={{ fontSize: rf(14) }} numberOfLines={1}>
                            {a.label || a.tag || 'Address'}
                          </Text>
                          {a.isDefault ? (
                            <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: tokens.primarySoft }}>
                              <Text className="font-extrabold" style={{ color: tokens.primary, fontSize: rf(8.5) }}>
                                DEFAULT
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11.5) }} numberOfLines={1}>
                          {detail}
                        </Text>
                      </View>
                      {active ? <Check size={18} color={tokens.primary} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {/* Add new address */}
          <Pressable onPress={onAddAddress} className="flex-row items-center px-5 py-3 mt-1 active:opacity-80">
            <View
              className="h-10 w-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: tokens.surfaceMuted, borderWidth: 1, borderColor: tokens.border }}
            >
              <Plus size={18} color={tokens.primary} />
            </View>
            <Text className="font-extrabold" style={{ color: tokens.primary, fontSize: rf(14) }}>
              Add new address
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Banner CTA routing — derives the destination from the banner's linkTarget or
// its title keyword so a tapped banner still lands somewhere useful even when
// the admin hasn't set an explicit link target.
function bannerRoute(b) {
  const t = String(b?.linkTarget || b?.title || '').toLowerCase();
  if (t.includes('sell')) return ['Sell'];
  if (t.includes('buy')) return ['Buy'];
  if (t.includes('pickup')) return ['RepairSelectDevice', { flow: 'REPAIR' }];
  return ['Repair'];
}

// Aspect ratio the admin banner artwork is authored at (2076 × 757). Used to
// size each full-bleed slide so the designed banner is never cropped.
const BANNER_RATIO = 2076 / 757;

// Top-of-feed promo carousel. Prefers the admin-managed `master_banners` feed:
// each slide is that banner's full-bleed artwork (title + CTAs are baked into
// the image, so we don't overlay the admin title on top). Falls back to the
// built-in gradient slides when the banner feed is empty or unreachable.
function HeroBanner({ navigation, contentW, banners = [] }) {
  const [idx, setIdx] = useState(0);
  const onScroll = (e) => {
    const w = e.nativeEvent.layoutMeasurement.width || contentW || 1;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== idx) setIdx(i);
  };

  const useApi = banners.length > 0;
  const dotCount = useApi ? banners.length : HERO_SLIDES.length;

  return (
    <View className="mt-3">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {useApi
          ? banners.map((b) => {
              const uri = imgUri(b);
              const [route, params] = bannerRoute(b);
              return (
                <View key={b.id} style={{ width: contentW }} className="px-4">
                  <Pressable
                    onPress={() => navigation.navigate(route, params)}
                    className="active:opacity-95"
                    accessibilityRole="imagebutton"
                    accessibilityLabel={b.title || 'Promotional banner'}
                  >
                    <Image
                      source={uri ? { uri } : HERO_BANNER_IMAGE}
                      style={{
                        width: '100%',
                        aspectRatio: BANNER_RATIO,
                        borderRadius: 18,
                        backgroundColor: tokens.surfaceMuted,
                      }}
                      resizeMode="cover"
                    />
                  </Pressable>
                </View>
              );
            })
          : HERO_SLIDES.map((s) => (
              <View key={s.key} style={{ width: contentW }} className="px-4">
                <Pressable
                  onPress={() => navigation.navigate(s.route, s.params)}
                  className="active:opacity-95"
                >
                  <LinearGradient
                    colors={s.bg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 20,
                      overflow: 'hidden',
                      minHeight: 168,
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 18,
                    }}
                  >
                    <View style={{ flex: 1.4, paddingRight: 6 }}>
                      {s.pill ? (
                        <View
                          className="self-start rounded-full mb-2.5"
                          style={{ backgroundColor: 'rgba(255,255,255,0.72)', paddingHorizontal: 10, paddingVertical: 4 }}
                        >
                          <Text style={{ color: s.accent, fontWeight: '800', fontSize: rf(10.5) }} numberOfLines={1}>
                            {s.pill}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={{ color: tokens.text, fontWeight: '900', fontSize: rf(22), lineHeight: rf(27) }}>
                        {s.title1}
                      </Text>
                      <Text style={{ color: s.accent, fontWeight: '900', fontSize: rf(22), lineHeight: rf(27) }}>
                        {s.title2}
                      </Text>
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: tokens.primary,
                          borderRadius: 999,
                          paddingHorizontal: 16,
                          paddingVertical: 9,
                          marginTop: 14,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(12.5), marginRight: 4 }}>
                          {s.cta}
                        </Text>
                        <ArrowRight size={15} color="#FFFFFF" />
                      </View>
                    </View>
                    <Image source={HERO_BANNER_IMAGE} style={{ flex: 1, height: 138 }} resizeMode="contain" />
                  </LinearGradient>
                </Pressable>
              </View>
            ))}
      </ScrollView>
      {dotCount > 1 ? (
        <View className="flex-row justify-center items-center mt-2.5">
          {Array.from({ length: dotCount }).map((_, i) => (
            <View
              key={i}
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: 3,
                marginHorizontal: 3,
                backgroundColor: i === idx ? tokens.primary : tokens.border,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Per-service category rail — a titled section (Repair / Sell / Buy) with a
// "See all" action over a horizontal strip of circular category tiles. Tapping
// a tile calls `onPick(category)` which routes into that service's flow. The
// tile visuals mirror the old discovery rail (admin image, else a coded icon).
function CategoryRail({ title, categories, onPick, onSeeAll }) {
  return (
    <>
      <SectionHeader title={title} action="See all" onAction={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 2, paddingBottom: 4 }}
      >
        {categories.map((c) => {
          const meta = CODE_META[(c.code || '').toUpperCase()] || DEFAULT_META;
          const Icon = meta.icon;
          const uri = imgUri(c);
          return (
            <Pressable
              key={c.id}
              onPress={() => onPick(c)}
              className="items-center active:opacity-80"
              style={{ width: 78, marginHorizontal: 4 }}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{
                  width: 66,
                  height: 66,
                  // This View draws only the ring + border. The circular CLIP is
                  // done by the inner View below — NOT here. On Android a single
                  // View that combines borderWidth + borderRadius + overflow
                  // 'hidden' fails to clip its <Image> child, so the square image
                  // corners showed through the circle. Keeping the border here and
                  // the clip on a borderless inner View is the reliable fix.
                  backgroundColor: uri ? tokens.card : meta.tint,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                {uri ? (
                  // Borderless clip disc, sized 2px smaller than the ring. An
                  // exact half-size borderRadius (30 of 60) is a guaranteed circle
                  // on both platforms — unlike an oversized 999 value on Android.
                  // `contain` + padding shows the WHOLE device centered (never
                  // cropped by the circle), so devices of different shapes read as
                  // a uniform row instead of getting their edges cut off.
                  <View
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      overflow: 'hidden',
                      backgroundColor: tokens.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 5,
                    }}
                  >
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                ) : (
                  <Icon size={26} color={meta.color} />
                )}
              </View>
              <Text
                className="font-bold text-text text-center mt-2"
                style={{ fontSize: rf(11) }}
                numberOfLines={1}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

// Local SectionHeader so the heading rhythm (16/14, accent action) stays
// consistent across rails without depending on the legacy rnr SectionHeader
// signature.
function SectionHeader({ title, action, onAction }) {
  return (
    <View className="flex-row items-end justify-between px-4 mt-5 mb-2.5">
      <Text className="font-extrabold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} className="active:opacity-70 flex-row items-center">
          <Text
            className="font-extrabold mr-0.5"
            style={{ color: tokens.primary, fontSize: rf(12) }}
          >
            {action}
          </Text>
          <ChevronRight size={14} color={tokens.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
