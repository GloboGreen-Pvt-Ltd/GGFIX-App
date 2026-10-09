import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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

// Brand palette in the FLOW shape (09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141).
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
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

export default function RepairSelectAddressScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const params = route.params || {};
  useHideStackHeader(navigation);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await listAddresses();
      setItems(list);
      if (list[0]) setSelectedId(list.find((a) => a.isDefault)?.id || list[0].id);
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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
                <View style={{ height: 28, width: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? BRAND.green : '#EDEDED', borderWidth: active ? 3 : 0, borderColor: 'rgba(9,173,42,0.25)' }}>
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
          title="Continue to slot selection"
          onPress={() => navigation.navigate('RepairPickupSlot', { ...params, addressId: selectedId })}
          disabled={!selectedId}
          palette={BRAND_FLOW}
        />
      </BottomActionBar>
    </View>
  );
}
