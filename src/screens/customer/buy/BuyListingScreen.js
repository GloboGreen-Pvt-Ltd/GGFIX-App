import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, PanResponder, TextInput, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Loader } from '../../../components/ui';
import { BRAND } from '../../../theme/brand';
import { listProducts } from '../../../api/marketplace';
import { getBrandsForCategory, getModelsByBrand, getDeviceCategories } from '../../../api/masterData';
import { listNearbyShops, listShops } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { rf } from '../../../utils/responsive';
import { StaticTabBar } from '../../../navigation/CustomTabBar';
import { resolveDeviceImageSource } from '../../../utils/images';

const GREEN_TEXT = '#035C6C'; // #035C6C shaded for text on white
const LINE = '#E8EAEE';
const MINT = '#E5F3F5';

// Customer-side radius for the marketplace listing. User-adjustable via the
// slider; falls back to "show all" when we can't resolve a location at all.
const RADIUS_DEFAULT = 20;
const RADIUS_MIN = 1;
const RADIUS_MAX = 50;

// Hearted listings — kept on this phone (the marketplace has no wishlist API).
const WISH_KEY = 'ggfix.buyWishlist.v1';
const SORTS = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'nearest', label: 'Nearest' },
];
const CAT_ORDER = ['MOBILE', 'SMARTPHONE', 'LAPTOP', 'TABLET', 'SMARTWATCH', 'WATCH', 'AUDIO', 'ACCESSORY', 'ACCESSORIES'];
const catRank = (c) => { const i = CAT_ORDER.indexOf((c.code || '').toUpperCase()); return i === -1 ? CAT_ORDER.length : i; };

// Lightweight single-value slider — same pattern used on RepairPickupShops.
// No extra dependency; works on web/iOS/Android via PanResponder.
function RadiusSlider({ min, max, value, onChange }) {
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pct = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => moveTo(e.nativeEvent.locationX),
      onPanResponderMove: (e) => moveTo(e.nativeEvent.locationX),
    }),
  ).current;

  function moveTo(x) {
    const w = widthRef.current;
    if (w <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / w));
    onChangeRef.current(Math.round(min + ratio * (max - min)));
  }

  return (
    <View
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
      style={{ height: 34, justifyContent: 'center' }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: LINE }} />
      <View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: BRAND.green, width: `${pct * 100}%` }} />
      <View
        style={{
          position: 'absolute',
          left: `${pct * 100}%`,
          marginLeft: -11,
          height: 22,
          width: 22,
          borderRadius: 11,
          backgroundColor: '#FFFFFF',
          borderWidth: 3,
          borderColor: BRAND.green,
          shadowColor: BRAND.ink,
          shadowOpacity: 0.2,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}
      />
    </View>
  );
}

const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  scroll: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LINE,
    overflow: 'hidden',
    ...cardShadow,
  },
  body: { flexDirection: 'row', padding: 12 },
  thumb: {
    width: 88,
    height: 96,
    borderRadius: 10,
    backgroundColor: BRAND.line,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  title: { fontSize: rf(14), fontWeight: '800', color: BRAND.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaIcon: { marginRight: 6 },
  metaText: { fontSize: rf(12), color: BRAND.muted, flex: 1 },
  metaStrong: { fontSize: rf(12), color: BRAND.ink, fontWeight: '700' },
  price: { fontSize: rf(15), color: GREEN_TEXT, fontWeight: '800', marginTop: 6 },
  distChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MINT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  distText: { color: GREEN_TEXT, fontWeight: '800', fontSize: rf(11), marginLeft: 3 },
  actionsRow: { flexDirection: 'row', borderTopColor: BRAND.line, borderTopWidth: 1 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  actionText: { marginLeft: 5, fontWeight: '700', fontSize: rf(12) },
  actionDivider: { width: 1, backgroundColor: BRAND.line },
  categoryBar: { paddingHorizontal: 4, paddingBottom: 8 },
  categoryLabel: { fontSize: rf(12), color: BRAND.muted, fontWeight: '600' },
  categoryName: { fontSize: rf(16), color: BRAND.ink, fontWeight: '800', marginTop: 2 },
  radiusBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: MINT, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10 },
  radiusText: { fontSize: rf(11), color: GREEN_TEXT, fontWeight: '700', marginLeft: 6 },
  radiusHint: { fontSize: rf(11), color: BRAND.body, flex: 1, marginLeft: 6 },
  sliderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LINE,
    ...cardShadow,
  },
  sliderHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderLabel: { fontSize: rf(11), color: BRAND.muted, fontWeight: '800', letterSpacing: 1 },
  sliderValuePill: { backgroundColor: MINT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  sliderValueText: { fontSize: rf(12), color: GREEN_TEXT, fontWeight: '800' },
  sliderEndsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  sliderEndText: { fontSize: rf(10), color: BRAND.muted, fontWeight: '600' },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  emptyIcon: { height: 56, width: 56, borderRadius: 28, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyText: { fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink, textAlign: 'center' },
  emptyHint: { fontSize: rf(11.5), color: BRAND.muted, textAlign: 'center', marginTop: 4 },
  // Browse grid (reference "Browse Devices").
  search: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: LINE },
  chip: { height: 34, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: GREEN_TEXT, borderColor: GREEN_TEXT },
  chipText: { fontSize: rf(12.5), fontWeight: '700', color: BRAND.ink },
  results: { fontSize: rf(13), fontWeight: '700', color: BRAND.ink },
  radiusChip: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, paddingHorizontal: 8, height: 24, borderRadius: 999, backgroundColor: MINT },
  radiusChipText: { marginLeft: 3, fontSize: rf(11), fontWeight: '700', color: GREEN_TEXT },
  sortText: { fontSize: rf(12.5), fontWeight: '700', color: BRAND.ink },
  gridCard: { borderRadius: 16, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', padding: 10, shadowColor: '#111111', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  gridImg: { height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  listImg: { width: 72, height: 80, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gridTitle: { fontSize: rf(13), fontWeight: '800', color: BRAND.ink, minHeight: rf(32) },
  gridPrice: { fontSize: rf(16), fontWeight: '800', color: GREEN_TEXT, marginTop: 4 },
  condChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#E3F6EE', maxWidth: '100%' },
  condText: { fontSize: rf(11), fontWeight: '800', color: '#01805A' },
  gridMeta: { fontSize: rf(10.5), color: BRAND.muted },
  heart: { position: 'absolute', top: 8, right: 8, height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
});

export default function BuyListingScreen({ navigation, route }) {
  const { categoryId, categoryCode, categoryName, title, brandId, q, maxPrice, minPrice, sort } = route?.params || {};
  const [items, setItems] = useState([]);
  // modelId → catalogue image, for products listed without a photo.
  const [modelImages, setModelImages] = useState(new Map());
  const [loading, setLoading] = useState(true);
  // null = "no location resolved → show everything"; Set = "filter to these shops".
  const [nearbyShopIds, setNearbyShopIds] = useState(null);
  // Map<shopId, shop> joined into each product for name/address/distance.
  const [shopMap, setShopMap] = useState(new Map());
  const [radiusKm, setRadiusKm] = useState(RADIUS_DEFAULT);
  const { lat, lng, addressLabel } = useCustomerLocation();
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState(q || '');
  const [sortBy, setSortBy] = useState(sort || 'relevance');
  const [sortOpen, setSortOpen] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [wish, setWish] = useState(new Set());
  const listMode = route?.params?.layout === 'list';
  const [condTab, setCondTab] = useState('all'); // list layout: all | new | refurb

  useEffect(() => {
    getDeviceCategories().then((list) => setCats((list || []).filter((c) => c.isActive !== false).sort((a, b) => catRank(a) - catRank(b) || (a.name || '').localeCompare(b.name || '')))).catch(() => {});
    AsyncStorage.getItem(WISH_KEY).then((raw) => setWish(new Set(JSON.parse(raw || '[]')))).catch(() => {});
  }, []);

  useLayoutEffect(() => {
    // List layout ("Buy Mobile Phones") opens from a category; Browse keeps the grid.
    navigation.setOptions(listMode
      ? {
        title: `Buy ${categoryName || title || 'Devices'}`,
        subtitle: '',
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate('MyCart')} hitSlop={8} accessibilityRole="button" accessibilityLabel="My cart" style={{ padding: 6 }}>
            <Ionicons name="cart-outline" size={23} color={BRAND.ink} />
          </TouchableOpacity>
        ),
      }
      : {
        title: 'Buy',
        subtitle: categoryName || title || 'Devices',
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Notifications" style={{ padding: 6 }}>
            <Ionicons name="notifications-outline" size={22} color={BRAND.ink} />
          </TouchableOpacity>
        ),
      });
  }, [navigation, categoryName, title, listMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Resolve the selected filter to a set of allowed model IDs. Marketplace
        // products carry modelId (no categoryId/brandId), so we filter by
        // modelId IN (models reachable from the chosen brand, or — when no brand
        // was picked — from the category's mapped brands).
        let allowedModelIds = null;
        let models = [];
        if (brandId) {
          models = await getModelsByBrand(brandId).catch(() => []);
          const ids = new Set();
          (models || []).forEach((m) => { if (m?.id) ids.add(m.id); });
          allowedModelIds = ids;
        } else if (categoryId || categoryCode) {
          const brands = await getBrandsForCategory(categoryId || categoryCode).catch(() => []);
          const modelLists = await Promise.all(
            (brands || []).map((b) => getModelsByBrand(b.id).catch(() => [])),
          );
          models = modelLists.flat();
          const ids = new Set();
          models.forEach((m) => { if (m?.id) ids.add(m.id); });
          allowedModelIds = ids;
        }
        const imgs = new Map();
        (models || []).forEach((m) => {
          const src = m?.id ? resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 }) : null;
          if (src) imgs.set(m.id, src);
        });
        if (!cancelled) setModelImages(imgs);

        // "UNDER ₹20,000" price buckets carry their ceiling in the title.
        const priceMatch = /under[^\d]*([\d,]+)/i.exec(title || '');
        const priceCeil = Number(maxPrice) > 0 ? Number(maxPrice) : (priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null);

        const products = await listProducts({ status: 'ACTIVE', q: q || undefined }).catch(() => []);
        let filtered = allowedModelIds
          ? (products || []).filter((p) => p.modelId && allowedModelIds.has(p.modelId))
          : (products || []);
        if (Number(minPrice) > 0) filtered = filtered.filter((p) => Number(p.price) > Number(minPrice));
        if (priceCeil != null) {
          filtered = filtered.filter((p) => {
            const price = Number(p.price);
            return Number.isFinite(price) && price > 0 && price <= priceCeil;
          });
        }
        // Optional sort from the Buy home Filters sheet; unpriced items go last.
        if (sort === 'price_asc' || sort === 'price_desc') {
          const val = (p) => (Number(p.price) > 0 ? Number(p.price) : null);
          filtered = [...filtered].sort((a, b) => {
            const x = val(a); const y = val(b);
            if (x == null || y == null) return (x == null) - (y == null);
            return sort === 'price_asc' ? x - y : y - x;
          });
        }
        if (!cancelled) setItems(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoryId, categoryCode, brandId, title, q, maxPrice, minPrice, sort]);

  // Resolve which shops are within RADIUS_KM, and also build a name/address
  // lookup. Nearby query gives us pre-computed distanceKm too. When the user's
  // location isn't known, we fall back to listShops() for name/address only —
  // no distance, no filter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (lat != null && lng != null) {
          const shops = await listNearbyShops({ lat, lng, radiusKm });
          if (cancelled) return;
          const m = new Map();
          const ids = new Set();
          for (const s of shops || []) {
            if (!s?.id) continue;
            m.set(s.id, s);
            ids.add(s.id);
          }
          setShopMap(m);
          setNearbyShopIds(ids);
        } else {
          const shops = await listShops().catch(() => []);
          if (cancelled) return;
          const m = new Map();
          for (const s of shops || []) {
            if (s?.id) m.set(s.id, s);
          }
          setShopMap(m);
          setNearbyShopIds(null);
        }
      } catch (_) {
        if (!cancelled) { setShopMap(new Map()); setNearbyShopIds(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng, radiusKm]);

  const visibleItems = useMemo(() => {
    const base = !nearbyShopIds
      ? items
      : items.filter((p) => !p.shopId || nearbyShopIds.has(p.shopId));
    // Decorate each product with shop info for the card to render.
    return base.map((p) => {
      const shop = p.shopId ? shopMap.get(p.shopId) : null;
      return {
        ...p,
        shopName: p.shopName || shop?.name || null,
        shopLocation: p.location || shop?.address || shop?.city || null,
        shopPhone: p.shopPhone || shop?.mobile || shop?.phone || null,
        distanceKm: p.distanceKm != null ? p.distanceKm : shop?.distanceKm ?? null,
      };
    });
  }, [items, nearbyShopIds, shopMap]);

  const radiusFilterActive = nearbyShopIds != null;
  const { width } = useWindowDimensions();
  const contentW = Math.min(width, 720);
  const cardW = Math.floor((contentW - 32 - 10) / 2);
  const activeCat = categoryId || null;

  // List layout tabs: New vs Refurbished from each listing's own condition label
  // (no label → counted under All only).
  const condOf = (p) => (!p.conditionLabel ? null : /^(brand\s*)?new$|sealed|unused/i.test(String(p.conditionLabel).trim()) ? 'new' : 'refurb');
  const condCount = useMemo(() => visibleItems.reduce((n, p) => { const c = condOf(p); if (c) n[c] += 1; return n; }, { new: 0, refurb: 0 }), [visibleItems]);

  // Search box filters the loaded listings (title / shop); Sort re-orders them.
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = needle
      ? visibleItems.filter((p) => [p.title, p.shopName, p.storageLabel, p.color].filter(Boolean).join(' ').toLowerCase().includes(needle))
      : visibleItems;
    if (listMode && condTab !== 'all') list = list.filter((p) => condOf(p) === condTab);
    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      const val = (p) => (Number(p.price) > 0 ? Number(p.price) : null);
      list = [...list].sort((a, b) => {
        const x = val(a); const y = val(b);
        if (x == null || y == null) return (x == null) - (y == null);
        return sortBy === 'price_asc' ? x - y : y - x;
      });
    } else if (sortBy === 'nearest') {
      list = [...list].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return list;
  }, [visibleItems, search, sortBy, listMode, condTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickCategory = (c) => navigation.setParams(c
    ? { categoryId: c.id, categoryCode: (c.code || '').toUpperCase(), categoryName: c.name, title: c.name, brandId: undefined }
    : { categoryId: undefined, categoryCode: undefined, categoryName: undefined, title: undefined, brandId: undefined });

  const toggleWish = (id) => setWish((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    AsyncStorage.setItem(WISH_KEY, JSON.stringify([...next])).catch(() => {});
    return next;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {listMode ? (
          // Banner: category · what's sold here (photo = first live listing).
          <View style={{ marginHorizontal: -16, marginTop: -10, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#E3F6EE', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: rf(22), fontWeight: '800', color: BRAND.ink }}>Buy {categoryName || title || 'Devices'}</Text>
              <Text style={{ fontSize: rf(12.5), color: BRAND.ink, marginTop: 4 }}>New & Refurbished · Fixed Price · Verified Shops</Text>
            </View>
            {(() => { const u = shown[0] && (resolveDeviceImageSource({ url: shown[0].imageUrl }) || modelImages.get(shown[0].modelId)); return u ? <Image source={{ uri: u }} style={{ width: 92, height: 80 }} resizeMode="contain" /> : null; })()}
          </View>
        ) : null}

        {/* Search */}
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={BRAND.green} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search devices, brands..."
            placeholderTextColor="#8E97A9"
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, marginLeft: 8, fontSize: rf(13), color: BRAND.ink, padding: 0 }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={17} color="#B5BDCB" />
            </TouchableOpacity>
          ) : null}
        </View>

        {listMode ? (
          // All / New / Refurbished with live counts · Filter opens sort.
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12 }}>
            {[['all', 'All', visibleItems.length], ['new', 'New', condCount.new], ['refurb', 'Refurbished', condCount.refurb]].map(([k, label, n]) => (
              <TouchableOpacity key={k} onPress={() => setCondTab(k)} activeOpacity={0.85} style={[styles.chip, { paddingHorizontal: 12 }, condTab === k ? styles.chipOn : null]} accessibilityRole="tab" accessibilityState={{ selected: condTab === k }}>
                <Text style={[styles.chipText, condTab === k ? { color: '#FFFFFF' } : null]}>{label} ({loading ? '…' : n})</Text>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setSortOpen((v) => !v)} activeOpacity={0.85} style={[styles.chip, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }]} accessibilityRole="button" accessibilityLabel="Filter">
              <Ionicons name="options-outline" size={15} color={BRAND.ink} />
              <Text style={[styles.chipText, { marginLeft: 4 }]}>Filter</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Category chips */}
        {listMode ? null : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
          {[null, ...cats].map((c) => {
            const on = c ? activeCat === c.id : !activeCat;
            return (
              <TouchableOpacity key={c ? c.id : 'all'} onPress={() => pickCategory(c)} activeOpacity={0.85} style={[styles.chip, on ? styles.chipOn : null]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[styles.chipText, on ? { color: '#FFFFFF' } : null]}>{c ? c.name : 'All'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>}

        {/* Results · radius · sort (list layout: opened from the header filter icon) */}
        {listMode && !sortOpen ? null : <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.results}>{loading ? 'Loading…' : `${shown.length} Result${shown.length === 1 ? '' : 's'}`}</Text>
          {radiusFilterActive ? (
            <TouchableOpacity onPress={() => setShowRadius((v) => !v)} style={styles.radiusChip} accessibilityRole="button">
              <Ionicons name="location-outline" size={13} color={GREEN_TEXT} />
              <Text style={styles.radiusChipText}>{radiusKm} km</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setSortOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button">
            <Text style={styles.sortText}>Sort: {SORTS.find((s) => s.key === sortBy)?.label}</Text>
            <Ionicons name={sortOpen ? 'chevron-up' : 'chevron-down'} size={15} color={BRAND.ink} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>}
        {sortOpen ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {SORTS.filter((s) => s.key !== 'nearest' || radiusFilterActive).map((s) => (
              <TouchableOpacity key={s.key} onPress={() => { setSortBy(s.key); setSortOpen(false); }} style={[styles.chip, { height: 30 }, sortBy === s.key ? styles.chipOn : null]}>
                <Text style={[styles.chipText, sortBy === s.key ? { color: '#FFFFFF' } : null]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {radiusFilterActive && showRadius ? (
          <View style={[styles.sliderCard, { marginTop: 8 }]}>
            <View style={styles.sliderHeaderRow}>
              <Text style={styles.sliderLabel}>SEARCH RADIUS</Text>
              <View style={styles.sliderValuePill}><Text style={styles.sliderValueText}>{radiusKm} km</Text></View>
            </View>
            <RadiusSlider min={RADIUS_MIN} max={RADIUS_MAX} value={radiusKm} onChange={setRadiusKm} />
            {addressLabel ? <Text style={styles.radiusHint} numberOfLines={1}>{addressLabel}</Text> : null}
          </View>
        ) : null}

        {/* Grid */}
        {loading ? (
          <View style={{ paddingVertical: 40 }}><Loader /></View>
        ) : !shown.length ? (
          <View style={[styles.emptyCard, { marginTop: 12 }]}>
            <View style={styles.emptyIcon}><Ionicons name="search" size={24} color={BRAND.green} /></View>
            <Text style={styles.emptyText}>
              {search ? 'No devices match your search' : radiusFilterActive ? `No products within ${radiusKm} km` : (categoryName ? `No ${categoryName.toLowerCase()} products yet` : 'No products yet')}
            </Text>
            {!search && radiusFilterActive && radiusKm < RADIUS_MAX ? <Text style={styles.emptyHint}>Tap the km chip to search a wider area.</Text> : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {shown.map((p) => {
              // .avif Cloudinary URLs render blank on Android — normalise, then fall
              // back to the model's catalogue image.
              const img = resolveDeviceImageSource({ url: p.imageUrl }) || modelImages.get(p.modelId) || null;
              const priced = Number.isFinite(Number(p.price)) && Number(p.price) > 0;
              const liked = wish.has(p.id);
              const heart = (
                <TouchableOpacity onPress={() => toggleWish(p.id)} hitSlop={8} style={styles.heart} accessibilityRole="button" accessibilityLabel={liked ? 'Remove from wishlist' : 'Add to wishlist'}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={19} color={liked ? BRAND.red : BRAND.ink} />
                </TouchableOpacity>
              );
              if (listMode) {
                return (
                  <View key={p.id} style={[styles.gridCard, { width: '100%', padding: 12 }]}>
                    {(() => {
                      // Only a real fact as a tag: listed in the last 7 days.
                      const isNew = p.createdAt && Date.now() - new Date(p.createdAt).getTime() < 7 * 86400000;
                      const cond = condOf(p) === 'new' ? 'New' : condOf(p) === 'refurb' ? 'Refurbished' : p.conditionLabel || null;
                      return (
                        <TouchableOpacity onPress={() => navigation.navigate('BuyProductDetails', { productId: p.id })} activeOpacity={0.9} style={{ flexDirection: 'row' }} accessibilityRole="button" accessibilityLabel={p.title || 'Device'}>
                          <View style={{ width: 96 }}>
                            {isNew ? <View style={{ alignSelf: 'flex-start', backgroundColor: '#2F7BEB', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4 }}><Text style={{ fontSize: rf(10), fontWeight: '800', color: '#FFFFFF' }}>New Arrival</Text></View> : null}
                            <View style={[styles.listImg, { width: 96, height: 104 }]}>
                              {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={30} color={BRAND.green} />}
                            </View>
                          </View>
                          <View style={{ flex: 1, minWidth: 0, marginLeft: 12, paddingRight: 24 }}>
                            <Text style={[styles.gridTitle, { fontSize: rf(15) }]} numberOfLines={2}>{p.title || 'Device'}</Text>
                            {cond ? <Text style={[styles.gridMeta, { marginTop: 3 }]} numberOfLines={1}>{cond}</Text> : null}
                            <Text style={[styles.gridPrice, { fontSize: rf(18), marginTop: 6 }]}>{priced ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Price on request'}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                              {p.shopName ? <Ionicons name="storefront-outline" size={13} color={BRAND.ink} /> : null}
                              {p.shopName ? <Text style={[styles.gridMeta, { marginLeft: 3, color: BRAND.ink, fontWeight: '700', flexShrink: 1 }]} numberOfLines={1}>{p.shopName}</Text> : null}
                              {p.distanceKm != null ? <Text style={[styles.gridMeta, { marginLeft: 6 }]}>· {Number(p.distanceKm).toFixed(1)} km</Text> : null}
                              <View style={{ flex: 1 }} />
                              <View style={{ backgroundColor: '#E3F6EE', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontSize: rf(10.5), fontWeight: '800', color: GREEN_TEXT }}>Fixed Price</Text></View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}
                    {heart}
                  </View>
                );
              }
              return (
                <View key={p.id} style={[styles.gridCard, { width: cardW }]}>
                  <TouchableOpacity onPress={() => navigation.navigate('BuyProductDetails', { productId: p.id })} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={p.title || 'Device'}>
                    <View style={styles.gridImg}>
                      {img ? <Image source={{ uri: img }} style={{ width: '78%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="phone-portrait-outline" size={36} color={BRAND.green} />}
                    </View>
                    <Text style={styles.gridTitle} numberOfLines={2}>{p.title || 'Device'}</Text>
                    <Text style={styles.gridPrice}>{priced ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Price on request'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {p.conditionLabel ? <View style={styles.condChip}><Text style={styles.condText} numberOfLines={1}>{p.conditionLabel}</Text></View> : null}
                      {p.distanceKm != null ? <Text style={styles.gridMeta}>{Number(p.distanceKm).toFixed(1)} km</Text> : null}
                    </View>
                  </TouchableOpacity>
                  {/* Sibling of the card's button: a button inside a button is ambiguous. */}
                  {heart}
                </View>
              );
            })}
          </View>
        )}
        {!radiusFilterActive && !loading ? (
          <View style={[styles.radiusBar, { marginTop: 12 }]}>
            <Ionicons name="location-outline" size={14} color={BRAND.green} />
            <Text style={styles.radiusHint}>Enable location to see shops near you.</Text>
          </View>
        ) : null}
        {listMode ? (
          <View style={{ flexDirection: 'row', marginTop: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#F2FBF7' }}>
            {[['shield-checkmark-outline', 'Verified\nShops'], ['bicycle-outline', 'Home\nDelivery'], ['storefront-outline', 'Visit & Buy\nat Shop'], ['ribbon-outline', 'Warranty on\nProducts']].map(([icon, label]) => (
              <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                <Ionicons name={icon} size={22} color={BRAND.green} />
                <Text style={{ fontSize: rf(10.5), fontWeight: '700', color: BRAND.ink, textAlign: 'center', marginTop: 4 }}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <StaticTabBar navigation={navigation} active="Buy" />
    </View>
  );
}
