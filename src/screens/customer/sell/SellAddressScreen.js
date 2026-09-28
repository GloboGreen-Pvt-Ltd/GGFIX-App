import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Home, Briefcase, MapPin } from 'lucide-react-native';
import { Loader, BottomActionBar, EmptyState, Badge, useBottomBarInset } from '../../../components/rnr';
import { listAddresses } from '../../../api/customer';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';

function iconFor(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('home')) return Home;
  if (l.includes('work') || l.includes('office')) return Briefcase;
  return MapPin;
}

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
    <View style={{ flex: 1, backgroundColor: '#F8FCFA' }}>
      <FlowDecor />
      <FlowHeader title="Select Address" navigation={navigation} backStyle="white" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: bottomSpace }}>
        <Text style={{ fontSize: rf(26), fontWeight: '800', color: '#08162B', letterSpacing: -0.4 }}>Where should we pick up?</Text>
        <Text style={{ fontSize: rf(14), color: '#687990', marginTop: 4, marginBottom: 18 }}>Free doorstep pickup across serviceable areas.</Text>

        <Pressable
          onPress={() => navigation.navigate('AddressForm', {})}
          className="active:opacity-85"
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FBF7', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9ED3BF', borderRadius: 22, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 14 }}
        >
          <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: '#DFF8EF', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Plus size={24} color="#005747" strokeWidth={2.5} />
          </View>
          <Text style={{ fontSize: rf(16), fontWeight: '800', color: '#005747' }}>Add new address</Text>
        </Pressable>

        {items.length === 0 ? (
          <EmptyState
            icon={<MapPin size={26} color="#006B57" />}
            title="No saved addresses"
            description="Add one to schedule pickup."
            actionLabel="Add address"
            onAction={() => navigation.navigate('AddressForm', {})}
          />
        ) : (
          items.map((a) => {
            const Icon = iconFor(a.label);
            const active = selectedId === a.id;
            const rest = [a.locality, a.city, a.state, a.pincode].filter(Boolean).join(', ');
            return (
              <Pressable
                key={a.id}
                onPress={() => setSelectedId(a.id)}
                className="active:opacity-90"
                style={{
                  backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, overflow: 'hidden',
                  borderWidth: active ? 1.5 : 1, borderColor: active ? '#7FCBB1' : '#DFE9E5',
                  ...(active ? { shadowColor: '#006B57', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 } : cardShadow),
                }}
              >
                <View pointerEvents="none" style={{ position: 'absolute', right: -30, bottom: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: '#F0FBF7' }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ height: 54, width: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: active ? '#005747' : '#DFF8EF', borderWidth: 4, borderColor: active ? '#E3F4EE' : '#fff' }}>
                    <Icon size={23} color={active ? '#fff' : '#005747'} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: rf(17), fontWeight: '800', color: '#08162B', marginRight: 8 }}>{a.label || 'Address'}</Text>
                      {a.isDefault ? (
                        <View style={{ backgroundColor: '#DFF8EF', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 }}>
                          <Text style={{ fontSize: rf(11), fontWeight: '800', color: '#005747', letterSpacing: 0.6 }}>DEFAULT</Text>
                        </View>
                      ) : null}
                    </View>
                    {(a.fullName || a.mobile) ? (
                      <Text style={{ fontSize: rf(13.5), color: '#687990', marginTop: 6 }}>{a.fullName}{a.mobile ? ` · ${a.mobile}` : ''}</Text>
                    ) : null}
                    {a.addressLine ? (
                      <Text style={{ fontSize: rf(13.5), color: '#08162B', marginTop: 5, lineHeight: rf(19) }}>{a.addressLine}</Text>
                    ) : null}
                    {rest ? (
                      <Text style={{ fontSize: rf(13.5), color: '#334155', marginTop: 3, lineHeight: rf(19) }}>{rest}</Text>
                    ) : null}
                  </View>
                  <View style={{ height: 28, width: 28, borderRadius: 14, borderWidth: 2.5, borderColor: active ? '#005747' : '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                    {active ? <View style={{ height: 14, width: 14, borderRadius: 7, backgroundColor: '#005747' }} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <BottomActionBar>
        <FlowCta
          title="Continue"
          onPress={() => navigation.navigate('SellComplete', { ...params, addressId: selectedId, address: items.find((a) => a.id === selectedId) })}
          disabled={!selectedId}
        />
      </BottomActionBar>
    </View>
  );
}
