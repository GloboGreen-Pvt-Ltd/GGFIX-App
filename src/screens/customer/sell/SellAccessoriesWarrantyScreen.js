import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingBag, ShieldCheck, Zap, BatteryCharging, Flashlight, Check } from 'lucide-react-native';
import colors from '../../../theme/colors';
import { Card, PrimaryButton } from '../../../components/ui';
import { rf, rlh } from '../../../utils/responsive';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
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
  editBanner: { backgroundColor: BRAND.yellowSoft, borderColor: BRAND.yellowLine, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  editBannerTitle: { fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.5 },
  editBannerText: { fontSize: rf(12), color: BRAND.ink, fontWeight: '600', marginTop: 2 },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: BRAND.line, borderTopWidth: 1 },
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
  const card = { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6E6E6', padding: 11, marginTop: 8, ...cardShadow };

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <FlowDecor palette={BRAND_FLOW} />
      <FlowHeader title={isLaptopLike ? 'Accessories' : 'Accessories & Warranty'} navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 20 }}>
        {isEditing ? (
          <View style={styles.editBanner}>
            <Ionicons name="create-outline" size={16} color={BRAND.ink} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.editBannerTitle}>EDITING ORDER</Text>
              <Text style={styles.editBannerText}>Your previous accessories and warranty are pre-selected.</Text>
            </View>
          </View>
        ) : null}

        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
            <View style={{ height: 30, width: 30, borderRadius: 10, backgroundColor: BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
              <ShoppingBag size={15} color={BRAND.green} />
            </View>
            <Text style={{ fontSize: rf(14), fontWeight: '800', color: BRAND.ink }}>Accessories</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
            {ACCESSORIES.map((a) => {
              const active = accessories.includes(a.id);
              const AIcon = ACC_ICON[a.id] || ShoppingBag;
              return (
                <View key={a.id} style={{ width: '33.333%', padding: 3 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => toggleAcc(a.id)}
                    style={{
                      minHeight: 86, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: active ? BRAND.greenSoft : BRAND.bg, borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : BRAND.line,
                    }}
                  >
                    {active ? (
                      <View style={{ position: 'absolute', top: 5, right: 5, height: 16, width: 16, borderRadius: 8, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={10} color="#fff" strokeWidth={3} />
                      </View>
                    ) : null}
                    <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: active ? BRAND.green : BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                      <AIcon size={16} color={active ? '#fff' : BRAND.green} />
                    </View>
                    <Text style={{ fontSize: rf(10.5), lineHeight: rlh(13.5), fontWeight: '600', color: BRAND.ink, textAlign: 'center' }}>{a.label}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {!isLaptopLike ? (
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ height: 30, width: 30, borderRadius: 10, backgroundColor: BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                <ShieldCheck size={15} color={BRAND.green} />
              </View>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: BRAND.ink }}>Warranty</Text>
            </View>
            {/* 2 × 2 grid of warranty choices */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
            {WARRANTY.map((w) => {
              const active = warranty === w.id;
              return (
                <View key={w.id} style={{ width: '50%', padding: 3 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setWarranty(w.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', minHeight: 42, paddingHorizontal: 10, borderRadius: 12, marginTop: 3,
                    backgroundColor: active ? BRAND.greenSoft : BRAND.bg, borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : BRAND.line,
                  }}
                >
                  <View style={{ height: 18, width: 18, borderRadius: 9, borderWidth: 2, borderColor: active ? BRAND.green : BRAND.ring, alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <View style={{ height: 9, width: 9, borderRadius: 5, backgroundColor: BRAND.green }} /> : null}
                  </View>
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12), fontWeight: '700', color: BRAND.ink }}>{w.label}</Text>
                </TouchableOpacity>
                </View>
              );
            })}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.bottom, { paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 10) + 6, shadowColor: BRAND.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }]}>
        <FlowCta
          palette={BRAND_FLOW}
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
