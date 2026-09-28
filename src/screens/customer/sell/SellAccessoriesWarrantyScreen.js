import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingBag, ShieldCheck, Zap, BatteryCharging, Flashlight, Check } from 'lucide-react-native';
import colors from '../../../theme/colors';
import { Card, PrimaryButton } from '../../../components/ui';
import { rf, rlh } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  accTile: { width: '31.33%', marginHorizontal: '1%', marginBottom: 6, paddingVertical: 10, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', minHeight: 88 },
  accTileActive: { borderColor: '#004C40', borderWidth: 2, backgroundColor: '#F0FDF4' },
  accLabel: { fontSize: rf(10), lineHeight: rlh(13), color: colors.text, marginTop: 6, textAlign: 'center', fontWeight: '600' },
  warrantyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 8 },
  warrantyRowActive: { borderColor: '#004C40', backgroundColor: '#F0FDF4' },
  warrantyLabel: { marginLeft: 10, fontSize: rf(14), color: colors.text, fontWeight: '600' },
  editBanner: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  editBannerTitle: { fontSize: rf(10), fontWeight: '800', color: '#92400E', letterSpacing: 0.5 },
  editBannerText: { fontSize: rf(12), color: colors.text, fontWeight: '600', marginTop: 2 },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: 1 },
});

const MOBILE_ACCESSORIES = [
  { id: 'original_charger', label: 'Original Charger', icon: 'flash-outline' },
  { id: 'battery_local', label: 'Battery Replaced From Local Market', icon: 'battery-charging-outline' },
  { id: 'flashlight_not_working', label: 'Flash Light Not Working', icon: 'flashlight-outline' },
];
const LAPTOP_ACCESSORIES = [
  { id: 'original_charger', label: 'Original Charger', icon: 'flash-outline' },
];

const WARRANTY = [
  { id: 'lt_3', label: 'Less then 3 months' },
  { id: '3_6', label: '3 - 6 months' },
  { id: '6_11', label: '6 - 11 months' },
  { id: 'gt_11', label: 'More then 11 months' },
];

// Laptop/audio/watch sell flows don't carry a warranty option.
const NO_WARRANTY_KEYWORDS = ['LAPTOP', 'AUDIO', 'WATCH', 'HEADPHONE', 'EARBUD', 'TABLET'];

export default function SellAccessoriesWarrantyScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  useHideStackHeader(navigation);
  const { editSellOrderId, editHints } = params;
  const isEditing = !!editSellOrderId;
  const categoryCode = String(params.device?.categoryCode || '').toUpperCase();
  const isLaptopLike = NO_WARRANTY_KEYWORDS.some((k) => categoryCode.includes(k));
  const ACCESSORIES = isLaptopLike ? LAPTOP_ACCESSORIES : MOBILE_ACCESSORIES;

  // Pre-seed the multi-select accessories from the order's prior accessories.
  // Match on accessoryCode (canonical) or label (fallback when codes drift).
  const initialAccessories = useMemo(() => {
    if (!isEditing) return [];
    const priorCodes = new Set();
    const priorLabels = new Set();
    (editHints?.accessories || []).forEach((a) => {
      if (a?.accessoryCode) priorCodes.add(String(a.accessoryCode).toLowerCase());
      if (a?.label) priorLabels.add(String(a.label).trim().toLowerCase());
    });
    return ACCESSORIES.filter((a) =>
      priorCodes.has(a.id.toLowerCase())
      || priorLabels.has(a.label.trim().toLowerCase()),
    ).map((a) => a.id);
  }, [isEditing, editHints, ACCESSORIES]);

  const initialWarranty = isEditing ? (editHints?.warrantyCode || null) : null;

  const [accessories, setAccessories] = useState(initialAccessories);
  const [warranty, setWarranty] = useState(initialWarranty);

  useEffect(() => {
    if (isLaptopLike) {
      navigation.setOptions?.({ title: 'Accessoires' });
    }
  }, [isLaptopLike, navigation]);

  const toggleAcc = (id) =>
    setAccessories((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // ---- presentation-only values ----
  const ACC_ICON = { original_charger: Zap, battery_local: BatteryCharging, flashlight_not_working: Flashlight };
  const continueDisabled = !isLaptopLike && !warranty;
  const card = { backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,107,87,0.08)', padding: 14, marginTop: 10, ...cardShadow };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FCFA' }}>
      <FlowDecor />
      <FlowHeader title={isLaptopLike ? 'Accessories' : 'Accessories & Warranty'} navigation={navigation} backStyle="white" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
        {isEditing ? (
          <View style={styles.editBanner}>
            <Ionicons name="create-outline" size={16} color="#92400E" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.editBannerTitle}>EDITING ORDER</Text>
              <Text style={styles.editBannerText}>Your previous accessories and warranty are pre-selected.</Text>
            </View>
          </View>
        ) : null}

        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ height: 44, width: 44, borderRadius: 14, backgroundColor: '#DFF8EF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <ShoppingBag size={21} color="#006B57" />
            </View>
            <Text style={{ fontSize: rf(18), fontWeight: '800', color: '#08162B' }}>Accessories</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
            {ACCESSORIES.map((a) => {
              const active = accessories.includes(a.id);
              const AIcon = ACC_ICON[a.id] || ShoppingBag;
              return (
                <View key={a.id} style={{ width: '33.333%', padding: 4 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => toggleAcc(a.id)}
                    style={{
                      minHeight: 122, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: active ? '#F0FBF7' : '#fff', borderWidth: active ? 1.5 : 1, borderColor: active ? '#006B57' : '#DFE9E5',
                    }}
                  >
                    {active ? (
                      <View style={{ position: 'absolute', top: 7, right: 7, height: 20, width: 20, borderRadius: 10, backgroundColor: '#006B57', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </View>
                    ) : null}
                    <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: active ? '#006B57' : '#DFF8EF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <AIcon size={24} color={active ? '#fff' : '#006B57'} />
                    </View>
                    <Text style={{ fontSize: rf(12), lineHeight: rlh(16), fontWeight: '600', color: '#08162B', textAlign: 'center' }}>{a.label}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {!isLaptopLike ? (
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ height: 44, width: 44, borderRadius: 14, backgroundColor: '#DFF8EF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <ShieldCheck size={21} color="#006B57" />
              </View>
              <Text style={{ fontSize: rf(18), fontWeight: '800', color: '#08162B' }}>Warranty</Text>
            </View>
            {WARRANTY.map((w) => {
              const active = warranty === w.id;
              return (
                <TouchableOpacity
                  key={w.id}
                  activeOpacity={0.85}
                  onPress={() => setWarranty(w.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: 16, borderRadius: 18, marginTop: 8,
                    backgroundColor: active ? '#F0FBF7' : '#fff', borderWidth: active ? 1.5 : 1, borderColor: active ? '#006B57' : '#DFE9E5',
                  }}
                >
                  <View style={{ height: 24, width: 24, borderRadius: 12, borderWidth: 2, borderColor: active ? '#006B57' : '#94A3B8', alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <View style={{ height: 12, width: 12, borderRadius: 6, backgroundColor: '#006B57' }} /> : null}
                  </View>
                  <Text style={{ marginLeft: 14, fontSize: rf(15), fontWeight: '700', color: '#08162B' }}>{w.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.bottom, { paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 12) + 8, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }]}>
        <FlowCta
          title="Continue"
          disabled={continueDisabled}
          onPress={() =>
            navigation.navigate('SellImages', {
              ...params,
              accessories: accessories.map((id) => ({ accessoryCode: id, label: ACCESSORIES.find((a) => a.id === id)?.label })),
              warranty: isLaptopLike ? null : warranty,
              warrantyLabel: isLaptopLike ? null : WARRANTY.find((w) => w.id === warranty)?.label,
            })
          }
        />
      </View>
    </View>
  );
}
