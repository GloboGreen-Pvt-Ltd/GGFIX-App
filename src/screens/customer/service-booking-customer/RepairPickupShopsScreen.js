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
import { FLOW, cardShadow, FlowHeader, useHideStackHeader } from './FlowChrome';

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
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E2E8F0' }} />
      <View style={{ position: 'absolute', left: 0, height: 8, borderRadius: 4, backgroundColor: FLOW.deep, width: `${pct * 100}%` }} />
      <View
        style={{
          position: 'absolute',
          left: `${pct * 100}%`,
          marginLeft: -13,
          height: 26,
          width: 26,
          borderRadius: 13,
          backgroundColor: '#FFFFFF',
          borderWidth: 3,
          borderColor: FLOW.deep,
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
        colors={['#F2FBF8', '#D8F6EE', '#BFEFF0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', paddingBottom: 40 }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', right: 18, top: 70, width: 130, height: 130 }}>
          <View style={{ position: 'absolute', left: 10, top: 10, width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,121,95,0.25)' }} />
          <View style={{ position: 'absolute', left: 35, top: 35, width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...cardShadow }}>
            <Store size={26} color={FLOW.deep} />
          </View>
          <MapPin size={20} color="#fff" fill="#2BB58F" style={{ position: 'absolute', left: 0, top: 70 }} />
          <MapPin size={18} color="#fff" fill="#2BB58F" style={{ position: 'absolute', left: 60, top: -6 }} />
          <MapPin size={18} color="#fff" fill="#2BB58F" style={{ position: 'absolute', right: -4, top: 42 }} />
        </View>
        <FlowHeader title="Pickup Service Shop" navigation={navigation} />
        <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingRight: 128 }}>
          <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: FLOW.primary, letterSpacing: 1.6 }}>PICKUP SHOPS</Text>
          <Text style={{ fontSize: rf(20), fontWeight: '900', color: FLOW.ink, marginTop: 4, letterSpacing: -0.5 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>Choose your repair shop</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Locate size={15} color={FLOW.primary} />
            <Text style={{ fontSize: rf(13), color: FLOW.deep, marginLeft: 6, flex: 1 }} numberOfLines={1}>
              {lat != null && lng != null
                ? `Near ${addressLabel || 'you'} · within ${radiusKm} km`
                : (locError ? `Location: ${locError}` : 'Resolving your location…')}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Floating search field — same q / setQ / clear as before. */}
      <View style={{ paddingHorizontal: 16, marginTop: -28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 20, backgroundColor: '#fff', paddingHorizontal: 16, borderWidth: 1, borderColor: FLOW.border, ...cardShadow }}>
          <Search size={20} color={FLOW.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by shop name or area..."
            placeholderTextColor="#94A3B8"
            style={{ flex: 1, marginLeft: 10, fontSize: rf(14), color: FLOW.ink, paddingVertical: 0 }}
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
          <View style={{ backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#FBD89A', borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Crosshair size={15} color="#F59E0B" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: FLOW.ink }}>Set a pickup location</Text>
              <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 2, lineHeight: rf(16) }}>
                We're showing all shops. Save a default address (with location) for distance-sorted results.
              </Text>
            </View>
            <Pressable onPress={refreshLoc} className="active:opacity-70" style={{ backgroundColor: '#FDECC8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
              <RefreshCw size={12} color="#B45309" />
              <Text style={{ color: '#B45309', fontWeight: '700', fontSize: rf(11), marginLeft: 4 }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Auto-expand banner */}
        {autoExpanded && shops.length > 0 ? (
          <View style={{ backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#FBD89A', borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Sparkles size={15} color="#F59E0B" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: FLOW.ink }}>No shops within {radiusKm} km</Text>
              <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 2, lineHeight: rf(16) }}>
                Showing the nearest shops instead. The closest is {shops[0]?.distanceKm != null ? `${shops[0].distanceKm.toFixed(1)} km` : 'farther than expected'} away.
              </Text>
            </View>
            <Pressable onPress={refreshLoc} className="active:opacity-70" style={{ backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: rf(11) }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Radius selector — continuous slider from MIN to MAX km */}
        {lat != null && lng != null ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, ...cardShadow }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: rf(12), fontWeight: '800', color: FLOW.muted, letterSpacing: 1.6 }}>SEARCH RADIUS</Text>
                <View style={{ backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Text style={{ fontSize: rf(14), fontWeight: '800', color: FLOW.deep }}>{radiusKm} km</Text>
                </View>
              </View>
              <RadiusSlider min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} value={radiusKm} onChange={setRadiusKm} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: rf(12), color: FLOW.muted }}>{MIN_RADIUS_KM} km</Text>
                <Text style={{ fontSize: rf(12), color: FLOW.muted }}>{MAX_RADIUS_KM} km</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Trust strip */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, paddingVertical: 12, ...cardShadow }}>
            {[
              { icon: Truck, t: 'Free Pickup', s: 'Convenient & hassle-free' },
              { icon: Award, t: 'Verified Shops', s: 'Trusted & quality service' },
            ].map((b, i) => {
              const BIcon = b.icon;
              return (
                <React.Fragment key={b.t}>
                  {i ? <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: FLOW.border, marginVertical: 4 }} /> : null}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
                    <View style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                      <BIcon size={20} color={FLOW.deep} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: rf(13), fontWeight: '800', color: FLOW.ink }} numberOfLines={1}>{b.t}</Text>
                      <Text style={{ fontSize: rf(10.5), color: FLOW.muted, marginTop: 1 }} numberOfLines={2}>{b.s}</Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Sort chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14 }}>
          {SORTS.map((s) => {
            const SIcon = s.icon;
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                className="active:opacity-85"
                style={{
                  flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 14, borderRadius: 20, marginRight: 8,
                  backgroundColor: active ? FLOW.deep : '#fff', borderWidth: 1, borderColor: active ? FLOW.deep : FLOW.border,
                }}
              >
                <SIcon size={15} color={active ? '#fff' : FLOW.ink} />
                <Text style={{ fontSize: rf(13), fontWeight: '700', color: active ? '#fff' : FLOW.ink, marginLeft: 6 }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Result count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16, marginBottom: 10 }}>
          <Text style={{ fontSize: rf(12), fontWeight: '800', color: FLOW.muted, letterSpacing: 1.4 }}>
            {q ? `RESULTS (${filtered.length})` : `${filtered.length} SHOP${filtered.length === 1 ? '' : 'S'}${lat != null ? ` WITHIN ${radiusKm} KM` : ''}`}
          </Text>
          {source ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Locate size={14} color={FLOW.primary} />
              <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: FLOW.deep, marginLeft: 5 }}>
                {source === 'address' ? addressLabel : 'Live location'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {showLoader ? (
            <Loader label="Finding shops near you..." />
          ) : shopError ? (
            <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 16, padding: 12 }}>
              <Text style={{ fontSize: rf(12.5), color: '#DC2626' }}>{shopError}</Text>
            </View>
          ) : !filtered.length ? (
            // Empty state — same title / description / action rules as before.
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 16 }}>
              <View style={{ width: 200, height: 130, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', width: 126, height: 126, borderRadius: 63, backgroundColor: FLOW.softMint }} />
                <View style={{ position: 'absolute', bottom: 8, left: 20, width: 70, height: 26, borderRadius: 13, backgroundColor: '#E3F7F1' }} />
                <View style={{ position: 'absolute', bottom: 10, right: 22, width: 60, height: 22, borderRadius: 11, backgroundColor: '#E3F7F1' }} />
                <View style={{ position: 'absolute', top: 18, left: 36, width: 7, height: 7, borderRadius: 4, backgroundColor: '#7DD3C0' }} />
                <Plus size={14} color="#5CCBB0" style={{ position: 'absolute', top: 36, right: 34 }} />
                <View style={{ position: 'relative', zIndex: 1, elevation: 1 }}>
                  <Store size={52} color={FLOW.deep} strokeWidth={1.8} />
                </View>
              </View>
              <Text style={{ fontSize: rf(18), fontWeight: '800', color: FLOW.ink, marginTop: 10, textAlign: 'center' }}>
                {lat != null ? `No shops within ${radiusKm} km` : 'No shops match'}
              </Text>
              <Text style={{ fontSize: rf(13), color: FLOW.muted, marginTop: 4, textAlign: 'center' }}>
                {lat != null ? 'Try expanding the search radius above.' : (q ? 'Try a different search.' : 'No shops near your saved address yet.')}
              </Text>
              {emptyActionLabel ? (
                <Pressable
                  onPress={onEmptyAction}
                  className="active:opacity-90"
                  style={{ marginTop: 16, height: 54, paddingHorizontal: 34, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: FLOW.deep, shadowColor: FLOW.deep, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
                >
                  <Text style={{ color: '#fff', fontSize: rf(15), fontWeight: '800', marginRight: 6 }}>{emptyActionLabel}</Text>
                  <ChevronRight size={19} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : (
            filtered.map((s) => (
              <View key={s.id} style={{ marginBottom: 12 }}>
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
