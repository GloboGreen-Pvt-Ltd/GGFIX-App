import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, useWindowDimensions } from 'react-native';
import { Search, XCircle, Wallet, Gem, Gamepad2, Camera, ChevronRight, Smartphone, Sparkles } from 'lucide-react-native';
import { Loader } from '../../../components/ui';
import {
  getBrands, getBrandsForCategory, getModelsByBrand,
  getDeviceCategories, getCategoryMenuImages, categoryMenuKey,
} from '../../../api/masterData';
import { listProducts } from '../../../api/marketplace';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const RED_SOFT = '#FEECEC';
const GAP = 10;
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 };

// `max` mirrors the ceiling BuyListing parses out of the label.
const PRICE_BUCKETS = [
  { label: 'UNDER ₹10,000', max: 10000 },
  { label: 'UNDER ₹20,000', max: 20000 },
  { label: 'UNDER ₹30,000', max: 30000 },
  { label: 'UNDER ₹50,000', max: 50000 },
];
// Checkerboard in a 2-column grid.
const KINDS = [
  { label: 'Budget Phones',      icon: Wallet,   color: BRAND.green,  bg: MINT },
  { label: 'Flagship Phones',    icon: Gem,      color: BRAND.yellow, bg: YELLOW_SOFT },
  { label: 'Gaming Phones',      icon: Gamepad2, color: BRAND.red,    bg: RED_SOFT },
  { label: 'Best Camera Phones', icon: Camera,   color: BRAND.ink,    bg: BRAND.line },
];

const imageOf = (x) => resolveDeviceImageSource({ url: x?.imageUrl, base64: x?.imageBase64 });

function SectionTitle({ title, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 18, marginBottom: 8 }}>
      <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: BRAND.ink, letterSpacing: -0.2 }}>{title}</Text>
      {right ? <Text style={{ fontSize: rf(11), color: BRAND.muted }}>{right}</Text> : null}
    </View>
  );
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
export default function BuyCategoryScreen({ navigation, route }) {
  const { categoryId, categoryCode, categoryName } = route?.params || {};
  const catRef = categoryId || categoryCode;
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  // max price → picture of a real listed device in that bucket.
  const [bucketImages, setBucketImages] = useState({});
  // Admin artwork for this category: Buy menu photo (hero) and the category's
  // own device image (fallback for price tiles with no listed device yet).
  const [art, setArt] = useState({ hero: null, device: null });

  const { width } = useWindowDimensions();
  const W = Math.min(width, 820);
  const PAD = width < 360 ? 12 : 16;
  const cols = W >= 700 ? 4 : 2;
  const tileW = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);
  const brandW = Math.round(Math.max(74, Math.min(100, (W - PAD * 2 - 8 * 3) / 4.3)));
  const imgH = Math.round(Math.max(84, Math.min(124, tileW * 0.56)));
  const heroImgW = Math.round(Math.min(220, (W - PAD * 2) * 0.4));

  useLayoutEffect(() => {
    if (categoryName) navigation.setOptions({ title: categoryName });
  }, [navigation, categoryName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Only this category's brands — getBrands() listed every brand in the
      // catalogue (watches and laptops under Smart Phones).
      let list = [];
      try { list = (catRef ? await getBrandsForCategory(catRef) : await getBrands()) || []; } catch (_) {}
      if (cancelled) return;
      setBrands(list);
      setLoading(false);

      // Price tiles show the priciest listed product under each ceiling, using
      // the product photo or, failing that, its model's catalogue image.
      try {
        const [products, modelLists] = await Promise.all([
          listProducts({ status: 'ACTIVE' }).catch(() => []),
          Promise.all(list.map((b) => getModelsByBrand(b.id).catch(() => []))),
        ]);
        const modelImage = new Map();
        // A brand's models span categories (Apple: phones, AirPods, laptops),
        // so keep only this category's models when its id is known.
        modelLists.flat().forEach((m) => {
          if (m?.id && (!categoryId || !m.categoryId || m.categoryId === categoryId)) modelImage.set(m.id, imageOf(m));
        });
        const listed = (products || [])
          .filter((p) => p.modelId && modelImage.has(p.modelId) && Number(p.price) > 0)
          .sort((a, b) => Number(b.price) - Number(a.price));
        const out = {};
        for (const bucket of PRICE_BUCKETS) {
          for (const p of listed) {
            const img = Number(p.price) <= bucket.max ? (imageOf(p) || modelImage.get(p.modelId)) : null;
            if (img) { out[bucket.max] = img; break; }
          }
        }
        if (!cancelled) setBucketImages(out);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [catRef, categoryId]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getDeviceCategories().catch(() => []),
      getCategoryMenuImages('BUY', { includeInactive: true }),
    ]).then(([cats, menu]) => {
      if (!alive) return;
      const key = categoryMenuKey(categoryName || categoryCode);
      const cat = (Array.isArray(cats) ? cats : []).find((c) => c && (
        (categoryId && c.id === categoryId)
        || (categoryCode && c.code === categoryCode)
        || (key && categoryMenuKey(c.name) === key)
      ));
      setArt({
        hero: (key && menu[key]) || (cat && menu[categoryMenuKey(cat.name)]) || null,
        device: cat ? imageOf(cat) : null,
      });
    });
    return () => { alive = false; };
  }, [categoryId, categoryCode, categoryName]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    navigation.navigate('BuyListing', { q, title: q, categoryId, categoryCode });
  };

  if (loading) return <Loader />;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.bg }}
      contentContainerStyle={{ width: W, alignSelf: 'center', paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Search */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 12,
          backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, ...cardShadow,
        }}
      >
        <Pressable onPress={runSearch} hitSlop={8} accessibilityLabel="Search" className="active:opacity-70">
          <Search size={17} color={BRAND.green} />
        </Pressable>
        <TextInput
          style={{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: rf(13), color: BRAND.ink }}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          placeholder="Search mobile device by brand, model, or series"
          placeholderTextColor={BRAND.muted}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search" className="active:opacity-70">
            <XCircle size={16} color={BRAND.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Brands */}
      <SectionTitle title="Favourite Brands" right={brands.length ? `${brands.length} brands` : null} />
      {brands.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -PAD }}
          contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 4 }}
        >
          {brands.map((b) => {
            const logo = imageOf(b);
            return (
              <Pressable
                key={b.id}
                onPress={() => navigation.navigate('BuyListing', { brandId: b.id, title: b.name })}
                className="active:opacity-80"
                style={{
                  width: brandW, marginRight: 8, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center',
                  backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, ...cardShadow,
                }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: BRAND.bg }}>
                  {logo ? (
                    <Image resizeMethod="resize" source={{ uri: logo }} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  ) : (
                    <Text style={{ fontSize: rf(17), fontWeight: '800', color: BRAND.green }}>{String(b.name || '?').charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <Text numberOfLines={1} style={{ fontSize: rf(11.5), fontWeight: '700', color: BRAND.ink, marginTop: 6, textAlign: 'center' }}>{b.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={{ fontSize: rf(12), color: BRAND.muted, paddingVertical: 6 }}>No brands listed for this category yet.</Text>
      )}

      {/* Hero */}
      <View style={{ marginTop: 16, minHeight: 128, flexDirection: 'row', borderRadius: 18, overflow: 'hidden', backgroundColor: BRAND.green }}>
        <View pointerEvents="none" style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, top: -60, left: -40, backgroundColor: 'rgba(255,255,255,0.10)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, bottom: -46, left: '38%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ flex: 1, minWidth: 0, paddingVertical: 14, paddingLeft: 14, paddingRight: 6, justifyContent: 'center' }}>
          {categoryName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <Sparkles size={11} color={BRAND.yellow} />
              <Text numberOfLines={1} style={{ marginLeft: 4, fontSize: rf(9.5), fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.6 }}>{String(categoryName).toUpperCase()}</Text>
            </View>
          ) : null}
          <Text style={{ fontSize: rf(15), lineHeight: rf(20), fontWeight: '800', color: '#FFFFFF' }}>Still searching for the perfect phone?</Text>
          <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.yellow, marginTop: 4 }}>Let us help you</Text>
        </View>
        <View style={{ width: heroImgW, padding: 8 }}>
          <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' }}>
            {art.hero ? (
              <Image resizeMethod="resize" source={{ uri: art.hero }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : art.device ? (
              <Image resizeMethod="resize" source={{ uri: art.device }} style={{ width: '86%', height: '86%' }} resizeMode="contain" />
            ) : (
              <Smartphone size={36} color="#FFFFFF" />
            )}
          </View>
        </View>
      </View>

      {/* Price buckets */}
      <SectionTitle title="Shop by budget" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {PRICE_BUCKETS.map((b, i) => {
          const img = bucketImages[b.max] || art.device;
          return (
            <Pressable
              key={b.label}
              onPress={() => navigation.navigate('BuyListing', { title: b.label, categoryId, categoryCode })}
              className="active:opacity-80"
              style={{ width: tileW, marginBottom: GAP, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: 'hidden', ...cardShadow }}
            >
              <View style={{ height: imgH, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
                {img ? (
                  <Image resizeMethod="resize" source={{ uri: img }} style={{ width: tileW - 32, height: imgH - 20 }} resizeMode="contain" />
                ) : (
                  <Smartphone size={30} color={BRAND.green} />
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: rf(10.5), fontWeight: '600', color: BRAND.muted }}>Best-Selling Phones</Text>
                  <Text numberOfLines={1} style={{ marginTop: 2 }}>
                    <Text style={{ fontSize: rf(11), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.4 }}>UNDER </Text>
                    <Text style={{ fontSize: rf(15), fontWeight: '800', color: GREEN_TEXT }}>{`₹${b.max.toLocaleString('en-IN')}`}</Text>
                  </Text>
                </View>
                <View style={{ height: 24, width: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.green }}>
                  <ChevronRight size={14} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Kinds */}
      <SectionTitle title="Shop by type" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {KINDS.map((k) => {
          const Icon = k.icon;
          return (
            <Pressable
              key={k.label}
              onPress={() => navigation.navigate('BuyListing', { title: k.label, categoryId, categoryCode })}
              className="active:opacity-80"
              style={{ width: tileW, marginBottom: GAP, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: 'hidden', ...cardShadow }}
            >
              <View style={{ height: 76, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
                <View style={{ height: 50, width: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: k.bg }}>
                  <Icon size={22} color={k.color} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9 }}>
                <Text numberOfLines={2} style={{ flex: 1, fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>{k.label}</Text>
                <ChevronRight size={15} color={BRAND.green} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
