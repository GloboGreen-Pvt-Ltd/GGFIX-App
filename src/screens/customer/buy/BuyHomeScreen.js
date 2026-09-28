import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Search, ShoppingCart, Bell, ChevronDown, ChevronRight, MapPin, Camera, Mic, QrCode,
  Tag, BadgeCheck, Package, Flame,
  Smartphone, Laptop, Tablet, Watch, Headphones, Cable,
} from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { getDeviceCategories, getBanners } from '../../../api/masterData';
import { listProducts, getCart, addToCart } from '../../../api/marketplace';
import { listAddresses } from '../../../api/customer';
import { getUnreadCount } from '../../../api/notifications';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { rf } from '../../../utils/responsive';

const DEEP = '#004C40';
const MINT = '#E8F7F2';
const SOFT_MINT = '#F4FBF8';
const PAGE_BG = '#F8FCFA';
const BORDER = '#DCE7E2';
const TEXT = '#111827';
const MUTED = '#667085';
const INACTIVE = '#98A2B3';

const MAX_W = 720;
const PAD = 16;
const GAP = 10;

// Presentation-only styling per category code (tint behind the artwork, a
// fallback icon and a generic tagline). Unknown codes use DEFAULT_META.
const MOBILE = { icon: Smartphone, tint: '#EAF7F0', sub: 'iPhone, Android\nAll Brands' };
const LAPTOP = { icon: Laptop, tint: '#FDEEF2', sub: 'Apple, Dell, HP\nLenovo, Asus' };
const TABLET = { icon: Tablet, tint: '#EAF3FC', sub: 'iPad, Galaxy Tab\nAll Models' };
const WATCH = { icon: Watch, tint: '#FEF5E6', sub: 'Apple Watch,\nWear OS, Fitness' };
const AUDIO = { icon: Headphones, tint: '#F1EEFB', sub: 'Earbuds &\nHeadphones' };
const ACCESSORY = { icon: Cable, tint: '#EDF3FB', sub: 'Charger, Cable,\nCase & More' };
const CODE_META = {
  MOBILE, SMARTPHONE: MOBILE,
  LAPTOP,
  TABLET,
  SMARTWATCH: WATCH, SMARTWATCHES: WATCH, WATCH,
  AUDIO, AUDIO_DEVICE: AUDIO, AUDIO_DEVICES: AUDIO,
  ACCESSORY, ACCESSORIES: ACCESSORY,
};
const DEFAULT_META = { icon: Smartphone, tint: SOFT_MINT, sub: 'Tap to see all\nlistings' };

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

const BENEFITS = [
  { icon: Tag, label: 'Best Prices\nEveryday' },
  { icon: BadgeCheck, label: 'Original &\nCertified' },
  { icon: Package, label: 'Easy Returns\n& Support' },
];

function imgUri(item) {
  if (!item) return null;
  const b64 = item.imageBase64 && String(item.imageBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item.imageUrl && String(item.imageUrl).trim();
  return /^(https?:\/\/|file:|data:image\/)/i.test(url || '') ? url : null;
}

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Price + optional original price for a product. The discount badge and the
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
function IconCircle({ icon: Icon, onPress, badge = 0, badgeColor, label }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="active:opacity-80"
      style={{
        height: 44, width: 44, borderRadius: 22, marginLeft: 8,
        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon size={20} color={TEXT} />
      {badge > 0 ? (
        <View
          style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
            backgroundColor: badgeColor, borderWidth: 1.5, borderColor: '#FFFFFF',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(9.5) }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SectionTitle({ title, icon: Icon, onViewAll }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, marginTop: 18, marginBottom: 10 }}>
      {Icon ? <Icon size={20} color="#F97316" fill="#FDBA74" style={{ marginRight: 6 }} /> : null}
      <Text style={{ flex: 1, fontSize: rf(18), fontWeight: '800', color: TEXT, letterSpacing: -0.3 }}>{title}</Text>
      <Pressable onPress={onViewAll} className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
        <Text style={{ color: DEEP, fontWeight: '700', fontSize: rf(13.5), marginRight: 2 }}>View all</Text>
        <ChevronRight size={16} color={DEEP} />
      </Pressable>
    </View>
  );
}

function CategoryCard({ category, width, onPress }) {
  const code = (category.code || '').toUpperCase();
  const meta = CODE_META[code] || DEFAULT_META;
  const Icon = meta.icon;
  const uri = imgUri(category);
  const imgH = Math.round(width * 0.62);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      className="active:opacity-90"
      style={{
        width, backgroundColor: '#FFFFFF', borderRadius: 18,
        borderWidth: 1, borderColor: BORDER, padding: 5,
        shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 1,
      }}
    >
      <View
        style={{
          height: imgH, borderRadius: 14, backgroundColor: meta.tint,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: width - 14, height: imgH - 6 }} resizeMode="contain" />
        ) : (
          <Icon size={Math.round(imgH * 0.42)} color={DEEP} />
        )}
      </View>
      <View style={{ paddingHorizontal: 3, paddingTop: 7, paddingBottom: 5 }}>
        <Text numberOfLines={1} style={{ fontSize: rf(13.5), fontWeight: '800', color: TEXT, letterSpacing: -0.2 }}>
          {category.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {meta.sub.split('\n').map((line) => (
              <Text
                key={line}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={{ fontSize: rf(8.5), lineHeight: rf(12), color: MUTED }}
              >
                {line}
              </Text>
            ))}
          </View>
          <View
            style={{
              height: 22, width: 22, borderRadius: 11, backgroundColor: MINT,
              alignItems: 'center', justifyContent: 'center', marginLeft: 2,
            }}
          >
            <ChevronRight size={13} color={DEEP} strokeWidth={2.6} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function DealCard({ product, width, onPress, onAdd, adding }) {
  const { price, old, off } = pricing(product);
  const uri = imgUri(product);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.title || 'Product'}
      className="active:opacity-90"
      style={{
        width, height: Math.round(width * 1.12), backgroundColor: '#FFFFFF', borderRadius: 16,
        borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
        shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 1,
      }}
    >
      {off > 0 ? (
        <View
          style={{
            position: 'absolute', top: 6, left: 6, zIndex: 1,
            backgroundColor: '#12A150', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(9.5) }}>{off}% OFF</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, flexDirection: 'row', paddingLeft: 5, paddingRight: 5, paddingTop: 26, paddingBottom: 8 }}>
        <View style={{ width: Math.round(width * 0.34), alignItems: 'center', justifyContent: 'center' }}>
          {uri ? (
            <Image source={{ uri }} style={{ width: '100%', height: '88%' }} resizeMode="contain" />
          ) : (
            <Smartphone size={26} color={INACTIVE} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 4 }}>
          <Text numberOfLines={2} style={{ fontSize: rf(9), lineHeight: rf(12), fontWeight: '700', color: TEXT }}>
            {product.title || 'Device'}
          </Text>
          {price != null ? (
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: rf(11), fontWeight: '800', color: TEXT, marginTop: 4 }}>
              {inr(price)}
            </Text>
          ) : null}
          {old ? (
            <Text numberOfLines={1} style={{ fontSize: rf(8.5), color: MUTED, textDecorationLine: 'line-through' }}>
              {inr(old)}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onAdd}
        disabled={adding}
        accessibilityRole="button"
        accessibilityLabel="Add to cart"
        className="active:opacity-80"
        style={{
          position: 'absolute', right: 7, bottom: 7,
          height: 30, width: 30, borderRadius: 15, backgroundColor: MINT,
          alignItems: 'center', justifyContent: 'center', opacity: adding ? 0.5 : 1,
        }}
      >
        <ShoppingCart size={15} color={DEEP} />
      </Pressable>
    </Pressable>
  );
}

export default function BuyHomeScreen({ navigation }) {
  const [cats, setCats] = useState([]);
  const [buyBanners, setBuyBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [adding, setAdding] = useState(null);
  const [slide, setSlide] = useState(0);
  const { addressLabel: gpsLabel, loading: locating } = useCustomerLocation();
  const { width } = useWindowDimensions();

  useEffect(() => {
    (async () => {
      try {
        const [list, banners, prods] = await Promise.all([
          getDeviceCategories(),
          getBanners().catch(() => []),
          listProducts({ status: 'ACTIVE' }).catch(() => []),
        ]);
        setCats(sortCategories((list || []).filter((c) => c.isActive !== false)));
        // Hero shows ONLY the admin banner(s) titled "Buy" (image only).
        setBuyBanners(
          (banners || [])
            .filter((b) => b.isActive !== false && String(b.title || '').trim().toLowerCase() === 'buy')
            .map((b) => ({ key: String(b.id), uri: imgUri(b) }))
            .filter((b) => b.uri),
        );
        setProducts(prods || []);
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // Header counters + default address refresh whenever the tab regains focus.
  const refreshHeader = useCallback(async () => {
    const [cart, count, addrs] = await Promise.all([
      getCart().catch(() => null),
      getUnreadCount().catch(() => null),
      listAddresses().catch(() => null),
    ]);
    if (cart) setCartCount(cart.reduce((n, it) => n + (it.quantity || 1), 0));
    if (count != null) setUnread(Number(count) || 0);
    if (addrs) setAddress(addrs.find((a) => a.isDefault) || addrs[0] || null);
  }, []);
  useFocusEffect(useCallback(() => { refreshHeader(); }, [refreshHeader]));

  const openCategory = (c) => {
    navigation.navigate('BuyListing', {
      categoryId: c.id,
      categoryCode: (c.code || '').toUpperCase(),
      categoryName: c.name,
      title: c.name,
    });
  };
  const openAll = () => navigation.navigate('BuyListing', {});

  const add = async (p) => {
    setAdding(p.id);
    try {
      await addToCart(p.id, 1);
      notify('Added', 'Added to cart');
      refreshHeader();
    } catch (e) { notify('Error', e.message); }
    finally { setAdding(null); }
  };

  const contentW = Math.min(width, MAX_W);
  const availableWidth = contentW - PAD * 2;
  const colW = Math.floor((availableWidth - GAP * 2) / 3);
  const bannerW = availableWidth;
  const bannerH = Math.round(bannerW / 2); // Buy artwork is authored at 2:1.
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  // Deals: listings with a real discount first (largest first), then the rest.
  const deals = [...products]
    .sort((a, b) => pricing(b).off - pricing(a).off)
    .slice(0, 3);

  const detail = address
    ? (() => {
        const head = [address.line1 || address.locality, address.city].filter(Boolean).join(', ');
        const pin = address.pincode ? String(address.pincode).trim() : '';
        return head && pin ? `${head} - ${pin}` : head || pin;
      })()
    : (locating ? 'Detecting your location…' : gpsLabel || 'Tap to pick your address');

  const onBannerScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (bannerW || 1));
    if (i !== slide) setSlide(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <LinearGradient colors={[MINT, PAGE_BG]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={[centered, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: 8 }]}>
            <Pressable
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Profile"
              className="active:opacity-80"
              style={{ height: 48, width: 48, borderRadius: 24, backgroundColor: DEEP, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: rf(16), letterSpacing: 0.5 }}>GG</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('ManageAddress')}
              accessibilityLabel="Change address"
              className="active:opacity-80"
              style={{ flex: 1, minWidth: 0 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: rf(20), fontWeight: '900', color: TEXT, marginRight: 4 }}>Buy</Text>
                <ChevronDown size={18} color={TEXT} strokeWidth={2.6} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                <MapPin size={12} color={TEXT} style={{ marginRight: 4 }} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: rf(11.5), color: MUTED }}>{detail}</Text>
              </View>
            </Pressable>
            <IconCircle icon={Search} label="Search" onPress={openAll} />
            <IconCircle icon={ShoppingCart} label="Cart" onPress={() => navigation.navigate('MyCart')} badge={cartCount} badgeColor="#EF4444" />
            <IconCircle icon={Bell} label="Notifications" onPress={() => navigation.navigate('Notifications')} badge={unread} badgeColor="#EF4444" />
          </View>

          <View style={[centered, { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 6 }]}>
            <Pressable
              onPress={openAll}
              accessibilityRole="search"
              className="active:opacity-90"
              style={{
                flexDirection: 'row', alignItems: 'center',
                height: 54, borderRadius: 22, paddingHorizontal: 16,
                backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER,
                shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 }, elevation: 1,
              }}
            >
              <Search size={20} color={TEXT} />
              <Text numberOfLines={1} style={{ flex: 1, marginLeft: 10, fontSize: rf(13.5), color: MUTED }}>
                Search mobiles, accessories & more...
              </Text>
              <Camera size={20} color={TEXT} style={{ marginLeft: 6 }} />
              <Mic size={20} color={TEXT} style={{ marginLeft: 14 }} />
              <QrCode size={20} color={TEXT} style={{ marginLeft: 14 }} />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={centered}>
          {/* Hero — admin "Buy" banner artwork only (its text is baked in). */}
          {buyBanners.length ? (
            <View style={{ marginHorizontal: PAD, marginTop: 8, height: bannerH, borderRadius: 22, overflow: 'hidden', backgroundColor: SOFT_MINT }}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onBannerScroll}
                scrollEventThrottle={16}
                style={{ width: bannerW, height: bannerH, flexGrow: 0 }}
              >
                {buyBanners.map((b) => (
                  <Pressable
                    key={b.key}
                    onPress={openAll}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Buy offer banner"
                    style={{ width: bannerW, height: bannerH }}
                  >
                    <Image source={{ uri: b.uri }} style={{ width: bannerW, height: bannerH }} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
              {buyBanners.length > 1 ? (
                <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' }}>
                  {buyBanners.map((b, i) => (
                    <View
                      key={b.key}
                      style={{
                        height: 6, width: i === slide ? 16 : 6, borderRadius: 3, marginHorizontal: 3,
                        backgroundColor: i === slide ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Benefit strip — three equal cards. */}
          <View style={{ flexDirection: 'row', paddingHorizontal: PAD, marginTop: 12 }}>
            {BENEFITS.map((b, i) => {
              const Icon = b.icon;
              return (
                <View
                  key={b.label}
                  style={{
                    width: colW, marginLeft: i === 0 ? 0 : GAP,
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER,
                    paddingVertical: 10, paddingHorizontal: 6,
                  }}
                >
                  <View style={{ height: 30, width: 30, borderRadius: 10, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 5 }}>
                    <Icon size={16} color={DEEP} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {b.label.split('\n').map((line) => (
                      <Text
                        key={line}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                        style={{ fontSize: rf(9.5), lineHeight: rf(12.5), fontWeight: '700', color: TEXT }}
                      >
                        {line}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          <SectionTitle title="Shop by Category" onViewAll={openAll} />
          {loading ? (
            <View style={{ paddingVertical: 24 }}><Loader label="Loading categories..." /></View>
          ) : cats.length === 0 ? (
            <View style={{ paddingHorizontal: PAD }}>
              <EmptyState title="No categories yet" description="The admin hasn't published any device categories." />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: PAD }}>
              {cats.map((c, i) => (
                <View key={c.id} style={{ width: colW, marginLeft: i % 3 === 0 ? 0 : GAP, marginBottom: GAP }}>
                  <CategoryCard category={c} width={colW} onPress={() => openCategory(c)} />
                </View>
              ))}
            </View>
          )}

          {deals.length ? (
            <>
              <SectionTitle title="Deals for You" icon={Flame} onViewAll={openAll} />
              <View style={{ flexDirection: 'row', paddingHorizontal: PAD }}>
                {deals.map((p, i) => (
                  <View key={p.id} style={{ width: colW, marginLeft: i === 0 ? 0 : GAP }}>
                    <DealCard
                      product={p}
                      width={colW}
                      adding={adding === p.id}
                      onPress={() => navigation.navigate('BuyProductDetails', { productId: p.id })}
                      onAdd={() => add(p)}
                    />
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
