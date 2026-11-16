import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { listAddresses } from '../../../api/customer';
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
  ChevronDown,
  CheckCircle2,
  BadgeCheck,
  Pencil,
  Info,
  LayoutGrid,
  Bike,
  Settings,
} from 'lucide-react-native';
import { Image } from 'react-native';
import {
  Loader,
  EmptyState,
  ShopCard,
  SearchBar,
  Badge,
} from '../../../components/rnr';
import { listNearbyShops } from '../../../api/shops';
import { verifiedCoords, haversineKm, eligiblePickupShops, createLatestGate } from '../../../utils/pickupDistance';
import { resolvePinArea } from '../../../utils/pinGeocode';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { travelTimesFor } from '../../../utils/travelTimes';
import { isShopOpen } from '../../../utils/shopHours';
import { rf } from '../../../utils/responsive';
import { FLOW as BASE_FLOW, FlowHeader, useHideStackHeader } from './FlowChrome';
import { BRAND } from '../../../theme/brand';

// Brand palette in the FLOW shape (035C6C · 111111 · F3F4F6 · F3F4F6 · FAA700).
const FLOW = {
  ...BASE_FLOW,
  primary: BRAND.green,
  deep: '#035C6C', // green text / icons (#035C6C shaded)
  ink: BRAND.ink,
  muted: '#606E87',
  mint: '#E5F3F5',
  softMint: '#F0F8F9',
  tint: '#F0F8F9',
  border: '#E8EAEE',
  bg: BRAND.bg,
};
const YELLOW_SOFT = '#FFF4D6';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

const SORTS = [
  { key: 'recommended', label: 'Recommended', icon: Sparkles },
  { key: 'rating',      label: 'Top Rated',  icon: Star },
  { key: 'distance',    label: 'Nearest',    icon: MapPin },
  { key: 'all',         label: 'All Shops',  icon: LayoutGrid },
];

// Doorstep pickup radius is chosen on a slider from MIN_RADIUS_KM up to MAX_RADIUS_KM.
const MIN_RADIUS_KM = 1;
// Pickup is never offered beyond 20 km — the slider and every search are capped here.
const MAX_RADIUS_KM = 20;
const ORANGE = '#F09406';
const addrText = (a) => [a.addressLine, a.area || a.locality, a.district || a.city, a.pincode].filter(Boolean).join(', ');

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

  const { lat: gLat, lng: gLng, source, loading: locLoading, error: locError, addressLabel, refresh: refreshLoc } = useCustomerLocation({ enableGps: false }); // never GPS — the selected address decides

  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState(null);
  const [checking, setChecking] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState(null);
  const [addrLoaded, setAddrLoaded] = useState(false);
  const pinTouched = useRef(false); // manual PIN edits are never overwritten except on address change

  useFocusEffect(useCallback(() => {
    listAddresses().then((l) => setAddresses(l || [])).catch(() => {}).finally(() => setAddrLoaded(true));
  }, []));
  const pickupAddr = useMemo(
    () => {
      // The address chosen on Select Address always wins — never the default/previous one.
      const picked = params.pickedAddress;
      if (addrId != null && picked && String(picked.id) === String(addrId)) {
        return addresses.find((a) => String(a.id) === String(addrId)) || picked;
      }
      return addresses.find((a) => String(a.id) === String(addrId)) || (addrId == null ? (addresses.find((a) => a.isDefault) || addresses[0]) : null) || null;
    },
    [addresses, addrId, params.pickedAddress],
  );
  // The selected pickup address drives availability (verified coords only).
  // A checked PIN is an optional search that never replaces that address.
  const [pinCenter, setPinCenter] = useState(null); // { lat, lng, pin }
  // Pickup location = the selected address's own verified coordinates.
  // A PIN centroid is never treated as the exact address. Never device GPS.
  const addrPin = String(pickupAddr?.pincode || '').trim();
  const savedCenter = useMemo(() => verifiedCoords(pickupAddr), [pickupAddr]);
  // Cross-check the saved pin against the address's own PIN area: a pin more
  // than 20 km from its PIN (e.g. saved at the wrong place) is not trusted.
  // Approximate area (never treated as exact): geocode the full address text,
  // falling back to its PIN code alone.
  const [pinArea, setPinArea] = useState(null);
  const [addrResolving, setAddrResolving] = useState(false);
  const addrFull = pickupAddr ? addrText(pickupAddr) : '';
  useEffect(() => {
    let alive = true;
    setPinArea(null);
    if (!/^\d{6}$/.test(addrPin)) { setAddrResolving(false); return undefined; }
    setAddrResolving(true);
    // Works on web too (expo-location's geocoder always throws there, which
    // previously skipped this check and trusted any saved pin).
    resolvePinArea(addrPin).then((c) => { if (alive) { setPinArea(c); setAddrResolving(false); } });
    return () => { alive = false; };
  }, [addrPin, addrFull]);
  // Saved pin more than 20 km from its own PIN area is not trusted.
  const pinMismatch = !!(savedCenter && pinArea && haversineKm(savedCenter, pinArea) > MAX_RADIUS_KM);
  const addrCenter = savedCenter && !pinMismatch ? savedCenter : null; // exact
  // No trusted exact pin → PIN-area distances (approximate, booking blocked).
  const approxCenter = !addrCenter ? pinArea : null;
  const isApprox = !pinCenter && !addrCenter && !!approxCenter;
  const addrNoCoords = addrLoaded && !addrResolving && !addrCenter && !approxCenter; // cannot be located at all
  const center = pinCenter || addrCenter || approxCenter;
  const lat = center ? center.lat : null;
  const lng = center ? center.lng : null;

  // Prefill PIN from the saved address once (unless the customer typed one).
  useEffect(() => {
    if (pickupAddr?.pincode && !pinTouched.current && !pin) setPin(String(pickupAddr.pincode).trim());
  }, [pickupAddr]); // eslint-disable-line react-hooks/exhaustive-deps

  // PIN → coordinates via the device geocoder. No guessing: unresolved = error.
  const checkPin = useCallback(async (p) => {
    const v = String(p || '').trim();
    if (!/^\d{6}$/.test(v)) { setPinMsg('Enter a valid 6-digit PIN code'); return; }
    setPinMsg(null);
    if (v === addrPin && addrCenter) { setPinCenter(null); return; }
    setChecking(true);
    try {
      const g = await resolvePinArea(v);
      if (!g) throw new Error();
      setPinCenter({ lat: g.lat, lng: g.lng, pin: v });
    } catch (_) {
      setPinMsg('Could not locate this PIN code. Check the PIN and try again.');
    } finally { setChecking(false); }
  }, [addrPin, addrCenter]);

  // Address picked via Change Address → back to address mode, refresh shops.
  useEffect(() => {
    const id = params.pickedAddressId;
    if (id == null) return;
    setAddrId(id);
    setShops([]); // clear stale results from the previous address
    setPinCenter(null);
    setPin(String(params.pickedAddress?.pincode || '').trim());
    pinTouched.current = false;
    listAddresses().then((l) => {
      setAddresses(l || []);
      const a = (l || []).find((x) => x.id === id);
      if (!a) return;
      const p = String(a.pincode || '').trim();
      pinTouched.current = false;
      setPin(p);
      setPinMsg(null);
      setPinCenter(null);
    }).catch(() => {});
  }, [params.pickedAddressId, params.pickedAt]); // pickedAt re-runs even for the same address
  const openAddressPicker = () => navigation.navigate('RepairSelectAddress', { ...params, pickMode: true, addressId: pickupAddr?.id });

  const [radiusKm, setRadiusKm] = useState(20);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopError, setShopError] = useState(null);
  const [sort, setSort] = useState('recommended');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [showRadius, setShowRadius] = useState(false);
  // True when we widened the bubble because the user's bubble was empty.
  // Used to render a banner explaining "no shops within X km, showing nearest instead".
  const [autoExpanded, setAutoExpanded] = useState(false);

  // (Re)fetch whenever location resolves or radius changes.
  // Strict radius â€” empty state ("No shops within X km") rather than
  // silently widening the search and showing shops 150 km away.
  // Distances/eligibility are always measured from the pickup ADDRESS (exact
  // pin, else its approximate area) — a manual PIN search only moves discovery.
  const eligOrigin = addrCenter || approxCenter;
  const eLat = eligOrigin ? eligOrigin.lat : null;
  const eLng = eligOrigin ? eligOrigin.lng : null;
  const gate = useRef(createLatestGate()).current; // only the latest request may write results
  const fetchShops = useCallback(async () => {
    const seq = gate.next();
    setShops([]);
    setLoading(true);
    setShopError(null);
    setAutoExpanded(false);
    try {
      const list = await listNearbyShops({
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        radiusKm: lat != null && lng != null ? Math.min(radiusKm, MAX_RADIUS_KM) : undefined,
      });
      if (!gate.isLatest(seq)) return; // stale response for a previous address/PIN
      // Filter BEFORE rendering: verified coords, distance from the pickup address, <= 20 km.
      setShops(eligiblePickupShops(list, eLat != null ? { lat: eLat, lng: eLng } : null, Math.min(radiusKm, MAX_RADIUS_KM)));
    } catch (e) {
      if (!gate.isLatest(seq)) return;
      setShopError(e?.message || 'Could not load shops');
      setShops([]);
    } finally {
      if (gate.isLatest(seq)) setLoading(false);
    }
  }, [lat, lng, eLat, eLng, radiusKm]);

  useEffect(() => { if (center) fetchShops(); else { gate.invalidate(); setShops([]); setLoading(false); } }, [center, fetchShops]);

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
    else if (sort === 'all') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    // ETA is proportional to distance for a fixed travel mode, so "Fastest"
    // sorts by distance too.
    else list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    return list;
  }, [shops, q, sort]);

  const showLoader = !addrLoaded || addrResolving || (loading && shops.length === 0);

  const emptyActionLabel = q ? 'Clear search' : (lat != null && radiusKm < MAX_RADIUS_KM ? `Expand to ${MAX_RADIUS_KM} km` : null);
  const onEmptyAction = () => { if (q) setQ(''); else setRadiusKm(MAX_RADIUS_KM); };

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <FlowHeader
        title="Pickup Service Shop"
        subtitle="Choose a shop near you"
        navigation={navigation}
        right={(
          <Pressable onPress={() => setShowRadius((v) => !v)} accessibilityLabel="Search settings" className="active:opacity-85" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#035C6C', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={22} color="#fff" />
          </Pressable>
        )}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Hero banner */}
        <LinearGradient
          colors={['#F0F8F9', '#DDF0F2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ marginHorizontal: 16, marginTop: 6, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(17), fontWeight: '900', color: FLOW.ink, letterSpacing: -0.3 }}>Select a repair shop for Pickup Service</Text>
            {['Free Pickup', `Within ${radiusKm} km`].map((t) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <CheckCircle2 size={16} color="#fff" fill={FLOW.deep} />
                <Text style={{ fontSize: rf(12.5), color: FLOW.ink, marginLeft: 7 }}>{t}</Text>
              </View>
            ))}
          </View>
          <View pointerEvents="none" style={{ width: 150, height: 104 }}>
            {/* faint city skyline */}
            <View style={{ position: 'absolute', left: 30, bottom: 0, width: 18, height: 60, backgroundColor: 'rgba(3,92,108,0.08)', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
            <View style={{ position: 'absolute', right: 6, bottom: 0, width: 22, height: 74, backgroundColor: 'rgba(3,92,108,0.08)', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
            <MapPin size={26} color="#fff" fill="#F09406" style={{ position: 'absolute', left: 0, top: 30 }} />
            {/* shop: striped awning + body */}
            <View style={{ position: 'absolute', left: 38, top: 22, width: 70, alignItems: 'center' }}>
              <View style={{ width: 70, height: 8, backgroundColor: '#035C6C', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              <View style={{ flexDirection: 'row', width: 74 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <View key={i} style={{ flex: 1, height: 14, backgroundColor: i % 2 ? '#fff' : '#035C6C', borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} />
                ))}
              </View>
              <View style={{ width: 62, height: 46, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D5E6E9', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 5 }}>
                <View style={{ width: 22, height: 18, borderWidth: 2, borderColor: '#035C6C', borderRadius: 2 }} />
                <View style={{ width: 16, height: 30, backgroundColor: '#035C6C', borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
              </View>
              <View style={{ width: 74, height: 5, backgroundColor: '#035C6C', borderRadius: 2 }} />
            </View>
            <MapPin size={26} color="#fff" fill="#F09406" style={{ position: 'absolute', left: 60, top: -6 }} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...cardShadow }}>
              <Bike size={22} color="#F09406" />
            </View>
          </View>
        </LinearGradient>

        {/* Pickup address + PIN check */}
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: FLOW.border, padding: 12, ...cardShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: FLOW.deep, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: rf(11.5), color: FLOW.muted }}>Pickup Address</Text>
              <Text style={{ fontSize: rf(13), fontWeight: '700', color: FLOW.ink, marginTop: 1 }} numberOfLines={2}>
                {pickupAddr ? addrText(pickupAddr) : 'No pickup address selected'}
              </Text>
              {pickupAddr?.pincode ? <Text style={{ fontSize: rf(11.5), color: '#035C6C', fontWeight: '700', marginTop: 2 }}>PIN Code: {String(pickupAddr.pincode).trim()}</Text> : null}
            </View>
            <Pressable onPress={openAddressPicker} hitSlop={8} className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <Pencil size={14} color={FLOW.deep} />
              <Text style={{ fontSize: rf(13), fontWeight: '700', color: FLOW.deep, marginLeft: 4 }}>Change</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 14, borderWidth: 1, borderColor: FLOW.border, paddingHorizontal: 12 }}>
              <Search size={18} color={FLOW.deep} />
              <TextInput
                value={pin}
                onChangeText={(t) => { pinTouched.current = true; setPin(t.replace(/\D/g, '').slice(0, 6)); }}
                onSubmitEditing={() => checkPin(pin)}
                placeholder="Enter 6-digit PIN code"
                placeholderTextColor={BRAND.muted}
                keyboardType="number-pad"
                maxLength={6}
                style={{ flex: 1, marginLeft: 8, fontSize: rf(13.5), color: FLOW.ink, paddingVertical: 0 }}
                returnKeyType="search"
              />
              {pin ? (
                <Pressable onPress={() => { pinTouched.current = true; setPin(''); }} hitSlop={8} accessibilityLabel="Clear PIN">
                  <X size={16} color={FLOW.muted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => checkPin(pin)} disabled={checking} className="active:opacity-85" style={{ height: 46, marginLeft: 8, paddingHorizontal: 16, borderRadius: 14, backgroundColor: FLOW.deep, flexDirection: 'row', alignItems: 'center' }}>
              <Search size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13.5), marginLeft: 6 }}>{checking ? 'Checking…' : 'Check'}</Text>
            </Pressable>
          </View>
          {pinMsg ? <Text style={{ fontSize: rf(11.5), color: BRAND.red, marginTop: 6 }}>{pinMsg}</Text> : null}
        </View>

        {/* ONE compact warning — the message follows the actual state (never two cards). */}
        {(() => {
          if (pinCenter) return null;
          const unverified = !!pickupAddr && (isApprox || addrNoCoords);
          const noAddress = !pickupAddr && addrNoCoords;
          const noShops = !unverified && !noAddress && !showLoader && !shopError && lat != null && !q && !shops.length;
          const msg = noAddress ? `Add a pickup address to find shops within ${MAX_RADIUS_KM} km.`
            : unverified ? `Verify your pickup address to find shops within ${MAX_RADIUS_KM} km.`
              : noShops ? `No pickup shops available within ${MAX_RADIUS_KM} km. Please change your address.` : null;
          if (!msg) return null;
          return (
            <View style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: '#FFF4E3', borderWidth: 1, borderColor: ORANGE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '700', color: FLOW.ink, lineHeight: rf(17) }}>{msg}</Text>
              <Pressable onPress={openAddressPicker} className="active:opacity-85" style={{ marginLeft: 10, height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center' }}>
                <Pencil size={12} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(12), marginLeft: 5 }}>Change Address</Text>
              </Pressable>
            </View>
          );
        })()}

        {/* PIN search note / pickup available banner */}
        {pinCenter ? (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#FFF4E3', borderWidth: 1, borderColor: ORANGE, borderRadius: 14, padding: 12 }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: FLOW.ink }}>Search results near PIN {pinCenter.pin}</Text>
            <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 3 }}>
              {`Distances are from the PIN area, not your address. Pickup eligibility is checked against your selected address (within ${MAX_RADIUS_KM} km of the shop).`}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Pressable onPress={openAddressPicker} className="active:opacity-85" style={{ height: 38, paddingHorizontal: 16, borderRadius: 12, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center' }}>
                <Pencil size={13} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(12.5), marginLeft: 5 }}>Change Address</Text>
              </Pressable>
              <Pressable onPress={() => { setPinCenter(null); setPinMsg(null); }} className="active:opacity-85" style={{ height: 38, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#035C6C', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                <Text style={{ color: '#035C6C', fontWeight: '800', fontSize: rf(12.5) }}>Use my address</Text>
              </Pressable>
            </View>
          </View>
        ) : !showLoader && !shopError && lat != null && !q && shops.length ? (
            <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#E6F1F3', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
              <CheckCircle2 size={18} color="#fff" fill="#035C6C" />
              <Text style={{ marginLeft: 8, fontSize: rf(13), fontWeight: '800', color: '#035C6C' }}>{`Pickup Service Available`}</Text>
            </View>
        ) : null}

        {/* Location warning */}
        {false ? ( /* GPS prompt retired: the selected address decides */
          <View style={{ backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine, borderRadius: 14, marginHorizontal: 16, marginTop: 10, padding: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Crosshair size={15} color={BRAND.yellow} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: FLOW.ink }}>Set a pickup location</Text>
              <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 2, lineHeight: rf(16) }}>
                We're showing all shops. Save a default address (with location) for distance-sorted results.
              </Text>
            </View>
            <Pressable onPress={refreshLoc} className="active:opacity-70" style={{ backgroundColor: 'rgba(250,167,0,0.28)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
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

        {/* Radius strip — tap to adjust (hidden when no eligible shops) */}
        {lat != null && lng != null && (shops.length > 0 || showRadius) ? (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#EAF7EC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Pressable onPress={() => setShowRadius((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Crosshair size={18} color="#1F8A3B" />
              <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(13), color: FLOW.ink }}>
                Showing shops within <Text style={{ fontWeight: '900', color: '#1F8A3B', fontSize: rf(15) }}>{radiusKm} km</Text> of your address
              </Text>
              <Info size={18} color={FLOW.ink} />
            </Pressable>
            {showRadius ? (
              <View style={{ marginTop: 6 }}>
                <RadiusSlider min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} value={radiusKm} onChange={setRadiusKm} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: rf(11), color: FLOW.muted }}>{MIN_RADIUS_KM} km</Text>
                  <Text style={{ fontSize: rf(11), color: FLOW.muted }}>{MAX_RADIUS_KM} km</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Sort chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14 }}>
          {SORTS.map((s) => {
            const SIcon = s.icon;
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => { setSort(s.key); if (s.key === 'all') setRadiusKm(MAX_RADIUS_KM); }}
                className="active:opacity-85"
                style={{
                  flexDirection: 'row', alignItems: 'center', height: 38, paddingHorizontal: 14, borderRadius: 19, marginRight: 8,
                  backgroundColor: active ? FLOW.deep : '#fff', borderWidth: 1, borderColor: active ? FLOW.deep : FLOW.border,
                }}
              >
                <SIcon size={15} color={active ? '#fff' : FLOW.ink} />
                <Text style={{ fontSize: rf(13), fontWeight: '700', color: active ? '#fff' : FLOW.ink, marginLeft: 6 }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16, marginBottom: 10 }}>
          <Text style={{ fontSize: rf(16), fontWeight: '800', color: FLOW.ink }}>
            {q ? `Results (${filtered.length})` : `Nearby Repair Shops (${filtered.length})`}
          </Text>
          <Pressable
            onPress={() => { const i = SORTS.findIndex((s) => s.key === sort); setSort(SORTS[(i + 1) % SORTS.length].key); }}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: FLOW.deep }}>
              Sort: {sort === 'rating' ? 'Rating' : sort === 'all' ? 'Name' : 'Distance'}
            </Text>
            <ChevronDown size={16} color={FLOW.ink} style={{ marginLeft: 3 }} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {showLoader ? (
            <Loader label="Finding shops near you..." />
          ) : shopError ? (
            <View style={{ backgroundColor: '#FEEBEA', borderWidth: 1, borderColor: 'rgba(243,44,38,0.35)', borderRadius: 14, padding: 11 }}>
              <Text style={{ fontSize: rf(12), color: BRAND.red }}>{shopError}</Text>
            </View>
          ) : (addrNoCoords && !pinCenter) || (!filtered.length && lat != null && !q) ? null : !filtered.length ? (
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
            filtered.map((s, idx) => (
              <Pressable
                key={s.id}
                onPress={() => navigation.navigate('RepairShopDetails', { ...params, shopId: s.id, shopImage: s.frontImageUrl || undefined, addressId: pickupAddr?.id })}
                className="active:opacity-90"
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: idx === 0 ? 1.5 : 1, borderColor: idx === 0 ? FLOW.deep : FLOW.border, padding: 10, marginBottom: 10, ...cardShadow }}
              >
                {s.frontImageUrl ? (
                  <Image source={{ uri: s.frontImageUrl }} style={{ width: 96, height: 74, borderRadius: 10, backgroundColor: FLOW.mint }} />
                ) : (
                  <View style={{ width: 96, height: 74, borderRadius: 10, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center' }}>
                    <Store size={28} color={FLOW.deep} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: rf(14), fontWeight: '800', color: FLOW.ink, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
                    <BadgeCheck size={16} color="#fff" fill={FLOW.deep} style={{ marginLeft: 4 }} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <MapPin size={12} color={FLOW.muted} />
                    <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginLeft: 3, flex: 1 }} numberOfLines={1}>{s.address || s.city}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Star size={13} color={BRAND.yellow} fill={BRAND.yellow} />
                    <Text style={{ fontSize: rf(12), fontWeight: '800', color: FLOW.ink, marginLeft: 3 }}>{Number(s.rating || 4.5).toFixed(1)}</Text>
                    <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginLeft: 3 }}>({s.reviewCount || 100} reviews)</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
                  {/* Distance from the selected pickup address (computed, verified coords only). */}
                  {Number.isFinite(s.distanceKm) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#035C6C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <MapPin size={12} color="#fff" />
                      <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: '#fff', marginLeft: 4 }}>{(addrCenter ? '' : '~') + s.distanceKm.toFixed(1)} km</Text>
                    </View>
                  ) : null}
                  {Number.isFinite(s.distanceKm) && s.distanceKm <= MAX_RADIUS_KM ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF7EC', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 }}>
                      <Truck size={12} color="#1F8A3B" />
                      <Text style={{ fontSize: rf(10.5), fontWeight: '700', color: '#1F8A3B', marginLeft: 4 }}>Pickup Available</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
