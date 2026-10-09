import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Check } from 'lucide-react-native';
import colors from '../../../theme/colors';
import { Card, PrimaryButton, Loader } from '../../../components/ui';
import { getFunctionalIssues } from '../../../api/masterData';
import { rf, rlh } from '../../../utils/responsive';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
import { cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';
import { getFunctionalIssueIcon } from './functionalIssueIcons';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  tile: { width: '31.33%', marginHorizontal: '1%', marginBottom: 6, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', minHeight: 62 },
  tileActive: { borderColor: '#004C40', borderWidth: 2 },
  label: { fontSize: rf(10), lineHeight: rlh(13), color: colors.text, marginTop: 3, textAlign: 'center', fontWeight: '600' },
  editBanner: { backgroundColor: BRAND.yellowSoft, borderColor: BRAND.yellowLine, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  editBannerTitle: { fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.5 },
  editBannerText: { fontSize: rf(12), color: BRAND.ink, fontWeight: '600', marginTop: 2 },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: BRAND.line, borderTopWidth: 1 },
});

const FALLBACK = ['Battery issue','Battery Replaced Local Market','Flash Light Not Working','Front Camera not working','Back Camera not working','Camera Glass Broken','Sim Slot Broken','Network issues','Speaker not working','Mic not working','Touch Id or Face Id not working','Volume Button not working','WiFi or Bluetooth not working','Charging Port not working','Proximity Sensor not working','Power button not working','Ear Speaker not working or low','Vibrator not working'];

export default function SellFunctionalScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  useHideStackHeader(navigation);
  const { width } = useWindowDimensions();
  const { editSellOrderId, editHints } = params;
  const isEditing = !!editSellOrderId;
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  // Indices for quick lookup of previously-saved issues.
  const priorById = useMemo(() => {
    const set = new Set();
    (editHints?.issues || []).forEach((i) => { if (i?.issueId) set.add(i.issueId); });
    return set;
  }, [editHints]);
  const priorByCode = useMemo(() => {
    const set = new Set();
    (editHints?.issues || []).forEach((i) => {
      if (i?.issueCode) set.add(String(i.issueCode).toLowerCase());
    });
    return set;
  }, [editHints]);

  useEffect(() => {
    (async () => {
      try {
        const list = await getFunctionalIssues(params.device?.categoryId);
        const finalList = list.length ? list : FALLBACK.map((n, i) => ({ id: `f${i}`, name: n }));
        setIssues(finalList);

        if (isEditing) {
          const seed = finalList
            .filter((it) =>
              priorById.has(it.id)
              || (it.code && priorByCode.has(String(it.code).toLowerCase()))
              || (it.name && priorByCode.has(String(it.name).toLowerCase())),
            )
            .map((it) => it.id);
          if (seed.length) setSelected(seed);
        }
      } catch (_) {
        setIssues(FALLBACK.map((n, i) => ({ id: `f${i}`, name: n })));
      }
      setLoading(false);
    })();
  }, []);

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  if (loading) return <Loader />;
  // ---- presentation-only values ----
  const cols = width >= 700 ? 5 : 3;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <FlowDecor palette={BRAND_FLOW} />
      <FlowHeader title="Functional" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 20 }}>
        {isEditing ? (
          <View style={styles.editBanner}>
            <Ionicons name="create-outline" size={16} color={BRAND.ink} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.editBannerTitle}>EDITING ORDER</Text>
              <Text style={styles.editBannerText}>Previously reported issues are pre-selected.</Text>
            </View>
          </View>
        ) : null}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6E6E6', paddingTop: 11, paddingHorizontal: 8, paddingBottom: 8, marginTop: 6, ...cardShadow }}>
          <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink, paddingHorizontal: 4, marginBottom: 6 }}>Functionality issues</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {issues.map((it) => {
              const active = selected.includes(it.id);
              const Icon = getFunctionalIssueIcon(it.name);
              return (
                <View key={it.id} style={{ width: `${100 / cols}%`, padding: 3 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => toggle(it.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    style={{
                      minHeight: 88, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: active ? BRAND.greenSoft : BRAND.bg,
                      borderWidth: active ? 2 : 1, borderColor: active ? BRAND.green : BRAND.line,
                      ...(active ? { shadowColor: BRAND.green, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 } : {}),
                    }}
                  >
                    <View style={{ height: 32, width: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 5, backgroundColor: active ? BRAND.green : BRAND.yellowSoft, borderWidth: active ? 3 : 0, borderColor: 'rgba(9,173,42,0.18)' }}>
                      {active ? <Check size={15} color="#fff" strokeWidth={3} /> : <Icon size={15} color={BRAND.yellow} strokeWidth={2.3} />}
                    </View>
                    <Text style={{ fontSize: rf(10.5), lineHeight: rlh(13.5), fontWeight: '600', color: BRAND.ink, textAlign: 'center' }}>{it.name}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 10) + 6, shadowColor: BRAND.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }]}>
        <FlowCta palette={BRAND_FLOW} title="Continue" onPress={() => navigation.navigate('SellDeviceConfig', { ...params, issues: selected.map((id) => ({ issueId: id })) })} />
      </View>
    </View>
  );
}
