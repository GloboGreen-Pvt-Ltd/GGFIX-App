import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Smartphone, Hand, TabletSmartphone, Frame, BatteryMedium, Camera, Plug, ClipboardCheck, Check } from 'lucide-react-native';
import colors from '../../../theme/colors';
import { Card, PrimaryButton, Loader } from '../../../components/ui';
import { getConditionGroups, getConditionOptions } from '../../../api/masterData';
import { rf, rlh } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  groupTitle: { fontSize: rf(13), fontWeight: '700', color: colors.text, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  optTile: { width: '31.33%', marginHorizontal: '1%', marginBottom: 6, paddingVertical: 7, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', minHeight: 44 },
  optTileActive: { borderColor: '#004C40', borderWidth: 2 },
  optLabel: { fontSize: rf(10), lineHeight: rlh(13), color: colors.text, textAlign: 'center', fontWeight: '600' },
  editBanner: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  editBannerTitle: { fontSize: rf(10), fontWeight: '800', color: '#92400E', letterSpacing: 0.5 },
  editBannerText: { fontSize: rf(12), color: colors.text, fontWeight: '600', marginTop: 2 },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: 1 },
});

const FALLBACK_GROUPS = [
  { id: 'SCREEN_VISIBLE', code: 'SCREEN_VISIBLE', name: 'Screen Condition on your Device', options: ['No Damage', 'Minor Spot or patches', 'Major Spot or patches', 'Major Spot or patches', 'Discoloration'] },
  { id: 'TOUCH_GLASS', code: 'TOUCH_GLASS', name: 'Touch Glass Condition on your device', options: ['No Damage', '1 or 2 Minor Scratches', 'Heavy Scratches', 'TouchGlass Broken'] },
  { id: 'BACK_PANEL', code: 'BACK_PANEL', name: 'Back Panel Condition on your Device', options: ['No Damage', '1 or 2 Minor Scratches', 'Heavy Scratches or deep scratches', 'Light Cover Marks on Body', 'Heavy Cover Marks on Body', 'Back Panel Broken'] },
  { id: 'SIDE_PANEL', code: 'SIDE_PANEL', name: 'side and Center Panel Condition on your device', options: ['No defects', 'Minor dent or scratches', 'Major dent or heavy scratches', 'Center panel broken or cracked or bend'] },
];

// Display order: Screen → Touch Glass → Back Panel → Side & Center → (others)
const orderRank = (g) => {
  const n = (g.name || g.code || '').toLowerCase();
  if (n.includes('screen')) return 1;
  if (n.includes('touch')) return 2;
  if (n.includes('back')) return 3;
  if (n.includes('side') || n.includes('center')) return 4;
  return 99;
};
const sortGroups = (arr) => [...arr].sort((a, b) => orderRank(a) - orderRank(b));

export default function SellScreenConditionScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  useHideStackHeader(navigation);
  const { editSellOrderId, editHints } = params;
  const isEditing = !!editSellOrderId;
  const [groups, setGroups] = useState([]);
  const [optsByGroup, setOptsByGroup] = useState({});
  const [selected, setSelected] = useState({}); // groupId -> {id, label}
  const [loading, setLoading] = useState(true);

  // Index previously-saved options by groupCode (canonical) and groupName
  // (best-effort) so we can resolve them against whichever groups come back.
  const priorByGroupCode = useMemo(() => {
    const m = {};
    (editHints?.conditions || []).forEach((c) => {
      if (c?.groupCode) m[c.groupCode.toUpperCase()] = c;
    });
    return m;
  }, [editHints]);
  const priorByGroupName = useMemo(() => {
    const m = {};
    (editHints?.conditions || []).forEach((c) => {
      if (c?.groupName) m[c.groupName.trim().toLowerCase()] = c;
    });
    return m;
  }, [editHints]);

  useEffect(() => {
    (async () => {
      try {
        const list = await getConditionGroups(params.device?.categoryId);
        const sortedGroups = list.length === 0
          ? sortGroups(FALLBACK_GROUPS)
          : sortGroups(list);
        setGroups(sortedGroups);

        const map = {};
        if (list.length !== 0) {
          for (const g of sortedGroups) {
            map[g.id] = await getConditionOptions(g.id).catch(() => []);
          }
          setOptsByGroup(map);
        }

        // Seed previously-saved selections.
        if (isEditing) {
          const seed = {};
          for (const g of sortedGroups) {
            const prior = priorByGroupCode[(g.code || '').toUpperCase()]
              || priorByGroupName[(g.name || '').trim().toLowerCase()];
            if (!prior) continue;
            // Match by optionId when both sides have UUIDs.
            const opts = (map[g.id]?.length ? map[g.id] : (g.options || []).map((o, i) => ({ id: `${g.id}-${i}`, label: o })));
            const byId = prior.optionId ? opts.find((o) => o.id === prior.optionId) : null;
            const byLabel = prior.optionLabel
              ? opts.find((o) => (o.label || '').trim().toLowerCase() === prior.optionLabel.trim().toLowerCase())
              : null;
            const opt = byId || byLabel;
            if (opt) {
              seed[g.id] = { id: opt.id, label: opt.label, groupCode: g.code, groupName: g.name };
            }
          }
          if (Object.keys(seed).length) setSelected(seed);
        }
      } catch (_) {
        setGroups(sortGroups(FALLBACK_GROUPS));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader />;

  // ---- presentation-only values ----
  const groupIcon = (g) => {
    const n = `${g.name || ''} ${g.code || ''}`.toLowerCase();
    if (n.includes('touch')) return Hand;
    if (n.includes('screen') || n.includes('display')) return Smartphone;
    if (n.includes('back') || n.includes('body')) return TabletSmartphone;
    if (n.includes('side') || n.includes('center') || n.includes('frame')) return Frame;
    if (n.includes('battery') || n.includes('power')) return BatteryMedium;
    if (n.includes('camera')) return Camera;
    if (n.includes('charg') || n.includes('connect')) return Plug;
    return ClipboardCheck;
  };
  // Column count per group from its longest option label, so short options
  // sit side by side and long ones get a full-width row (never truncated).
  const colsFor = (opts) => {
    const longest = opts.reduce((m, o) => Math.max(m, String(o.label || '').length), 0);
    if (opts.length <= 1) return 1;
    if (longest <= 14 || (opts.length === 3 && longest <= 20)) return 3;
    if (longest <= 24) return 2;
    return 1;
  };
  const continueDisabled = groups.some((g) => !selected[g.id]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FCFA' }}>
      <FlowDecor />
      <FlowHeader title="Screen" navigation={navigation} backStyle="white" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 }}>
        {isEditing ? (
          <View style={styles.editBanner}>
            <Ionicons name="create-outline" size={16} color="#92400E" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.editBannerTitle}>EDITING ORDER</Text>
              <Text style={styles.editBannerText}>Your previous condition picks are pre-selected.</Text>
            </View>
          </View>
        ) : null}
        {groups.map((g) => {
          const opts = (optsByGroup[g.id]?.length ? optsByGroup[g.id] : (g.options || []).map((o, i) => ({ id: `${g.id}-${i}`, label: o })));
          const GIcon = groupIcon(g);
          const cols = colsFor(opts);
          return (
            <View key={g.id} style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,107,87,0.08)', padding: 12, marginTop: 10, ...cardShadow }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ height: 44, width: 44, borderRadius: 14, backgroundColor: '#DFF8EF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <GIcon size={21} color="#006B57" />
                </View>
                <Text style={{ flex: 1, fontSize: rf(17), fontWeight: '800', color: '#08162B' }}>{g.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                {opts.map((o) => {
                  const active = selected[g.id]?.id === o.id;
                  return (
                    <View key={o.id} style={{ width: `${100 / cols}%`, padding: 4 }}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setSelected({ ...selected, [g.id]: { id: o.id, label: o.label, groupCode: g.code, groupName: g.name } })}
                        style={{
                          flexDirection: 'row', alignItems: 'center', minHeight: 50, borderRadius: 16,
                          paddingVertical: 10, paddingHorizontal: cols === 3 ? 8 : 12,
                          backgroundColor: active ? '#F0FBF7' : '#fff',
                          borderWidth: active ? 1.5 : 1, borderColor: active ? '#006B57' : '#DFE9E5',
                        }}
                      >
                        {active ? (
                          <View style={{ height: 22, width: 22, borderRadius: 11, backgroundColor: '#006B57', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={13} color="#fff" strokeWidth={3} />
                          </View>
                        ) : (
                          <View style={{ height: 22, width: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B6C3CE' }} />
                        )}
                        <Text style={{ flex: 1, marginLeft: cols === 3 ? 7 : 10, fontSize: rf(cols === 3 ? 12 : 13), lineHeight: rlh(cols === 3 ? 15 : 17), fontWeight: active ? '700' : '600', color: active ? '#08162B' : '#334155' }}>
                          {o.label}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.bottom, { paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 12) + 8, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }]}>
        <FlowCta title="Continue" disabled={continueDisabled} onPress={() => navigation.navigate('SellFunctional', { ...params, conditions: Object.values(selected).map((s) => ({ groupCode: s.groupCode, optionId: s.id, optionLabel: s.label, groupName: s.groupName })) })} />
      </View>
    </View>
  );
}
