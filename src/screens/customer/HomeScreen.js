import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  ListOrdered,
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
  LayoutGrid,
} from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarTotalHeight, isTabletWidth } from '../../navigation/customerTabBarMetrics';
// Partner app dashboard components (copied as-is into components/dashboard).
import { getSizeClass, withAlpha, Touchable } from '../../components/dashboard/theme';
import { DashboardSection } from '../../components/dashboard/DashboardSection';
import { DashboardSearchBar } from '../../components/dashboard/DashboardSearchBar';
import { DashboardToolGroups } from '../../components/dashboard/DashboardToolGroups';
import { ion, mci } from '../../components/dashboard/solidIcons';
import { EmptyState, Loader } from '../../components/rnr';
import { getDeviceCategories, getBanners, getCategoryMenuImages, categoryMenuKey } from '../../api/masterData';
import { listNearbyShops } from '../../api/shops';
import { listAddresses } from '../../api/customer';
import { listMyOrders } from '../../api/orders';
import { setBootProgress, finishBoot, isBootDone } from '../../boot/bootProgress';
import { getUnreadCount } from '../../api/notifications';
import { listChats, getCart } from '../../api/marketplace';
import { selectSession } from '../../store/authSlice';
import { useCustomerLocation } from '../../hooks/useCustomerLocation';
import { tokens as baseTokens } from '../../theme/colors';
import { BRAND } from '../../theme/brand';
import { tintFor, cardPastels } from '../../theme/categoryTints';
import CategoryGridCard, { HOME_MAX_W, homePad, homeRailCardWidth, homeRailGap } from '../../components/CategoryGridCard';
import { rf, rlh } from '../../utils/responsive';
import { isShopOpen } from '../../utils/shopHours';
import { useCurrentDevice, deviceName, deviceTitle, roughEstimate } from '../../utils/currentDevice';
import { SellFinalPricePopup } from './sell/SellFinalPrice';

// Home colours: the Partner app's dashboard palette (components/dashboard/
// theme PAL) mapped onto the token names this screen uses — Home is laid out
// with the Partner dashboard components, so it wears the same colours.
const tokens = {
  ...baseTokens,
  primary: '#035C6C',
  primarySoft: '#E5F3F5',
  text: '#111111',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  card: '#FFFFFF',
  border: '#E5E7EB',
  surfaceMuted: '#F3F4F6',
  background: '#F3F4F6',
  warning: '#FAA700',
  danger: '#F32C26',
  accent: '#FAA700',
};
// Teal for accent text on light backgrounds (Partner PINE).
const GREEN_TEXT = '#035C6C';
// Partner DashboardHeader band behind the identity row + search.
const HEADER_TINT = '#E2F2F4';

// Icon fallback keyed by the admin-derived category CODE ("Mobile" -> MOBILE).
// Each tint colour also drives the circular tile background on the per-service
// Repair / Sell / Buy category rails so the home grid feels lively the way
// Swiggy / Zomato category rails do.
const CODE_META = {
  MOBILE:        { icon: Smartphone, color: tokens.primary, tint: tintFor('MOBILE') },
  SMARTPHONE:    { icon: Smartphone, color: tokens.primary, tint: tintFor('SMARTPHONE') },
  LAPTOP:        { icon: Laptop,     color: tokens.primary, tint: tintFor('LAPTOP') },
  TABLET:        { icon: Tablet,     color: tokens.primary, tint: tintFor('TABLET') },
  SMARTWATCH:    { icon: Watch,      color: tokens.primary, tint: tintFor('SMARTWATCH') },
  SMARTWATCHES:  { icon: Watch,      color: tokens.primary, tint: tintFor('SMARTWATCHES') },
  WATCH:         { icon: Watch,      color: tokens.primary, tint: tintFor('WATCH') },
  AUDIO:         { icon: Headphones, color: tokens.primary, tint: tintFor('AUDIO') },
  AUDIO_DEVICES: { icon: Headphones, color: tokens.primary, tint: tintFor('AUDIO_DEVICES') },
  SPEAKER:       { icon: Volume2,    color: tokens.primary, tint: tintFor('SPEAKER') },
  SPEAKERS:      { icon: Volume2,    color: tokens.primary, tint: tintFor('SPEAKERS') },
};
const DEFAULT_META = { icon: Smartphone, color: tokens.primary, tint: tintFor('') };

// Sell-specific category art for the Home "Sell" rail, overriding whatever
// image the admin has set on the shared category row (that image is also
// used by the Repair/Buy rails, so it isn't always right for Sell).
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

// My Orders quick-access tiles — each jumps straight to that tab of the My
// Orders screen (which reads `initialTab`). Moved here from the Profile screen.
const ORDERS_GRID = [
  { label: 'Service', icon: Wrench,      tab: 'Service', color: BRAND.green, bg: '#EAF8EC' },
  { label: 'Pickup',  icon: Truck,       tab: 'Pickup',  color: BRAND.yellow, bg: '#FEF6DA' },
  { label: 'Buy',     icon: ShoppingBag, tab: 'Buy',     color: BRAND.ink,   bg: BRAND.line },
  { label: 'Sell',    icon: Tag,         tab: 'Sell',    color: BRAND.red,   bg: '#FEECEC' },
  { label: 'Enquiry', icon: MessageCircle, tab: 'Enquiry', color: GREEN_TEXT, bg: '#EAF8EC' },
];

// Solid glyphs for the Quick Access tiles — the Partner Home tool tiles use
// filled Ionicons / MaterialCommunity glyphs (white on a brand disc).
const QUICK_GLYPHS = {
  Service: mci('wrench'),
  Pickup: mci('truck'),
  Buy: ion('cart'),
  Sell: ion('pricetag'),
  Enquiry: ion('chatbubble'),
};

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
    bg: ['#FFFFFF', '#E5F3F5'],
    accent: '#035C6C',
    route: 'Repair',
  },
  {
    key: 'repair-off',
    pill: 'Limited Period Offer',
    title1: 'Up to 30% Off',
    title2: 'Screen Repairs',
    cta: 'Book Now',
    bg: ['#FFFFFF', '#FEEAE9'],
    accent: '#F32C26',
    route: 'Repair',
  },
  {
    key: 'sell-earn',
    pill: 'Instant Quote',
    title1: 'Sell & Earn',
    title2: 'Best Resale Value',
    cta: 'Sell Now',
    bg: ['#FFFFFF', '#EBF6E7'],
    accent: '#4A7029',
    route: 'Sell',
  },
  {
    key: 'pickup',
    pill: 'Doorstep Service',
    title1: 'Free Pickup',
    title2: 'At Your Doorstep',
    cta: 'Book Pickup',
    bg: ['#FFFFFF', '#E6F3FA'],
    accent: '#0788C9',
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
    bg: ['#E5F3F5'],
    accent: '#035C6C',
    titleColor: tokens.text,
    icon: Smartphone,
    route: 'Repair',
  },
  {
    key: 'exchange',
    title: 'Exchange & Save',
    sub: 'Best value on old devices',
    cta: 'Get Offer',
    bg: ['#E8F1FE'],
    accent: '#2563EB',
    titleColor: tokens.text,
    icon: Repeat,
    route: 'Sell',
  },
  {
    key: 'pickup',
    title: 'Free Pickup',
    sub: 'Doorstep in 15–30 min',
    cta: 'Try Now',
    bg: ['#EBF6E7'],
    accent: '#4A7029',
    titleColor: tokens.text,
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
const MAX_CONTENT_W = HOME_MAX_W; // shared with CategoryGridCard (Home rail card width)

export default function HomeScreen({ navigation }) {
  const session = useSelector(selectSession);
  const currentDevice = useCurrentDevice();
  const { lat, lng, addressLabel: gpsLabel, source: locSource, loading: locating, detectGps } = useCustomerLocation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);
  const [address, setAddress] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [locOpen, setLocOpen] = useState(false);
  const [gpsMode, setGpsMode] = useState(false);
  const locPickedRef = useRef(false);
  const [categories, setCategories] = useState([]);
  // Per-row tile art from the admin's Category Menu (key -> image URL).
  const [menuArt, setMenuArt] = useState({ REPAIR: {}, SELL: {}, BUY: {} });
  const [menuArtLoaded, setMenuArtLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all(['REPAIR', 'SELL', 'BUY'].map((t) => getCategoryMenuImages(t, { includeInactive: true })))
      .then(([REPAIR, SELL, BUY]) => { if (alive) setMenuArt({ REPAIR, SELL, BUY }); })
      .finally(() => { if (alive) setMenuArtLoaded(true); });
    return () => { alive = false; };
  }, []);
  const [banners, setBanners] = useState([]);
  const [ongoing, setOngoing] = useState(null);
  const [unread, setUnread] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Quick Access panel's measured width — drives the tile size (Partner tool grid).
  const [toolPanelW, setToolPanelW] = useState(0);

  // Nearby shops follow the location shown in the header: the picked saved
  // address when it has coordinates, otherwise the hook's (GPS / default).
  const qLat = !gpsMode && address?.latitude != null ? Number(address.latitude) : lat;
  const qLng = !gpsMode && address?.longitude != null ? Number(address.longitude) : lng;

  const load = useCallback(async () => {
    try {
      const [s, a, c, orders, unreadCount, chats, cart, b] = await Promise.all([
        listNearbyShops({
          lat: qLat ?? undefined,
          lng: qLng ?? undefined,
          radiusKm: qLat != null && qLng != null ? 20 : undefined,
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
      // Keep the user's explicit dropdown pick across refocus/refresh, but
      // swap in its latest saved copy so an edit made on Manage Address shows
      // here (default address if it was deleted). Before any pick: the default.
      const def = a.find((x) => x.isDefault) || a[0] || null;
      setAddress((cur) => (locPickedRef.current && cur ? a.find((x) => x.id === cur.id) || def : def));
      const active = (orders || []).find((o) => !DONE_STATES.has(String(o.status).toUpperCase()));
      setOngoing(active || (orders || [])[0] || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [qLat, qLng]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // First launch: the launch screen stays up until Home's data is in and its
  // banners / category artwork are downloaded, so Home appears complete
  // instead of images popping in one by one. Capped so a slow image can't
  // hold the app back (bootProgress also has an overall cap).
  useEffect(() => {
    if (isBootDone()) return;
    if (loading) { setBootProgress(0.55, 'Loading your home…'); return; }
    if (!menuArtLoaded) { setBootProgress(0.65, 'Loading your home…'); return; }
    const web = (list) => [...new Set(list.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)))];
    // What's on screen first (hero banner, Repair + Sell rails) gates the
    // launch screen; everything further down downloads in the background.
    const urls = web([imgUri(banners[0] || {}), ...Object.values(menuArt.REPAIR || {}), ...Object.values(menuArt.SELL || {})]);
    const later = web([...banners.slice(1).map(imgUri), ...categories.map(imgUri), ...Object.values(menuArt.BUY || {})])
      .filter((u) => !urls.includes(u));
    let doneCount = 0;
    setBootProgress(0.7, 'Loading images…');
    const all = Promise.all(urls.map((u) => Promise.resolve(Image.prefetch(u)).catch(() => false).then(() => {
      doneCount += 1;
      setBootProgress(0.7 + 0.27 * (doneCount / urls.length), 'Loading images…');
    })));
    const cap = new Promise((resolve) => setTimeout(resolve, 8000));
    Promise.race([all, cap]).then(() => {
      finishBoot();
      later.forEach((u) => { Promise.resolve(Image.prefetch(u)).catch(() => {}); });
    });
  }, [loading, menuArtLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <Loader label="Loading your home..." />;

  const gpsResolved = gpsLabel && locSource && locSource !== 'default';
  // Show the GPS "current location" when the user explicitly picked it from
  // the dropdown, or when there's no saved address to fall back to.
  const showGps = gpsMode || !address;

  // Header detail line, e.g. "Bhuvanagiri, Cuddalore - 608501".
  const savedDetail = shortAddress(address);

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

  // Partner dashboard layout scale (DashboardScreen): side padding and the
  // gap between sections, by size class.
  const sizeClass = getSizeClass(width);
  const PAD = homePad(width);
  const SECTION_GAP = sizeClass === 'tablet' ? 24 : sizeClass === 'large' ? 22 : 20;

  // Quick Access as a Partner "tool group": a white rounded panel holding a
  // wrapping grid of icon-disc tiles. All five fit one row on phones (four
  // under 360dp); tablets use the Partner six-column grid.
  const toolGridPad = sizeClass === 'tablet' ? 12 : 8;
  const toolGap = sizeClass === 'tablet' ? 12 : 8;
  const toolColumns = width >= 600 ? 6 : width < 360 ? 4 : 5;
  const toolContentW = toolPanelW > 0 ? toolPanelW - toolGridPad * 2 - 2 : Math.max(0, contentW - PAD * 2 - toolGridPad * 2 - 2);
  const toolCardW = Math.floor(Math.max(0, (toolContentW - toolGap * (toolColumns - 1)) / toolColumns));
  const toolPanelStyle = {
    marginHorizontal: PAD,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: 2,
    shadowColor: '#111111',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  };
  const quickTools = ORDERS_GRID.map((it) => ({ key: it.tab, label: it.label, icon: QUICK_GLYPHS[it.tab] || it.icon, iconColor: '#FFFFFF', tab: it.tab }));
  const openQuickTool = (tool) => navigation.navigate(['Buy', 'Sell'].includes(tool.tab) ? 'MyOrders' : 'RepairOrders', { initialTab: tool.tab });

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

  // Search bar actions: text search, voice search, device barcode scan, QR scan.
  const openSearch = () => navigation.navigate('Search');
  const openVoice = () => navigation.navigate('Search', { voice: true });
  const openScanDevice = () => navigation.navigate('Scan', { mode: 'product' });

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background }}>
      {/* Top app bar — brand mark + location header, then a full-width search
          row. White header (reference) with the location dropdown on tap. */}
      {/* Partner DashboardHeader layout: a light-cyan band holding the
          identity row (GG mark + location, white circular actions on the
          right) and the pill search bar below it. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: HEADER_TINT }}>
        <View style={[centered, { paddingHorizontal: PAD }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 10 }}>
            {/* Brand mark — "GG" monogram; taps through to Profile. */}
            <Touchable
              onPress={() => navigation.navigate('Profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={4}
              style={{
                height: sizeClass === 'tablet' ? 44 : 40, width: sizeClass === 'tablet' ? 44 : 40,
                borderRadius: sizeClass === 'tablet' ? 22 : 20, marginRight: 10,
                alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.primary,
                borderWidth: 1.5, borderColor: '#FFFFFF',
              }}
              pressedStyle={{ opacity: 0.6 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: rf(14), letterSpacing: 0.5 }}>GG</Text>
            </Touchable>
            {/* Location — bold label + chevron on top, pinned address below. */}
            <Touchable
              onPress={onLocationPress}
              accessibilityRole="button"
              accessibilityLabel={`Location: ${locationTop}. Change location`}
              style={{ flex: 1, minWidth: 0, marginRight: 10 }}
              pressedStyle={{ opacity: 0.6 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flexShrink: 1, fontSize: sizeClass === 'tablet' ? 22 : sizeClass === 'large' ? 20 : 19, lineHeight: (sizeClass === 'tablet' ? 22 : sizeClass === 'large' ? 20 : 19) + 5, fontWeight: '800', color: '#111111', marginRight: 2 }} numberOfLines={1}>
                  {locationTop}
                </Text>
                <ChevronDown size={18} color="#111111" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                <MapPin size={12} color={tokens.primary} style={{ marginRight: 3 }} />
                <Text style={{ flex: 1, fontSize: sizeClass === 'tablet' ? 14 : 13, color: tokens.textMuted }} numberOfLines={1}>
                  {locationDetail}
                </Text>
              </View>
            </Touchable>
            {/* Right: cart · notifications as white circles (Partner header actions). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: sizeClass === 'tablet' ? 14 : 8 }}>
              <HeaderAction icon={ShoppingCart} label="My Cart" badge={cartCount} badgeColor="#111111" onPress={() => navigation.navigate('MyCart')} size={sizeClass === 'tablet' ? 38 : 34} />
              <HeaderAction icon={Bell} label="Notifications" badge={unread} badgeColor={tokens.danger} onPress={() => navigation.navigate('Notifications')} size={sizeClass === 'tablet' ? 38 : 34} />
            </View>
          </View>

          {/* Search box — Partner pill bar: magnifier + placeholder (opens
              search), then camera product search and voice search. */}
          <View style={{ paddingBottom: 10, marginHorizontal: -Math.max(0, PAD - 10) }}>
            <DashboardSearchBar
              pad={0}
              placeholder="Search for products, repair, or brands..."
              onSearchPress={openSearch}
              onCameraPress={openScanDevice}
              onVoicePress={openVoice}
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" colors={[tokens.primary]} />}
        contentContainerStyle={{ paddingBottom: 32 + getTabBarTotalHeight(isTabletWidth(width), insets.bottom) }}
      >
        <View style={centered}>
          {/* Hero promo carousel — Partner banner frame (radius 20, artwork
              at its own ratio, teal paging dots). */}
          <HeroBanner navigation={navigation} contentW={contentW} banners={banners} pad={PAD} />

          {/* Sell This Device — auto-detected from the phone the app runs on
              (model + RAM/storage). "Sell Now" opens the Sell flow for a real
              shop quote; the ₹ figure here is only a rough teaser estimate.
              Drawn as a Partner shortcut card: white fading into the card's
              tint, a soft shadow in its own colour, the device photo along the
              bottom-right edge. */}
          {currentDevice.ready && (deviceName(currentDevice) || currentDevice.storageGb || currentDevice.image) ? (
            <View style={{ paddingHorizontal: PAD, marginTop: 4 }}>
              <SellDeviceCard
                height={sizeClass === 'tablet' ? 128 : 112}
                image={currentDevice.image}
                title={deviceTitle(currentDevice)}
                estimate={roughEstimate(currentDevice).toLocaleString('en-IN')}
                onPress={() => navigation.navigate('SellSelectDevice', { flow: 'SELL' })}
              />
            </View>
          ) : null}

          {/* Quick Access — one tile per order type, before the category
              rails. Service / Pickup open Repair Orders; Buy / Sell open My Orders. */}
          {/* Quick Access — Partner tool group: colour disc + title, then a
              white rounded panel with the five order-type tiles (solid brand
              discs, white glyphs). Service / Pickup open Repair Orders;
              Buy / Sell open My Orders; Enquiry opens its tab. */}
          <View style={{ marginTop: SECTION_GAP }}>
            <DashboardToolGroups
              groups={[{ label: 'Quick Access', items: quickTools, icon: LayoutGrid, color: '#035C6C' }]}
              pad={PAD}
              panelStyle={toolPanelStyle}
              onPanelLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w && w !== toolPanelW) setToolPanelW(w);
              }}
              gridPad={toolGridPad}
              columns={toolColumns}
              cardWidth={toolCardW}
              gap={toolGap}
              onPress={openQuickTool}
            />
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
                contentW={contentW}
                pad={PAD}
                gap={SECTION_GAP}
                rail={0}
                onPick={pickRepair}
                onSeeAll={() => navigation.navigate('Repair')}
                menuImages={menuArt.REPAIR}
              />
              <CategoryRail
                title="Sell"
                categories={categories}
                contentW={contentW}
                pad={PAD}
                gap={SECTION_GAP}
                rail={1}
                onPick={pickSell}
                onSeeAll={() => navigation.navigate('Sell')}
                menuImages={menuArt.SELL}
                imageOverrides={SELL_IMAGES}
              />
              <CategoryRail
                title="Buy"
                categories={categories}
                contentW={contentW}
                pad={PAD}
                gap={SECTION_GAP}
                rail={2}
                onPick={pickBuy}
                onSeeAll={() => navigation.navigate('Buy')}
                menuImages={menuArt.BUY}
              />
            </>
          )}


          {/* Nearby shops — photo-led card with a green shop badge, rating row
              and quick chat / call round buttons. */}
          {shops.length > 0 ? (
            <View style={{ marginTop: SECTION_GAP }}>
              <DashboardSection
                title={shopsTitle}
                pad={PAD}
              />
              <View style={{ paddingHorizontal: PAD }}>
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
            </View>
          ) : null}

          {/* Promo strip — two half-width offer cards side by side (like the
              reference); any further offers scroll in from the right. */}
          {/* Partner shortcut-card styling: white fading into the card's
              tint, a 1px border and soft shadow in the card's own colour. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, paddingVertical: 4, columnGap: 10 }}
            style={{ marginTop: SECTION_GAP - 4 }}
            decelerationRate="fast"
          >
            {PROMO_BANNERS.map((p) => {
              const Icon = p.icon;
              const cardW = Math.floor((contentW - PAD * 2 - 10) / (sizeClass === 'tablet' ? 3 : 2));
              return (
                <Touchable
                  key={p.key}
                  onPress={() => navigation.navigate(p.route, p.params)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.title}, ${p.sub}`}
                  style={{
                    width: cardW, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF',
                    borderWidth: 1, borderColor: withAlpha(p.accent, 0.14),
                    shadowColor: p.accent, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
                  }}
                  pressedStyle={{ opacity: 0.85 }}
                >
                  <LinearGradient
                    colors={['#FFFFFF', '#FFFFFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ padding: 12, height: 108, justifyContent: 'space-between' }}
                  >
                    <View
                      pointerEvents="none"
                      className="items-center justify-center"
                      style={{ position: 'absolute', right: -14, bottom: -14, height: 78, width: 78, borderRadius: 39, backgroundColor: withAlpha(p.accent, 0.1) }}
                    >
                      <Icon size={28} color={p.accent} style={{ marginRight: 8, marginBottom: 8 }} />
                    </View>
                    <View style={{ paddingRight: 4 }}>
                      <Text style={{ color: p.titleColor, fontWeight: '900', fontSize: rf(14.5) }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                        {p.title}
                      </Text>
                      <Text style={{ color: tokens.textMuted, fontSize: rf(10.5), marginTop: 1 }} numberOfLines={1}>
                        {p.sub}
                      </Text>
                    </View>
                    <View
                      className="flex-row items-center rounded-full"
                      style={{ alignSelf: 'flex-start', backgroundColor: p.accent, paddingHorizontal: 11, paddingVertical: 6 }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(11), marginRight: 4 }}>
                        {p.cta}
                      </Text>
                      <ArrowRight size={12} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                </Touchable>
              );
            })}
          </ScrollView>

          {/* Trust strip — four reassurance badges in one Partner panel
              (radius 16, hairline border, soft shadow), icon beside a two-line label. */}
          <View style={{ paddingHorizontal: PAD, marginTop: SECTION_GAP - 6 }}>
            <View
              className="flex-row items-stretch"
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 16,
                paddingVertical: 10,
                paddingHorizontal: 2,
                shadowColor: '#111111',
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 1,
              }}
            >
              {TRUST_BADGES.map((b, i) => {
                const Icon = b.icon;
                return (
                  <View key={b.key} className="flex-1 flex-row items-stretch">
                    <View className="flex-1 flex-row items-center" style={{ paddingHorizontal: 3 }}>
                      <Icon size={16} color={tokens.primary} style={{ marginRight: 3 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{ color: tokens.text, fontSize: rf(8.5), fontWeight: '700', lineHeight: rf(11) }}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {b.l1}
                        </Text>
                        <Text
                          style={{ color: tokens.textMuted, fontSize: rf(8), lineHeight: rf(11) }}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {b.l2}
                        </Text>
                      </View>
                    </View>
                    {i < TRUST_BADGES.length - 1 ? (
                      <View style={{ width: 1, backgroundColor: tokens.border, marginVertical: 3 }} />
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

      {/* Sell: the shop revised the price after inspection → Final Price Request popup (server pending state). */}
      <SellFinalPricePopup navigation={navigation} />
    </View>
  );
}

// Partner DashboardHeader action: a white circle on the light-cyan band with
// an optional count badge.
function HeaderAction({ icon: Icon, onPress, badge = 0, badgeColor, label, size = 34 }) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} new` : label}
      hitSlop={Math.max(0, Math.round((44 - size) / 2))}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}
      pressedStyle={{ opacity: 0.6 }}
    >
      <Icon size={size >= 38 ? 16 : 15} color="#111111" strokeWidth={2} />
      {badge > 0 ? (
        <View
          style={{
            position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
            alignItems: 'center', justifyContent: 'center', backgroundColor: badgeColor || tokens.danger, borderWidth: 1.5, borderColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Touchable>
  );
}

// "Sell This Device" as a Partner shortcut card (DashboardShortcutCards):
// white fading into the card's tint, a 1px border and soft shadow in the card's
// own colour, the device photo along the bottom-right edge, text + CTA left.
const SELL_TONE = '#4A7029';
const SELL_BG = '#EBF6E7';
function SellDeviceCard({ height, image, title, estimate, onPress }) {
  const photoH = Math.round(height * 0.86);
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Sell this device, ${title}, get up to ₹${estimate}`}
      style={{
        height, borderRadius: 18, backgroundColor: '#FFFFFF', overflow: 'hidden',
        borderWidth: 1, borderColor: withAlpha(SELL_TONE, 0.14),
        shadowColor: SELL_TONE, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
      }}
      pressedStyle={{ opacity: 0.85 }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['#FFFFFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {/* Photo / decoration along the card's bottom-right edge. */}
      <View pointerEvents="none" style={{ position: 'absolute', right: 10, bottom: -2, alignItems: 'center' }}>
        {image ? (
          <Image resizeMethod="resize" source={{ uri: image }} style={{ width: Math.round(photoH * 0.8), height: photoH }} resizeMode="contain" />
        ) : (
          <View style={{ marginBottom: 10, marginRight: 6, opacity: 0.9 }}>
            <Smartphone size={Math.round(height * 0.42)} color={SELL_TONE} strokeWidth={1.6} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 14, paddingRight: Math.round(photoH * 0.8) + 18 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: SELL_TONE }} numberOfLines={1}>Sell This Device</Text>
        <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '800', color: '#111111', marginTop: 2 }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 12.5, color: '#6B7280', marginTop: 1 }} numberOfLines={1}>
          Get up to <Text style={{ color: SELL_TONE, fontWeight: '800' }}>₹{estimate}</Text>
        </Text>
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: SELL_TONE, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 7 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginRight: 4 }}>Sell Now</Text>
          <ArrowRight size={13} color="#FFFFFF" />
        </View>
      </View>
    </Touchable>
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
        <Image resizeMethod="resize"
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
          <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: open ? tokens.primarySoft : '#FEECEC' }}>
            <Text className="font-extrabold" style={{ color: open ? GREEN_TEXT : BRAND.red, letterSpacing: 0.4, fontSize: rf(8.5) }}>
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
// "Area, District - Pincode" from a saved address — the current fields (area /
// district, set by the address form) first, the legacy columns after.
function shortAddress(a) {
  if (!a) return '';
  const head = [a.area || a.locality || a.addressLine || a.line1, a.district || a.city].filter(Boolean).join(', ');
  const pin = a.pincode ? String(a.pincode).trim() : '';
  return head && pin ? `${head} - ${pin}` : head || pin;
}

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
              <Text className="font-extrabold" style={{ color: GREEN_TEXT, fontSize: rf(14) }}>
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
                  const detail = shortAddress(a);
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
                              <Text className="font-extrabold" style={{ color: GREEN_TEXT, fontSize: rf(8.5) }}>
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
            <Text className="font-extrabold" style={{ color: GREEN_TEXT, fontSize: rf(14) }}>
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
function HeroBanner({ navigation, contentW, banners = [], pad = 16 }) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState({});
  // One page = the carousel's real width (measured), so swiping always lands
  // on a whole slide — on phones, tablets and in landscape alike.
  const [pageW, setPageW] = useState(contentW);
  const onScroll = (e) => {
    const w = e.nativeEvent.layoutMeasurement.width || pageW || 1;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== idx) setIdx(i);
  };

  // Rows without artwork (the feed has `Slider-0` rows with a null image) are
  // skipped — never drawn with the placeholder hero-banner.png.
  const slides = banners.filter((b) => imgUri(b) && !failed[b.id]);
  // Partner banner frame: height from the first artwork's OWN ratio (read via
  // Image.getSize, clamped), drawn with `contain` so it's never cropped.
  const [ratio, setRatio] = useState(BANNER_RATIO);
  const firstUri = slides[0] ? imgUri(slides[0]) : null;
  useEffect(() => {
    if (!firstUri) return;
    Image.getSize(firstUri, (w, h) => { if (w > 0 && h > 0) setRatio(Math.min(3.2, Math.max(1.5, w / h))); }, () => {});
  }, [firstUri]);
  const bannerW = Math.max(0, pageW - pad * 2);
  const bannerH = Math.round(bannerW / ratio);

  const useApi = slides.length > 0;
  const dotCount = useApi ? slides.length : HERO_SLIDES.length;

  return (
    <View style={{ marginTop: 12, marginBottom: 16, width: '100%', maxWidth: contentW, alignSelf: 'center' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => { const w = Math.round(e.nativeEvent.layout.width); if (w && w !== pageW) setPageW(w); }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={useApi ? { flexGrow: 0, height: bannerH } : undefined}
      >
        {useApi
          ? slides.map((b) => {
              const uri = imgUri(b);
              const [route, params] = bannerRoute(b);
              return (
                <View key={b.id} style={{ width: pageW, height: bannerH, paddingHorizontal: pad }}>
                  <Touchable
                    onPress={() => navigation.navigate(route, params)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={b.title || 'Promotional banner'}
                    style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF' }}
                    pressedStyle={{ opacity: 0.9 }}
                  >
                    <Image resizeMethod="resize"
                      source={{ uri }}
                      style={{ width: bannerW, height: bannerH }}
                      resizeMode="contain"
                      onError={() => setFailed((f) => ({ ...f, [b.id]: true }))}
                    />
                  </Touchable>
                </View>
              );
            })
          : HERO_SLIDES.map((s) => (
              <View key={s.key} style={{ width: pageW, paddingHorizontal: pad }}>
                <Touchable
                  onPress={() => navigation.navigate(s.route, s.params)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title1} ${s.title2}`}
                  style={{
                    borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF',
                    borderWidth: 1, borderColor: withAlpha(s.accent, 0.14),
                    shadowColor: s.accent, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
                  }}
                  pressedStyle={{ opacity: 0.9 }}
                >
                  <LinearGradient
                    colors={s.bg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
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
                    <Image resizeMethod="resize" source={HERO_BANNER_IMAGE} style={{ flex: 1, height: 138 }} resizeMode="contain" />
                  </LinearGradient>
                </Touchable>
              </View>
            ))}
      </ScrollView>
      {dotCount > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 9 }}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <View
              key={i}
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: 3,
                marginHorizontal: 3,
                backgroundColor: i === idx ? '#035C6C' : '#E5E7EB',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Per-service category rail — a titled section (Repair / Sell / Buy) with a
// "See all" action over one row of category cards. Tapping a card calls
// `onPick(category)`, which routes into that service's flow. Every card is
// the shared CategoryGridCard in `uniform` mode, so all 15 cards on Home
// (3 rails × 5) are exactly the same size: 4 per row (5 → 4 + 1), no scrolling, equal
// image box, two-line label box. Pastels per rail and category come from
// theme/categoryTints (shared with the Repair / Sell / Buy tabs).
function CategoryRail({ title, categories, contentW, pad = 16, gap = 20, rail = 0, onPick, onSeeAll, imageOverrides, menuImages }) {
  const w = contentW || 360;
  // 4 per row; width from CategoryGridCard so other screens can match Home's cards.
  const gapX = homeRailGap(w);
  const tile = homeRailCardWidth(w, pad);
  const tones = cardPastels(rail, categories.map((c) => c.code || c.name));
  return (
    <View style={{ marginTop: gap }}>
      <DashboardSection title={title} pad={pad} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gapX, paddingHorizontal: pad, paddingTop: 2, paddingBottom: 6 }}>
        {categories.map((c, idx) => {
          const code = (c.code || '').toUpperCase();
          const meta = CODE_META[code] || DEFAULT_META;
          // Row-specific admin art first, then the old per-row override, then
          // the shared category image.
          const menuArt = menuImages && (menuImages[categoryMenuKey(c.name)] || menuImages[categoryMenuKey(c.code)]);
          const uri = menuArt || (imageOverrides && imageOverrides[code]) || imgUri(c);
          return (
            <CategoryGridCard
              key={c.id}
              uniform
              name={c.name}
              uri={uri}
              Icon={meta.icon}
              iconColor={meta.color}
              width={tile}
              tone={{ bg: '#FFFFFF', border: '#E5E7EB' }}
              onPress={() => onPick(c)}
            />
          );
        })}
      </View>
    </View>
  );
}

