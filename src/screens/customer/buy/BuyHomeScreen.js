import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Search, ShoppingCart, History, Bell, ChevronRight, X, Plus, SlidersHorizontal,
  LayoutGrid, Tag, BadgeCheck, TrendingUp, Smartphone, ClipboardList, Store, ArrowRight, User, MapPin, Package,
  CheckCircle2, Cpu, Percent, Star, Zap,
} from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { getDeviceCategories, getBanners, getCategoryMenuImages, categoryMenuKey } from '../../../api/masterData';
import { listProducts, getCart, addToCart } from '../../../api/marketplace';
import { getUnreadCount } from '../../../api/notifications';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Partner app Buy palette — green #035C6C, ink #111111, neutrals #F3F4F6 / #F3F4F6.
const GREEN = '#035C6C';
const GREEN_DARK = '#035C6C';   // green text / icons
const GREEN_LIGHT = '#E5F3F5';  // tiles, icon circles
const INK = '#111111';
const MUTED = '#606E87';
const HINT = '#8E97A9';
const FIELD = '#F3F4F6';
const LINE = '#E8EAEE';
const PAGE_BG = '#FFFFFF';
const RED = '#F32C26';
const YELLOW = '#FFD60A';

const MAX_W = 720;
const PAD = 16;

const cardShadow = {
  shadowColor: INK, shadowOpacity: 0.06, shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 }, elevation: 2,
};

// Display order for the strip (backend returns categories alphabetically).
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

const SORTS = [
  { key: 'default', label: 'Recommended' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
];
const MAX_PRICES = [null, 10000, 20000, 30000, 50000];

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const imageOf = (x) => resolveDeviceImageSource({ url: x?.imageUrl, base64: x?.imageBase64 });

// Price + optional original price for a product. The discount and the
// struck-through price only render when the listing actually carries a
// higher original price — nothing is invented.
function pricing(p) {
  const price = Number(p?.price);
  const was = [p?.mrp, p?.originalPrice, p?.marketPrice, p?.listPrice]
    .map(Number)
    .find((v) => Number.isFinite(v) && v > 0);
  const hasPrice = Number.isFinite(price) && price > 0;
  const old = hasPrice && was > price ? was : null;
  const off = Number(p?.discountPercent) > 0
    ? Math.round(Number(p.discountPercent))
    : old ? Math.round(((old - price) / old) * 100) : 0;
  return { price: hasPrice ? price : null, old, off };
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native. Press feedback
// uses the `active:` className.
function SectionHead({ icon, title, onViewAll }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, marginTop: 18, marginBottom: 10 }}>
      {icon}
      <Text style={{ flex: 1, marginLeft: 6, fontSize: rf(13.5), fontWeight: '800', color: INK }}>{title}</Text>
      {onViewAll ? (
        <Pressable onPress={onViewAll} className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ fontSize: rf(12), fontWeight: '800', color: GREEN_DARK }}>View all</Text>
          <ChevronRight size={15} color={GREEN_DARK} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Header icon with an optional red dot (unread) or count badge (cart).
function HeaderBadgeIcon({ Icon, label, dot, count, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={{ height: 40, width: 38, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={24} color={INK} strokeWidth={2} />
      {dot ? <View style={{ position: 'absolute', top: 7, right: 7, height: 9, width: 9, borderRadius: 5, backgroundColor: RED, borderWidth: 1.5, borderColor: '#FFFFFF' }} /> : null}
      {count ? (
        <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Deal of the Day card: badge, photo, 2-line title, rating (when the listing
// has one), price · MRP · % off (only with a real higher MRP), Add to Cart + Buy Now.
function DealCard({ product, width, onPress, onAdd, onBuy, adding }) {
  const { price, old, off } = pricing(product);
  const uri = imageOf(product);
  const badge = product.badge || (product.bestseller || product.isBestseller ? 'Bestseller' : null) || product.conditionLabel;
  const rating = Number(product.rating ?? product.averageRating);
  const reviews = Number(product.reviewCount ?? product.ratingCount);
  const imgH = Math.round(width * 0.62);
  return (
    <View style={{ width, marginRight: 10, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, ...cardShadow }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={product.title || 'Product'} className="active:opacity-90" style={{ padding: 10, paddingBottom: 6 }}>
        <View style={{ height: 20, flexDirection: 'row', alignItems: 'center' }}>
          {badge ? (
            <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#2563EB', maxWidth: '100%' }}>
              <Text numberOfLines={1} style={{ fontSize: rf(9.5), fontWeight: '800', color: '#FFFFFF' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ height: imgH, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}>
          {uri ? <Image resizeMethod="resize" source={{ uri }} style={{ width: '86%', height: '100%' }} resizeMode="contain" /> : (
            <View style={{ width: imgH * 0.7, height: imgH * 0.7, borderRadius: 16, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={30} color={GREEN_DARK} />
            </View>
          )}
        </View>
        <Text numberOfLines={2} style={{ marginTop: 8, fontSize: rf(12.5), lineHeight: rf(16), minHeight: rf(32), fontWeight: '600', color: INK }}>{product.title || 'Device'}</Text>
        <View style={{ height: 20, marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
          {rating > 0 ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: '#16A34A' }}>
                <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={{ marginLeft: 3, fontSize: rf(10.5), fontWeight: '800', color: '#FFFFFF' }}>{rating.toFixed(1)}</Text>
              </View>
              {reviews > 0 ? <Text style={{ marginLeft: 5, fontSize: rf(10.5), color: MUTED }}>({reviews >= 1000 ? `${(reviews / 1000).toFixed(1)}K` : reviews})</Text> : null}
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
          <Text numberOfLines={1} style={{ fontSize: rf(15), fontWeight: '800', color: INK, marginRight: 6 }}>{price != null ? inr(price) : 'Price on request'}</Text>
          {old ? <Text numberOfLines={1} style={{ fontSize: rf(10.5), color: HINT, textDecorationLine: 'line-through', marginRight: 6 }}>{inr(old)}</Text> : null}
          {off > 0 ? <Text style={{ fontSize: rf(11), fontWeight: '800', color: '#16A34A' }}>{off}% off</Text> : null}
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingBottom: 10 }}>
        <Pressable onPress={onAdd} disabled={adding} accessibilityRole="button" accessibilityLabel="Add to cart" className="active:opacity-80"
          style={{ flex: 1, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#C9CED6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: adding ? 0.5 : 1 }}>
          <ShoppingCart size={12} color={INK} />
          <Text numberOfLines={1} style={{ marginLeft: 3, fontSize: rf(10.5), fontWeight: '800', color: INK }}>Add to Cart</Text>
        </Pressable>
        <Pressable onPress={onBuy} disabled={adding} accessibilityRole="button" accessibilityLabel="Buy now" className="active:opacity-80"
          style={{ flex: 1, height: 32, borderRadius: 8, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', opacity: adding ? 0.5 : 1 }}>
          <Text numberOfLines={1} style={{ fontSize: rf(10.5), fontWeight: '800', color: INK }}>Buy Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OptionChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-80"
      style={{
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginRight: 8, marginBottom: 8,
        backgroundColor: active ? GREEN : '#FFFFFF', borderWidth: 1, borderColor: active ? GREEN : LINE,
      }}
    >
      <Text style={{ fontSize: rf(12), fontWeight: '700', color: active ? '#FFFFFF' : INK }}>{label}</Text>
    </Pressable>
  );
}

export default function BuyHomeScreen({ navigation }) {
  const [cats, setCats] = useState([]);
  const [menuImages, setMenuImages] = useState({});
  const [buyBanners, setBuyBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [adding, setAdding] = useState(null);
  const [slide, setSlide] = useState(0);
  // Banner width/height, read from the first banner image (2:1 until known).
  const [bannerRatio, setBannerRatio] = useState(2);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [maxPrice, setMaxPrice] = useState(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bannerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, banners, prods, imgs] = await Promise.all([
          getDeviceCategories(),
          getBanners().catch(() => []),
          listProducts({ status: 'ACTIVE' }).catch(() => []),
          getCategoryMenuImages('BUY', { includeInactive: true }),
        ]);
        setCats(sortCategories((list || []).filter((c) => c.isActive !== false)));
        setMenuImages(imgs || {});
        // Hero shows ONLY the admin banner(s) titled "Buy" (image only).
        setBuyBanners(
          (banners || [])
            .filter((b) => b.isActive !== false && String(b.title || '').trim().toLowerCase() === 'buy')
            .map((b) => ({ key: String(b.id), uri: imageOf(b) }))
            .filter((b) => b.uri),
        );
        setProducts(prods || []);
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const first = buyBanners[0]?.uri;
    if (!first) return;
    Image.getSize(first, (w, h) => { if (w > 0 && h > 0) setBannerRatio(w / h); }, () => {});
  }, [buyBanners]);

  // Header counters refresh whenever the tab regains focus.
  const refreshHeader = useCallback(async () => {
    const [cart, count] = await Promise.all([
      getCart().catch(() => null),
      getUnreadCount().catch(() => null),
    ]);
    if (cart) setCartCount(cart.reduce((n, it) => n + (it.quantity || 1), 0));
    if (count != null) setUnread(Number(count) || 0);
  }, []);
  useFocusEffect(useCallback(() => { refreshHeader(); }, [refreshHeader]));

  const openCategory = (c) => {
    navigation.navigate('BuyListing', {
      categoryId: c.id,
      categoryCode: (c.code || '').toUpperCase(),
      categoryName: c.name,
      title: c.name,
      layout: 'list',
    });
  };
  const openAll = () => navigation.navigate('BuyListing', {});

  const activeFilters = (sortBy !== 'default' ? 1 : 0) + (maxPrice ? 1 : 0);
  // Search text + Filters go to the listing (q / sort / maxPrice params).
  const runSearch = () => {
    const q = searchText.trim();
    if (!q && !activeFilters) { openAll(); return; }
    navigation.navigate('BuyListing', {
      q: q || undefined,
      sort: sortBy !== 'default' ? sortBy : undefined,
      maxPrice: maxPrice || undefined,
      title: q || (maxPrice ? `Under ${inr(maxPrice)}` : 'All products'),
    });
  };

  const add = async (p, buyNow) => {
    setAdding(p.id);
    try {
      await addToCart(p.id, 1);
      refreshHeader();
      if (buyNow) navigation.navigate('MyCart'); else notify('Added', 'Added to cart');
    } catch (e) { notify('Error', e.message); }
    finally { setAdding(null); }
  };

  const contentW = Math.min(width, MAX_W);
  const bannerW = contentW - PAD * 2;
  const bannerH = Math.round(bannerW / bannerRatio);
  // Two deal cards per screen with the next one peeking in (reference layout).
  const dealW = Math.max(160, Math.round((contentW - PAD - 10) / 2.1));
  const tileW = Math.round((contentW - PAD * 2 - 8 * 4) / 4.6);
  // Fallback hero photo: the first live listing that has one.
  const heroImage = products.map(imageOf).find(Boolean) || null;
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  // Deals: listings with a real discount first (largest first), then the rest.
  const deals = [...products]
    .sort((a, b) => pricing(b).off - pricing(a).off)
    .slice(0, 10);

  // Auto-scroll the banners every 3.5 s (loops back to the first).
  useEffect(() => {
    if (buyBanners.length < 2 || !bannerW) return undefined;
    const t = setInterval(() => {
      const next = (slide + 1) % buyBanners.length;
      bannerRef.current?.scrollTo({ x: next * bannerW, animated: true });
      setSlide(next);
    }, 3500);
    return () => clearInterval(t);
  }, [slide, buyBanners.length, bannerW]);

  const onBannerScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (bannerW || 1));
    if (i !== slide) setSlide(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG, paddingTop: insets.top }}>
      {/* ---------- Header: brand · bell · history · cart ---------- */}
      <View style={[centered, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 6 }]}>
        <Image source={require('../../../../assets/logo.png')} style={{ width: 42, height: 42 }} resizeMode="contain" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: rf(20), fontWeight: '800', color: GREEN }}>NearGFix</Text>
          <Text style={{ fontSize: rf(11.5), color: INK, marginTop: -1 }}>Buy • Sell • Repair</Text>
        </View>
        <HeaderBadgeIcon Icon={Bell} label="Notifications" dot={unread > 0} onPress={() => navigation.navigate('Notifications')} />
        <HeaderBadgeIcon Icon={History} label="Order History" onPress={() => navigation.navigate('MyOrders', { initialTab: 'Buy' })} />
        <HeaderBadgeIcon Icon={ShoppingCart} label="My Cart" count={cartCount} onPress={() => navigation.navigate('MyCart')} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={centered}>
          {/* Search + filters box */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginHorizontal: PAD, gap: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, paddingHorizontal: 12, height: 46, ...cardShadow }}>
              <Pressable onPress={() => runSearch()} hitSlop={6} accessibilityLabel="Search">
                <Search size={19} color={INK} />
              </Pressable>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={() => runSearch()}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Search for mobiles, laptops, tablets, accessories..."
                placeholderTextColor={HINT}
                style={{ flex: 1, marginLeft: 10, color: INK, fontSize: rf(12.5), padding: 0, outlineStyle: 'none' }}
              />
              {searchText ? (
                <Pressable onPress={() => setSearchText('')} hitSlop={6} accessibilityLabel="Clear search" style={{ height: 28, width: 28, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} color={MUTED} />
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => setShowFilters(true)} accessibilityRole="button" accessibilityLabel="Filters"
              style={{ height: 46, width: 46, borderRadius: 14, borderWidth: 1, borderColor: activeFilters > 0 ? GREEN : LINE, backgroundColor: activeFilters > 0 ? GREEN : '#F4FAFB', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={19} color={activeFilters > 0 ? '#FFFFFF' : GREEN} />
            </Pressable>
          </View>

          {/* Hero — admin "Buy" banners when published, else the built-in hero. */}
          {buyBanners.length ? (
            <View style={{ marginTop: 14 }}>
              <View style={{ marginHorizontal: PAD, height: bannerH, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF', ...cardShadow }}>
                <ScrollView ref={bannerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onBannerScroll} scrollEventThrottle={16} style={{ width: bannerW, height: bannerH, flexGrow: 0 }}>
                  {buyBanners.map((b) => (
                    <Pressable key={b.key} onPress={openAll} accessibilityRole="imagebutton" accessibilityLabel="Buy offer banner" style={{ width: bannerW, height: bannerH }}>
                      <Image resizeMethod="resize" source={{ uri: b.uri }} style={{ width: bannerW, height: bannerH }} resizeMode="contain" />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              {buyBanners.length > 1 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
                  {buyBanners.map((b, i) => <View key={b.key} style={{ height: 6, width: i === slide ? 18 : 8, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === slide ? GREEN : '#D2D6DD' }} />)}
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable onPress={openAll} accessibilityRole="button" accessibilityLabel="Shop now"
              style={{ marginHorizontal: PAD, marginTop: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#CFEFF0', flexDirection: 'row', alignItems: 'center', padding: 16, minHeight: 150 }}>
              <View style={{ flex: 1.15, minWidth: 0 }}>
                <Text style={{ fontSize: rf(19), lineHeight: rf(23), fontWeight: '800', color: INK }}>Buy Devices{'\n'}from Verified Shops</Text>
                {['Genuine Products', 'Warranty Options', 'Pickup or Home Delivery'].map((t) => (
                  <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                    <CheckCircle2 size={13} color={GREEN} />
                    <Text style={{ marginLeft: 5, fontSize: rf(11), color: INK }}>{t}</Text>
                  </View>
                ))}
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 10, height: 34, paddingHorizontal: 16, borderRadius: 999, backgroundColor: YELLOW }}>
                  <Text style={{ fontSize: rf(13), fontWeight: '800', color: INK }}>Shop Now</Text>
                  <ArrowRight size={15} color={INK} style={{ marginLeft: 6 }} />
                </View>
              </View>
              {heroImage ? <Image source={{ uri: heroImage }} style={{ flex: 1, height: 120 }} resizeMode="contain" /> : null}
            </Pressable>
          )}

          {/* Categories (admin images) + Spares + More */}
          {loading ? (
            <View style={{ paddingVertical: 16 }}><Loader label="Loading categories..." /></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: PAD, paddingBottom: 4 }}>
              {[...cats.map((c) => ({ key: c.id, name: c.name, uri: menuImages[categoryMenuKey(c.name)] || menuImages[categoryMenuKey(c.code)] || imageOf(c), onPress: () => openCategory(c) })),
                { key: 'spare', name: 'Spares', uri: menuImages[categoryMenuKey('Spare Parts')] || null, onPress: () => navigation.navigate('BuyListing', { q: 'spare', title: 'Spare Parts' }) },
                { key: 'more', name: 'More', uri: null, onPress: () => navigation.navigate('BuyDevices') },
              ].map((t) => (
                <Pressable key={t.key} onPress={t.onPress} accessibilityRole="button" accessibilityLabel={t.name}
                  style={{ width: tileW, height: tileW * 0.95, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, ...cardShadow }}>
                  {t.uri ? <Image source={{ uri: t.uri }} style={{ width: tileW * 0.6, height: tileW * 0.48 }} resizeMode="contain" />
                    : (
                      <View style={{ height: tileW * 0.48, width: tileW * 0.48, borderRadius: tileW, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                        {t.key === 'more' ? <LayoutGrid size={20} color={GREEN} /> : t.key === 'spare' ? <Cpu size={20} color={GREEN} /> : <Smartphone size={20} color={GREEN} />}
                      </View>
                    )}
                  <Text numberOfLines={1} style={{ marginTop: 6, fontSize: rf(11), fontWeight: '700', color: INK }}>{t.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Quick actions */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingHorizontal: PAD, paddingBottom: 4 }}>
            {[
              { key: 'deals', title: 'Deals', sub: 'Best offers', Icon: Percent, fg: '#B45309', bg: '#FEF3C7', onPress: () => navigation.navigate('BuyListing', { sort: 'price_asc', title: 'Deals & Offers' }) },
              { key: 'shops', title: 'Nearby Shops', sub: 'Buy from local shops', Icon: Store, fg: GREEN, bg: GREEN_LIGHT, onPress: () => navigation.navigate('NearbyShops') },
              { key: 'orders', title: 'My Orders', sub: 'Track & manage', Icon: Package, fg: '#2563EB', bg: '#E0ECFF', onPress: () => navigation.navigate('MyOrders', { initialTab: 'Buy', view: 'buy' }) },
              { key: 'cart', title: 'My Cart', sub: `${cartCount} ${cartCount === 1 ? 'item' : 'items'}`, Icon: ShoppingCart, fg: '#16A34A', bg: '#DCFCE7', onPress: () => navigation.navigate('MyCart') },
            ].map(({ key, title, sub, Icon, fg, bg, onPress }) => (
              <Pressable key={key} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', ...cardShadow }}>
                <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={19} color={fg} strokeWidth={2.4} />
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={{ fontSize: rf(13), fontWeight: '800', color: INK }}>{title}</Text>
                  <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }}>{sub}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Deal of the Day — real live listings, best discount first */}
          {deals.length ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, marginTop: 18, marginBottom: 10 }}>
                <Zap size={20} color="#F59E0B" fill="#F59E0B" />
                <Text style={{ flex: 1, marginLeft: 6, fontSize: rf(16), fontWeight: '800', color: INK }}>Deal of the Day</Text>
                <Pressable onPress={openAll} className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                  <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: GREEN }}>View All</Text>
                  <ArrowRight size={15} color={GREEN} style={{ marginLeft: 4 }} />
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 6 }}>
                {deals.map((p) => (
                  <DealCard key={p.id} product={p} width={dealW} adding={adding === p.id}
                    onPress={() => navigation.navigate('BuyProductDetails', { productId: p.id })}
                    onAdd={() => add(p)}
                    onBuy={() => add(p, true)} />
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Filters sheet — Sort + Max price, applied to the listing (with any search text). */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(28,48,83,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowFilters(false)} accessibilityLabel="Close filters" />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: LINE, marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ flex: 1, fontSize: rf(14), fontWeight: '800', color: INK }}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)} hitSlop={8} accessibilityLabel="Close" style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: FIELD, alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} color={INK} />
              </Pressable>
            </View>
            <Text style={{ fontSize: rf(12), fontWeight: '800', color: MUTED, marginBottom: 8 }}>Sort by</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SORTS.map((s) => <OptionChip key={s.key} label={s.label} active={sortBy === s.key} onPress={() => setSortBy(s.key)} />)}
            </View>
            <Text style={{ fontSize: rf(12), fontWeight: '800', color: MUTED, marginTop: 8, marginBottom: 8 }}>Max price</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {MAX_PRICES.map((v) => <OptionChip key={String(v)} label={v ? `Under ${inr(v)}` : 'Any'} active={maxPrice === v} onPress={() => setMaxPrice(v)} />)}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <Pressable
                onPress={() => { setSortBy('default'); setMaxPrice(null); }}
                className="active:opacity-70"
                style={{ flex: 1, marginRight: 6, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE }}
              >
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: INK }}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => { setShowFilters(false); runSearch(); }}
                className="active:opacity-90"
                style={{ flex: 1, marginLeft: 6, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: GREEN }}
              >
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#FFFFFF' }}>Show results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
