import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Home, Briefcase, MapPin } from 'lucide-react-native';
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
import { rf } from '../../../utils/responsive';

function iconForLabel(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('home')) return Home;
  if (l.includes('work') || l.includes('office')) return Briefcase;
  return MapPin;
}

export default function RepairSelectAddressScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const params = route.params || {};
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
    <View className="flex-1 bg-background">
      <View className="bg-card px-4 py-3 border-b border-border">
        <StepIndicator steps={4} current={1} />
        <View className="flex-row justify-between mt-2 px-1">
          <Text className="font-bold text-primary" style={{ fontSize: rf(10) }}>Service</Text>
          <Text className="font-bold text-primary" style={{ fontSize: rf(10) }}>Address</Text>
          <Text className="font-bold text-text-muted" style={{ fontSize: rf(10) }}>Slot</Text>
          <Text className="font-bold text-text-muted" style={{ fontSize: rf(10) }}>Review</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
        <View className="mb-3">
          <Text className="font-extrabold text-text" style={{ fontSize: rf(18) }}>Where should we pick up?</Text>
          <Text className="text-text-muted mt-1" style={{ fontSize: rf(12) }}>Pickup is free across all serviceable areas.</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('AddressForm', {})}
          className="bg-primary/5 border border-dashed border-primary/40 rounded-2xl p-4 flex-row items-center justify-center mb-4 active:opacity-80"
        >
          <Plus size={18} color="#00008B" />
          <Text className="font-extrabold text-primary ml-2" style={{ fontSize: rf(13) }}>Add new address</Text>
        </Pressable>

        {items.length === 0 ? (
          <EmptyState
            icon={<MapPin size={28} color="#00008B" />}
            title="No saved addresses"
            description="Add one to schedule your pickup."
            actionLabel="Add address"
            onAction={() => navigation.navigate('AddressForm', {})}
          />
        ) : (
          items.map((a) => {
            const Icon = iconForLabel(a.label);
            const active = selectedId === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => setSelectedId(a.id)}
                className={`bg-card rounded-2xl border p-4 mb-3 active:opacity-80 ${active ? 'border-primary' : 'border-border'}`}
                style={active ? { shadowColor: '#00008B', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 } : undefined}
              >
                <View className="flex-row items-start">
                  <View className={`h-10 w-10 rounded-full items-center justify-center mr-3 ${active ? 'bg-primary' : 'bg-primary/10'}`}>
                    <Icon size={18} color={active ? '#fff' : '#00008B'} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="font-extrabold text-text mr-2" style={{ fontSize: rf(14) }}>{a.label || 'Address'}</Text>
                      {a.isDefault ? <Badge variant="softSuccess">DEFAULT</Badge> : null}
                    </View>
                    {(a.fullName || a.mobile) ? (
                      <Text className="text-text-muted mt-1" style={{ fontSize: rf(12) }}>{a.fullName}{a.mobile ? ` · ${a.mobile}` : ''}</Text>
                    ) : null}
                    <Text className="text-text mt-1 leading-5" style={{ fontSize: rf(12) }}>
                      {[a.addressLine, a.locality, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  <View className={`h-5 w-5 rounded-full border-2 ${active ? 'border-primary' : 'border-border'} items-center justify-center`}>
                    {active ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <BottomActionBar
        title="Continue to slot selection"
        onPress={() => navigation.navigate('RepairPickupSlot', { ...params, addressId: selectedId })}
        disabled={!selectedId}
      />
    </View>
  );
}

