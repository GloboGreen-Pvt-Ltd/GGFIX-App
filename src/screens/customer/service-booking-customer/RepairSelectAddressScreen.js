import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Home, Briefcase, MapPin, Check, ChevronRight } from 'lucide-react-native';
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
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';

function iconForLabel(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('home')) return Home;
  if (l.includes('work') || l.includes('office')) return Briefcase;
  return MapPin;
}

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
      <FlowDecor />
      <FlowHeader title="Select Address" navigation={navigation} backStyle="white" />

      {/* Progress stepper */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 }}>
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const on = done || active;
          return (
            <React.Fragment key={label}>
              <View style={{ alignItems: 'center', width: 64 }}>
                <View style={{ height: 36, width: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? '#0A8A6B' : active ? FLOW.deep : '#E8EDF1', borderWidth: active ? 3 : 0, borderColor: '#BFE9DB' }}>
                  {done ? <Check size={18} color="#fff" strokeWidth={3} /> : (
                    <Text style={{ fontSize: rf(14), fontWeight: '800', color: on ? '#fff' : FLOW.muted }}>{i + 1}</Text>
                  )}
                </View>
                <Text style={{ fontSize: rf(12), fontWeight: '700', color: on ? FLOW.deep : FLOW.muted, marginTop: 6 }} numberOfLines={1}>{label}</Text>
              </View>
              {i < STEPS.length - 1 ? (
                <View style={{ flex: 1, height: 3, borderRadius: 2, marginTop: 16, marginHorizontal: -6, backgroundColor: i < current ? FLOW.primary : '#E3E8EC' }} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, ...cardShadow }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: bottomSpace }}>
          <Text style={{ fontSize: rf(21), fontWeight: '800', color: FLOW.ink }}>Where should we pick up?</Text>
          <Text style={{ fontSize: rf(13), color: FLOW.muted, marginTop: 4, marginBottom: 18 }}>Pickup is free across all serviceable areas.</Text>

          <Pressable
            onPress={() => navigation.navigate('AddressForm', {})}
            className="active:opacity-85"
            style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: FLOW.tint,
              borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9ED3BF', borderRadius: 20,
              paddingVertical: 16, paddingHorizontal: 16, marginBottom: 14,
            }}
          >
            <View style={{ height: 52, width: 52, borderRadius: 26, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Plus size={24} color={FLOW.deep} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(15.5), fontWeight: '800', color: FLOW.deep }}>Add new address</Text>
              <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 2 }} numberOfLines={1}>Save a new address for pickup</Text>
            </View>
            <ChevronRight size={20} color={FLOW.deep} />
          </Pressable>

          {items.length === 0 ? (
            <EmptyState
              icon={<MapPin size={28} color={FLOW.deep} />}
              title="No saved addresses"
              description="Add one to schedule your pickup."
              actionLabel="Add address"
              onAction={() => navigation.navigate('AddressForm', {})}
            />
          ) : (
            items.map((a) => {
              const Icon = iconForLabel(a.label);
              const active = selectedId === a.id;
              const rest = [a.locality, a.city, a.state, a.pincode].filter(Boolean).join(', ');
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setSelectedId(a.id)}
                  className="active:opacity-90"
                  style={{
                    backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 12, overflow: 'hidden',
                    borderWidth: active ? 2 : 1, borderColor: active ? '#5CCBA8' : FLOW.border,
                    ...(active ? { shadowColor: '#0B8A6B', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 } : {}),
                  }}
                >
                  {/* faint location shape, bottom-right (decorative) */}
                  <View pointerEvents="none" style={{ position: 'absolute', right: -18, bottom: -22, width: 110, height: 110, borderRadius: 30, backgroundColor: FLOW.softMint, opacity: active ? 0.9 : 0.5, transform: [{ rotate: '45deg' }] }} />
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ height: 56, width: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: FLOW.mint }}>
                      <Icon size={26} color={FLOW.deep} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: rf(16), fontWeight: '800', color: FLOW.ink, marginRight: 8 }}>{a.label || 'Address'}</Text>
                        {a.isDefault ? (
                          <View style={{ backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                            <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: FLOW.primary, letterSpacing: 0.6 }}>DEFAULT</Text>
                          </View>
                        ) : null}
                      </View>
                      {(a.fullName || a.mobile) ? (
                        <Text style={{ fontSize: rf(13), color: FLOW.muted, marginTop: 5 }}>{a.fullName}{a.mobile ? ` · ${a.mobile}` : ''}</Text>
                      ) : null}
                      {a.addressLine ? (
                        <Text style={{ fontSize: rf(13), color: '#334155', marginTop: 5, lineHeight: rf(19) }}>{a.addressLine}</Text>
                      ) : null}
                      {rest ? (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                          <MapPin size={17} color={FLOW.muted} style={{ marginTop: 1 }} />
                          <Text style={{ flex: 1, fontSize: rf(13), color: '#334155', marginLeft: 8, lineHeight: rf(19) }}>{rest}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ height: 30, width: 30, borderRadius: 15, borderWidth: 3, borderColor: active ? FLOW.deep : '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                      {active ? <View style={{ height: 16, width: 16, borderRadius: 8, backgroundColor: '#0A8A6B' }} /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      <BottomActionBar>
        <FlowCta
          title="Continue to slot selection"
          onPress={() => navigation.navigate('RepairPickupSlot', { ...params, addressId: selectedId })}
          disabled={!selectedId}
        />
      </BottomActionBar>
    </View>
  );
}
