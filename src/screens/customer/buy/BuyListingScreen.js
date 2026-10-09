import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Linking, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Loader } from '../../../components/ui';
import { BRAND } from '../../../theme/brand';
import { listProducts } from '../../../api/marketplace';
import { getBrandsForCategory, getModelsByBrand } from '../../../api/masterData';
import { listNearbyShops, listShops } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { rf } from '../../../utils/responsive';
import { resolveDeviceImageSource } from '../../../utils/images';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';

// Customer-side radius for the marketplace listing. User-adjustable via the
// slider; falls back to "show all" when we can't resolve a location at all.
const RADIUS_DEFAULT = 20;
const RADIUS_MIN = 1;
const RADIUS_MAX = 50;

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
});

export default function BuyListingScreen({ navigation, route }) {
  const { categoryId, categoryCode, categoryName, title, brandId, q, maxPrice, sort } = route?.params || {};
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

  useLayoutEffect(() => {
    if (categoryName || title) {
      navigation.setOptions({ title: categoryName || title });
    }
  }, [navigation, categoryName, title]);

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
  }, [categoryId, categoryCode, brandId, title, q, maxPrice, sort]);

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

  if (loading) return <Loader />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {(categoryName || title) ? (
        <View style={styles.categoryBar}>
          <Text style={styles.categoryLabel}>Showing products in</Text>
          <Text style={styles.categoryName}>{categoryName || title}</Text>
        </View>
      ) : null}

      {radiusFilterActive ? (
        <View style={styles.sliderCard}>
          <View style={styles.sliderHeaderRow}>
            <Text style={styles.sliderLabel}>SEARCH RADIUS</Text>
            <View style={styles.sliderValuePill}>
              <Text style={styles.sliderValueText}>{radiusKm} km</Text>
            </View>
          </View>
          <RadiusSlider min={RADIUS_MIN} max={RADIUS_MAX} value={radiusKm} onChange={setRadiusKm} />
          <View style={styles.sliderEndsRow}>
            <Text style={styles.sliderEndText}>{RADIUS_MIN} km</Text>
            <Text style={styles.sliderEndText}>{RADIUS_MAX} km</Text>
          </View>
          {addressLabel ? (
            <View style={[styles.radiusBar, { marginTop: 6, marginBottom: 0 }]}>
              <Ionicons name="location" size={12} color={BRAND.green} />
              <Text style={styles.radiusHint} numberOfLines={1}>{addressLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.radiusBar}>
          <Ionicons name="location-outline" size={14} color={BRAND.green} />
          <Text style={styles.radiusHint}>Enable location to see shops near you.</Text>
        </View>
      )}

      {!visibleItems.length ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search" size={24} color={BRAND.green} />
          </View>
          <Text style={styles.emptyText}>
            {radiusFilterActive
              ? `No products within ${radiusKm} km`
              : (categoryName ? `No ${categoryName.toLowerCase()} products yet` : 'No products yet')}
          </Text>
          {radiusFilterActive && radiusKm < RADIUS_MAX ? (
            <Text style={styles.emptyHint}>Drag the slider to search a wider area.</Text>
          ) : null}
        </View>
      ) : visibleItems.map((p) => {
        const onView = () => navigation.navigate('BuyProductDetails', { productId: p.id });
        // .avif Cloudinary URLs render blank on Android — normalise, then fall
        // back to the model's catalogue image.
        const img = resolveDeviceImageSource({ url: p.imageUrl }) || modelImages.get(p.modelId) || null;
        const onCall = (e) => {
          e?.stopPropagation?.();
          if (p.shopPhone) Linking.openURL(`tel:${p.shopPhone}`);
        };
        const onMap = (e) => {
          e?.stopPropagation?.();
          const shop = p.shopId ? shopMap.get(p.shopId) : null;
          const lat = shop?.latitude;
          const lng = shop?.longitude;
          if (lat != null && lng != null) {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
          } else if (p.shopLocation) {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.shopLocation)}`);
          }
        };
        return (
        <TouchableOpacity key={p.id} style={styles.card} onPress={onView} activeOpacity={0.9}>
          <View style={styles.body}>
            <View style={styles.thumb}>
              {img ? (
                <Image source={{ uri: img }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <Ionicons name="phone-portrait-outline" size={32} color={BRAND.green} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{p.title || 'Device'}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="cube-outline" size={12} color={BRAND.muted} style={styles.metaIcon} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {[p.storageLabel, p.color].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="storefront-outline" size={12} color={BRAND.muted} style={styles.metaIcon} />
                <Text style={styles.metaStrong} numberOfLines={1}>
                  {p.shopName || 'Shop not linked'}
                </Text>
              </View>
              {p.shopLocation ? (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color={BRAND.muted} style={styles.metaIcon} />
                  <Text style={styles.metaText} numberOfLines={1}>{p.shopLocation}</Text>
                </View>
              ) : null}
              <Text style={styles.price}>
                {Number.isFinite(Number(p.price)) && Number(p.price) > 0
                  ? `₹${Number(p.price).toLocaleString('en-IN')}`
                  : 'Price on request'}
              </Text>
            </View>
            {p.distanceKm != null ? (
              <View style={styles.distChip}>
                <Ionicons name="navigate" size={10} color={GREEN_TEXT} />
                <Text style={styles.distText}>{Number(p.distanceKm).toFixed(1)} km</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.action} onPress={onView}>
              <Ionicons name="eye-outline" color={BRAND.green} size={15} />
              <Text style={[styles.actionText, { color: GREEN_TEXT }]}>View</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.action} onPress={onCall} disabled={!p.shopPhone}>
              <Ionicons name="call-outline" color={p.shopPhone ? BRAND.green : '#C9C9C9'} size={15} />
              <Text style={[styles.actionText, { color: p.shopPhone ? BRAND.ink : '#C9C9C9' }]}>Call Shop</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.action} onPress={onMap}>
              <Ionicons name="location-outline" color={BRAND.red} size={15} />
              <Text style={[styles.actionText, { color: BRAND.ink }]}>Location</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
