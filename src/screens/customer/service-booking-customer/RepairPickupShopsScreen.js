import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Store,
  Star,
  MapPin,
  Truck,
  Award,
  Clock,
  Sparkles,
  Crosshair,
  RefreshCw,
  Locate,
} from 'lucide-react-native';
import {
  Loader,
  EmptyState,
  ShopCard,
  SearchBar,
  Badge,
} from '../../../components/rnr';
import { listNearbyShops } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { travelTimesFor } from '../../../utils/travelTimes';
import { isShopOpen } from '../../../utils/shopHours';
import { rf } from '../../../utils/responsive';

const SORTS = [
  { key: 'recommended', label: 'Recommended', icon: Sparkles },
  { key: 'rating',      label: 'Top Rated',  icon: Star },
  { key: 'distance',    label: 'Nearest',    icon: MapPin },
  { key: 'eta',         label: 'Fastest',    icon: Clock },
];

// Doorstep pickup radius is chosen on a slider from MIN_RADIUS_KM up to MAX_RADIUS_KM.
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;

// Lightweight single-value slider (no extra dependency). Tap or drag the track
// to pick a radius. Works on web, iOS and Android via PanResponder.
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
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E2E8F0' }} />
      <View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: '#00008B', width: `${pct * 100}%` }} />
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
          borderColor: '#00008B',
          shadowColor: '#0F172A',
          shadowOpacity: 0.2,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}
      />
    </View>
  );
}

export default function RepairPickupShopsScreen({ navigation, route }) {
  const params = route.params || {};

  const { lat, lng, source, loading: locLoading, error: locError, addressLabel, refresh: refreshLoc } = useCustomerLocation();

  const [radiusKm, setRadiusKm] = useState(20);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopError, setShopError] = useState(null);
  const [sort, setSort] = useState('recommended');
  const [q, setQ] = useState('');
  // True when we widened the bubble because the user's bubble was empty.
  // Used to render a banner explaining "no shops within X km, showing nearest instead".
  const [autoExpanded, setAutoExpanded] = useState(false);

  // (Re)fetch whenever location resolves or radius changes.
  // Strict radius â€” empty state ("No shops within X km") rather than
  // silently widening the search and showing shops 150 km away.
  const fetchShops = useCallback(async () => {
    setLoading(true);
    setShopError(null);
    setAutoExpanded(false);
    try {
      const list = await listNearbyShops({
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        radiusKm: lat != null && lng != null ? radiusKm : undefined,
      });
      setShops(list || []);
    } catch (e) {
      setShopError(e?.message || 'Could not load shops');
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusKm]);

  useEffect(() => { if (!locLoading) fetchShops(); }, [locLoading, fetchShops]);

  const filtered = useMemo(() => {
    let list = [...shops];
    if (q.trim()) {
      const n = q.toLowerCase();
      list = list.filter((s) =>
        (s.name || '').toLowerCase().includes(n) ||
        (s.address || '').toLowerCase().includes(n) ||
        (s.city || '').toLowerCase().includes(n),
      );
    }
    if (sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    // ETA is proportional to distance for a fixed travel mode, so "Fastest"
    // sorts by distance too.
    else list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    return list;
  }, [shops, q, sort]);

  const showLoader = locLoading || (loading && shops.length === 0);

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={['#00008B', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 4, paddingBottom: 32, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <Text className="text-white/80 font-bold tracking-widest" style={{ fontSize: rf(11) }}>PICKUP SHOPS</Text>
        <Text className="text-white font-extrabold mt-1" style={{ fontSize: rf(22) }}>Choose your repair shop</Text>
        <View className="flex-row items-center mt-1">
          <Locate size={11} color="#A7F3D0" />
          <Text className="text-white/85 ml-1.5 flex-1" style={{ fontSize: rf(12) }} numberOfLines={1}>
            {lat != null && lng != null
              ? `Near ${addressLabel || 'you'} · within ${radiusKm} km`
              : (locError ? `Location: ${locError}` : 'Resolving your location…')}
          </Text>
        </View>
      </LinearGradient>

      <View className="px-4 -mt-6">
        <SearchBar
          value={q}
          onChangeText={setQ}
          placeholder="Search by shop name or area..."
          onClear={() => setQ('')}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Location warning */}
        {!locLoading && (lat == null || lng == null) ? (
          <View className="bg-warning/10 border border-warning/30 rounded-xl mx-4 mt-3 p-2.5 flex-row items-start">
            <Crosshair size={14} color="#F59E0B" style={{ marginTop: 2 }} />
            <View className="flex-1 ml-2">
              <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }}>Set a pickup location</Text>
              <Text className="text-text-muted mt-0.5 leading-4" style={{ fontSize: rf(11) }}>
                We're showing all shops. Save a default address (with location) for distance-sorted results.
              </Text>
            </View>
            <Pressable
              onPress={refreshLoc}
              className="bg-warning/15 rounded-full px-2.5 py-1 flex-row items-center active:opacity-70 ml-1"
            >
              <RefreshCw size={11} color="#F59E0B" />
              <Text className="text-warning font-bold ml-1" style={{ fontSize: rf(10) }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Auto-expand banner: shown when first-pass with radius returned 0 shops
            and we fell back to "show nearest regardless of distance" */}
        {autoExpanded && shops.length > 0 ? (
          <View className="bg-warning/10 border border-warning/30 rounded-xl mx-4 mt-3 p-2.5 flex-row items-start">
            <Sparkles size={14} color="#F59E0B" style={{ marginTop: 2 }} />
            <View className="flex-1 ml-2">
              <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }}>No shops within {radiusKm} km</Text>
              <Text className="text-text-muted mt-0.5 leading-4" style={{ fontSize: rf(11) }}>
                Showing the nearest shops instead. The closest is {shops[0]?.distanceKm != null ? `${shops[0].distanceKm.toFixed(1)} km` : 'farther than expected'} away.
              </Text>
            </View>
            <Pressable
              onPress={refreshLoc}
              className="bg-warning rounded-full px-2.5 py-1 active:opacity-70 ml-1"
            >
              <Text className="text-white font-bold" style={{ fontSize: rf(10) }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Radius selector — continuous slider from MIN to MAX km */}
        {lat != null && lng != null ? (
          <View className="px-4 pt-3">
            <View
              className="bg-card border border-border rounded-2xl px-4 pt-3 pb-2.5"
              style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
            >
              <View className="flex-row items-center justify-between mb-0.5">
                <Text className="font-extrabold text-text-muted tracking-widest" style={{ fontSize: rf(10) }}>SEARCH RADIUS</Text>
                <View className="bg-primary/10 rounded-full px-2.5 py-0.5">
                  <Text className="font-extrabold text-primary" style={{ fontSize: rf(12) }}>{radiusKm} km</Text>
                </View>
              </View>
              <RadiusSlider min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} value={radiusKm} onChange={setRadiusKm} />
              <View className="flex-row items-center justify-between">
                <Text className="text-text-muted" style={{ fontSize: rf(10) }}>{MIN_RADIUS_KM} km</Text>
                <Text className="text-text-muted" style={{ fontSize: rf(10) }}>{MAX_RADIUS_KM} km</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Trust strip */}
        <View className="px-4 mt-3">
          <View
            className="flex-row bg-card border border-border rounded-2xl py-2.5"
            style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
          >
            <View className="flex-1 items-center px-1">
              <Truck size={15} color="#00008B" />
              <Text className="font-bold text-text mt-1 text-center" style={{ fontSize: rf(10) }}>Free Pickup</Text>
            </View>
            <View className="w-px bg-border my-1" />
            <View className="flex-1 items-center px-1">
              <Award size={15} color="#F59E0B" />
              <Text className="font-bold text-text mt-1 text-center" style={{ fontSize: rf(10) }}>Verified Shops</Text>
            </View>
          </View>
        </View>

        {/* Sort chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {SORTS.map((s) => {
            const SIcon = s.icon;
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                className={`flex-row items-center rounded-full border px-3 py-1.5 mr-2 mb-1 ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
              >
                <SIcon size={11} color={active ? '#fff' : '#0F172A'} />
                <Text className={` font-bold ml-1 ${active ? 'text-white' : 'text-text'}`} style={{ fontSize: rf(11) }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Result count */}
        <View className="flex-row items-center justify-between px-4 mt-2 mb-2">
          <Text className="font-extrabold text-text-muted tracking-widest" style={{ fontSize: rf(10) }}>
            {q ? `RESULTS (${filtered.length})` : `${filtered.length} SHOP${filtered.length === 1 ? '' : 'S'}${lat != null ? ` WITHIN ${radiusKm} KM` : ''}`}
          </Text>
          {source ? (
            <View className="flex-row items-center">
              <Locate size={10} color="#004C40" />
              <Text className="text-success font-bold ml-1" style={{ fontSize: rf(10) }}>
                {source === 'address' ? addressLabel : 'Live location'}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="px-4">
          {showLoader ? (
            <Loader label="Finding shops near you..." />
          ) : shopError ? (
            <View className="bg-danger/10 border border-danger/30 rounded-xl p-3">
              <Text className="text-danger" style={{ fontSize: rf(12) }}>{shopError}</Text>
            </View>
          ) : !filtered.length ? (
            <EmptyState
              icon={<Store size={28} color="#00008B" />}
              title={lat != null ? `No shops within ${radiusKm} km` : 'No shops match'}
              description={lat != null ? 'Try expanding the search radius above.' : (q ? 'Try a different search.' : 'No shops near your saved address yet.')}
              actionLabel={q ? 'Clear search' : (lat != null && radiusKm < MAX_RADIUS_KM ? `Expand to ${MAX_RADIUS_KM} km` : null)}
              onAction={() => { if (q) setQ(''); else setRadiusKm(MAX_RADIUS_KM); }}
            />
          ) : (
            filtered.map((s) => (
              <View key={s.id} className="mb-3">
                <ShopCard
                  name={s.name}
                  address={s.address || s.city}
                  image={s.frontImageUrl}
                  rating={s.rating || 4.5}
                  reviews={s.reviewCount || 100}
                  distance={s.distanceKm != null ? s.distanceKm.toFixed(1) : null}
                  travelTimes={travelTimesFor(s.distanceKm)}
                  open={isShopOpen(s) ?? true}
                  onPress={() => navigation.navigate('RepairShopDetails', { ...params, shopId: s.id })}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

