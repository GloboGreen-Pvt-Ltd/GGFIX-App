import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  Search,
  X,
  Plus,
  ChevronRight,
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
import { FLOW as BASE_FLOW, FlowHeader, useHideStackHeader } from './FlowChrome';
import { BRAND } from '../../../theme/brand';

// Brand palette in the FLOW shape (09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23).
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
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

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
      <View style={{ height: 6, borderRadius: 3, backgroundColor: FLOW.border }} />
      <View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: FLOW.primary, width: `${pct * 100}%` }} />
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
          borderColor: FLOW.primary,
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

export default function RepairPickupShopsScreen({ navigation, route }) {
  const params = route.params || {};
  useHideStackHeader(navigation);

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

  const emptyActionLabel = q ? 'Clear search' : (lat != null && radiusKm < MAX_RADIUS_KM ? `Expand to ${MAX_RADIUS_KM} km` : null);
  const onEmptyAction = () => { if (q) setQ(''); else setRadiusKm(MAX_RADIUS_KM); };

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      {/* Hero — soft mint/aqua with decorative map pins (visual only). */}
      <LinearGradient
        colors={['#FFFFFF', '#F1FAF2', '#E2F5E6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', paddingBottom: 32 }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', right: 20, top: 58, width: 96, height: 96 }}>
          <View style={{ position: 'absolute', left: 6, top: 6, width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(9,173,42,0.30)' }} />
          <View style={{ position: 'absolute', left: 25, top: 25, width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...cardShadow }}>
            <Store size={20} color={FLOW.deep} />
          </View>
          <MapPin size={18} color="#fff" fill={BRAND.green} style={{ position: 'absolute', left: -2, top: 52 }} />
          <MapPin size={16} color="#fff" fill={BRAND.yellow} style={{ position: 'absolute', left: 44, top: 2 }} />
          <MapPin size={16} color="#fff" fill={BRAND.green} style={{ position: 'absolute', right: -4, top: 30 }} />
        </View>
        <FlowHeader title="Pickup Service Shop" navigation={navigation} />
        <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingRight: 120 }}>
          <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: FLOW.deep, letterSpacing: 1.4 }}>PICKUP SHOPS</Text>
          <Text style={{ fontSize: rf(18), fontWeight: '900', color: FLOW.ink, marginTop: 3, letterSpacing: -0.4 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>Choose your repair shop</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Locate size={14} color={FLOW.primary} />
            <Text style={{ fontSize: rf(12), color: FLOW.deep, marginLeft: 5, flex: 1 }} numberOfLines={1}>
              {lat != null && lng != null
                ? `Near ${addressLabel || 'you'} · within ${radiusKm} km`
                : (locError ? `Location: ${locError}` : 'Resolving your location…')}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Floating search field — same q / setQ / clear as before. */}
      <View style={{ paddingHorizontal: 16, marginTop: -24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 14, borderWidth: 1, borderColor: FLOW.border, ...cardShadow }}>
          <Search size={18} color={FLOW.primary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by shop name or area..."
            placeholderTextColor={BRAND.muted}
            style={{ flex: 1, marginLeft: 9, fontSize: rf(13.5), color: FLOW.ink, paddingVertical: 0 }}
            returnKeyType="search"
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search" className="active:opacity-70">
              <X size={18} color={FLOW.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Location warning */}
        {!locLoading && (lat == null || lng == null) ? (
          <View style={{ backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine, borderRadius: 14, marginHorizontal: 16, marginTop: 10, padding: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Crosshair size={15} color={BRAND.yellow} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: FLOW.ink }}>Set a pickup location</Text>
              <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 2, lineHeight: rf(16) }}>
                We're showing all shops. Save a default address (with location) for distance-sorted results.
              </Text>
            </View>
            <Pressable onPress={refreshLoc} className="active:opacity-70" style={{ backgroundColor: 'rgba(243,191,35,0.28)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
              <RefreshCw size={12} color={BRAND.ink} />
              <Text style={{ color: BRAND.ink, fontWeight: '700', fontSize: rf(11), marginLeft: 4 }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Auto-expand banner */}
        {autoExpanded && shops.length > 0 ? (
          <View style={{ backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine, borderRadius: 14, marginHorizontal: 16, marginTop: 10, padding: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Sparkles size={15} color={BRAND.yellow} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: FLOW.ink }}>No shops within {radiusKm} km</Text>
              <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 2, lineHeight: rf(16) }}>
                Showing the nearest shops instead. The closest is {shops[0]?.distanceKm != null ? `${shops[0].distanceKm.toFixed(1)} km` : 'farther than expected'} away.
              </Text>
            </View>
            <Pressable onPress={refreshLoc} className="active:opacity-70" style={{ backgroundColor: BRAND.yellow, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 6 }}>
              <Text style={{ color: BRAND.ink, fontWeight: '700', fontSize: rf(11) }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Radius selector — continuous slider from MIN to MAX km */}
        {lat != null && lng != null ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 16, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 9, ...cardShadow }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: rf(11), fontWeight: '800', color: FLOW.muted, letterSpacing: 1.4 }}>SEARCH RADIUS</Text>
                <View style={{ backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 }}>
                  <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: FLOW.deep }}>{radiusKm} km</Text>
                </View>
              </View>
              <RadiusSlider min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} value={radiusKm} onChange={setRadiusKm} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: rf(11), color: FLOW.muted }}>{MIN_RADIUS_KM} km</Text>
                <Text style={{ fontSize: rf(11), color: FLOW.muted }}>{MAX_RADIUS_KM} km</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Trust strip */}
        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 16, paddingVertical: 9, ...cardShadow }}>
            {[
              { icon: Truck, t: 'Free Pickup', s: 'Convenient & hassle-free' },
              { icon: Award, t: 'Verified Shops', s: 'Trusted & quality service' },
            ].map((b, i) => {
              const BIcon = b.icon;
              return (
                <React.Fragment key={b.t}>
                  {i ? <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: FLOW.border, marginVertical: 4 }} /> : null}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
                    <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: i ? YELLOW_SOFT : FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <BIcon size={16} color={i ? BRAND.yellow : FLOW.deep} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: rf(12), fontWeight: '800', color: FLOW.ink }} numberOfLines={1}>{b.t}</Text>
                      <Text style={{ fontSize: rf(10), color: FLOW.muted, marginTop: 1 }} numberOfLines={2}>{b.s}</Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Sort chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {SORTS.map((s) => {
            const SIcon = s.icon;
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                className="active:opacity-85"
                style={{
                  flexDirection: 'row', alignItems: 'center', height: 34, paddingHorizontal: 12, borderRadius: 17, marginRight: 7,
                  backgroundColor: active ? FLOW.primary : '#fff', borderWidth: 1, borderColor: active ? FLOW.primary : FLOW.border,
                }}
              >
                <SIcon size={13} color={active ? '#fff' : FLOW.ink} />
                <Text style={{ fontSize: rf(12), fontWeight: '700', color: active ? '#fff' : FLOW.ink, marginLeft: 5 }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Result count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 13, marginBottom: 8 }}>
          <Text style={{ fontSize: rf(11), fontWeight: '800', color: FLOW.muted, letterSpacing: 1.2 }}>
            {q ? `RESULTS (${filtered.length})` : `${filtered.length} SHOP${filtered.length === 1 ? '' : 'S'}${lat != null ? ` WITHIN ${radiusKm} KM` : ''}`}
          </Text>
          {source ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Locate size={13} color={FLOW.primary} />
              <Text style={{ fontSize: rf(11.5), fontWeight: '700', color: FLOW.deep, marginLeft: 4 }}>
                {source === 'address' ? addressLabel : 'Live location'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {showLoader ? (
            <Loader label="Finding shops near you..." />
          ) : shopError ? (
            <View style={{ backgroundColor: '#FEECEC', borderWidth: 1, borderColor: 'rgba(248,65,65,0.35)', borderRadius: 14, padding: 11 }}>
              <Text style={{ fontSize: rf(12), color: BRAND.red }}>{shopError}</Text>
            </View>
          ) : !filtered.length ? (
            // Empty state — same title / description / action rules as before.
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 16 }}>
              <View style={{ width: 200, height: 130, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', width: 126, height: 126, borderRadius: 63, backgroundColor: FLOW.softMint }} />
                <View style={{ position: 'absolute', bottom: 8, left: 20, width: 70, height: 26, borderRadius: 13, backgroundColor: FLOW.mint }} />
                <View style={{ position: 'absolute', bottom: 10, right: 22, width: 60, height: 22, borderRadius: 11, backgroundColor: YELLOW_SOFT }} />
                <View style={{ position: 'absolute', top: 18, left: 36, width: 7, height: 7, borderRadius: 4, backgroundColor: BRAND.yellow }} />
                <Plus size={14} color={BRAND.green} style={{ position: 'absolute', top: 36, right: 34 }} />
                <View style={{ position: 'relative', zIndex: 1, elevation: 1 }}>
                  <Store size={52} color={FLOW.deep} strokeWidth={1.8} />
                </View>
              </View>
              <Text style={{ fontSize: rf(16), fontWeight: '800', color: FLOW.ink, marginTop: 8, textAlign: 'center' }}>
                {lat != null ? `No shops within ${radiusKm} km` : 'No shops match'}
              </Text>
              <Text style={{ fontSize: rf(12), color: FLOW.muted, marginTop: 3, textAlign: 'center' }}>
                {lat != null ? 'Try expanding the search radius above.' : (q ? 'Try a different search.' : 'No shops near your saved address yet.')}
              </Text>
              {emptyActionLabel ? (
                <Pressable
                  onPress={onEmptyAction}
                  className="active:opacity-90"
                  style={{ marginTop: 14, height: 46, paddingHorizontal: 28, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: FLOW.primary, shadowColor: FLOW.primary, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
                >
                  <Text style={{ color: '#fff', fontSize: rf(14), fontWeight: '800', marginRight: 6 }}>{emptyActionLabel}</Text>
                  <ChevronRight size={19} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : (
            filtered.map((s) => (
              <View key={s.id} style={{ marginBottom: 9 }}>
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
