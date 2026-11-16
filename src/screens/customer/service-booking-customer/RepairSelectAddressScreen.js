import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { getShop } from '../../../api/shops';
import { eligiblePickupShops } from '../../../utils/pickupDistance';
import { checkAddressLocation } from '../../../utils/pinGeocode';

// Alert.alert does nothing on web — use window.alert there.
const warn = (t, m) => (Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m));

const PICKUP_MAX_KM = 20; // never allow pickup bookings beyond this
import { useFocusEffect } from '@react-navigation/native';
import { MapPin, Check } from 'lucide-react-native';
import {
  Loader,
  BottomActionBar,
  Card,
  StepIndicator,
  EmptyState,
  Button,
  Badge,
  useBottomBarInset,
} from '../../../components/rnr';
import { listAddresses } from '../../../api/customer';
import { AddAddressRow, AddressOptionCard } from '../../../components/AddressPick';
import { rf } from '../../../utils/responsive';
import { FLOW as BASE_FLOW, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';

// Brand palette in the FLOW shape (035C6C · 111111 · F3F4F6 · F3F4F6 · FAA700 · F32C26).
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
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

export default function RepairSelectAddressScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const params = route.params || {};
  useHideStackHeader(navigation);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listAddresses();
      setItems(list);
      if (list[0]) setSelectedId((cur) => cur || list.find((a) => a.id === params.addressId)?.id || list.find((a) => a.isDefault)?.id || list[0].id);
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Change Address (from the shop list) → hand the pick back for a recheck.
  // Booking flow → verify the exact address coords are within 20 km of the shop.
  const onContinue = async () => {
    if (params.pickMode) {
      const a = items.find((x) => x.id === selectedId) || {};
      // Hand back the exact selected address: id, full text, PIN and coords.
      navigation.navigate({
        name: 'RepairPickupShops',
        merge: true,
        params: {
          pickedAddressId: selectedId,
          pickedAt: Date.now(),
          pickedAddress: {
            ...a,
            fullAddress: [a.addressLine, a.area || a.locality, a.taluk, a.district || a.city, a.state, a.pincode].filter(Boolean).join(', '),
            pincode: String(a.pincode || '').trim(),
            latitude: a.latitude ?? null,
            longitude: a.longitude ?? null,
          },
        },
      });
      return;
    }
    if (params.shopId) {
      const a = items.find((x) => x.id === selectedId);
      setChecking(true);
      // Exact, verified coords only — and they must match the address's own PIN area.
      const loc = await checkAddressLocation(a);
      if (!loc.coords || !loc.trusted) {
        setChecking(false);
        warn('Verify Pickup Address', loc.coords
          ? "This address's map location does not match its PIN code. Edit the address and set its exact location."
          : 'This address has no map location. Edit it to set the exact location, or choose another address.');
        return;
      }
      const la = loc.coords.lat, ln = loc.coords.lng;
      try {
        const shop = await getShop(params.shopId, { lat: la, lng: ln });
        // Same shared rule as the shop list: recompute from verified coords;
        // never trust a server distance (old builds return 0.0 for unknowns).
        const elig = eligiblePickupShops([shop], { lat: la, lng: ln }, PICKUP_MAX_KM);
        const d = elig.length ? elig[0].distanceKm : NaN;
        if (!Number.isFinite(d) || d > PICKUP_MAX_KM) {
          warn('Pickup unavailable', `Pickup is available only within ${PICKUP_MAX_KM} km of the shop. Please choose another address.`);
          return;
        }
      } catch (e) {
        warn('Could not verify address', e?.message || 'Please try again.');
        return;
      } finally { setChecking(false); }
    }
    navigation.navigate('RepairPickupSlot', { ...params, addressId: selectedId });
  };

  if (loading) return <Loader label="Loading addresses..." />;

  // Visual stepper (same 4 steps as before; this screen is step 2).
  const STEPS = ['Service', 'Address', 'Slot', 'Review'];
  const current = 1;

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <FlowDecor palette={BRAND_FLOW} />
      <FlowHeader title="Select Address" navigation={navigation} />

      {/* Progress stepper */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 }}>
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const on = done || active;
          return (
            <React.Fragment key={label}>
              <View style={{ alignItems: 'center', width: 60 }}>
                <View style={{ height: 28, width: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? BRAND.green : '#E8EAEE', borderWidth: active ? 3 : 0, borderColor: 'rgba(3,92,108,0.25)' }}>
                  {done ? <Check size={14} color="#fff" strokeWidth={3} /> : (
                    <Text style={{ fontSize: rf(12), fontWeight: '800', color: on ? '#fff' : FLOW.muted }}>{i + 1}</Text>
                  )}
                </View>
                <Text style={{ fontSize: rf(11), fontWeight: '700', color: on ? FLOW.deep : FLOW.muted, marginTop: 4 }} numberOfLines={1}>{label}</Text>
              </View>
              {i < STEPS.length - 1 ? (
                <View style={{ flex: 1, height: 3, borderRadius: 2, marginTop: 12.5, marginHorizontal: -6, backgroundColor: i < current ? FLOW.primary : FLOW.border }} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: FLOW.border, ...cardShadow }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: bottomSpace }}>
          <Text style={{ fontSize: rf(16), fontWeight: '800', color: FLOW.ink }}>Where should we pick up?</Text>
          <Text style={{ fontSize: rf(11.5), color: FLOW.muted, marginTop: 2, marginBottom: 10 }}>Pickup is free across all serviceable areas.</Text>

          <AddAddressRow onPress={() => navigation.navigate('AddressForm', {})} subtitle="Save a new address for pickup" />

          {items.length === 0 ? (
            <EmptyState
              icon={<MapPin size={28} color={FLOW.deep} />}
              accent={BRAND.green}
              accentSoft={FLOW.mint}
              title="No saved addresses"
              description="Add one to schedule your pickup."
              actionLabel="Add address"
              onAction={() => navigation.navigate('AddressForm', {})}
            />
          ) : (
            items.map((a) => (
              <AddressOptionCard key={a.id} a={a} active={selectedId === a.id} onPress={() => setSelectedId(a.id)} />
            ))
          )}
        </ScrollView>
      </View>

      <BottomActionBar>
        <FlowCta
          title={params.pickMode ? 'Use this address' : (checking ? 'Checking pickup area…' : 'Continue to slot selection')}
          onPress={onContinue}
          disabled={!selectedId || checking}
          palette={BRAND_FLOW}
        />
      </BottomActionBar>
    </View>
  );
}
