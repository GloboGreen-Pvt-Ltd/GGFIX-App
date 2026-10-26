import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MapPin } from 'lucide-react-native';
import { Loader, BottomActionBar, EmptyState, useBottomBarInset } from '../../../components/rnr';
import { AddAddressRow, AddressOptionCard } from '../../../components/AddressPick';
import { listAddresses } from '../../../api/customer';
import { rf } from '../../../utils/responsive';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
import { FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';

export default function SellAddressScreen({ navigation, route }) {
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

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <FlowDecor palette={BRAND_FLOW} />
      <FlowHeader title="Select Address" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: bottomSpace }}>
        <Text style={{ fontSize: rf(17), fontWeight: '800', color: BRAND.ink }}>Where should we pick up?</Text>
        <Text style={{ fontSize: rf(12), color: BRAND.muted, marginTop: 2, marginBottom: 12 }}>Free doorstep pickup across serviceable areas.</Text>

        <AddAddressRow onPress={() => navigation.navigate('AddressForm', {})} subtitle="Save a new address for pickup" />

        {items.length === 0 ? (
          <EmptyState
            icon={<MapPin size={26} color={BRAND.green} />}
            accent={BRAND.green}
            accentSoft="#EAF8EC"
            title="No saved addresses"
            description="Add one to schedule pickup."
            actionLabel="Add address"
            onAction={() => navigation.navigate('AddressForm', {})}
          />
        ) : (
          items.map((a) => (
            <AddressOptionCard key={a.id} a={a} active={selectedId === a.id} onPress={() => setSelectedId(a.id)} />
          ))
        )}
      </ScrollView>

      <BottomActionBar>
        <FlowCta
          palette={BRAND_FLOW}
          title="Continue"
          onPress={() => navigation.navigate('SellComplete', { ...params, addressId: selectedId, address: items.find((a) => a.id === selectedId) })}
          disabled={!selectedId}
        />
      </BottomActionBar>
    </View>
  );
}
