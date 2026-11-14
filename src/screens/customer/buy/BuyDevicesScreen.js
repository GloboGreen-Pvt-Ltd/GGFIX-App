import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDeviceCategories } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

/**
 * Buy Devices — search + category grid (Mobiles, Laptops, Tablets, Smartwatch…
 * from the admin categories, then Accessories and Spare Parts). Each tile opens
 * the listing results.
 */
const GREEN = '#01AC77';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';

const iconFor = (name) => {
  const n = String(name || '').toLowerCase();
  if (/laptop|notebook/.test(n)) return 'laptop-outline';
  if (/tab/.test(n)) return 'tablet-portrait-outline';
  if (/watch/.test(n)) return 'watch-outline';
  if (/audio|ear|head|speaker/.test(n)) return 'headset-outline';
  if (/accessor/.test(n)) return 'headset-outline';
  if (/spare|part/.test(n)) return 'construct-outline';
  return 'phone-portrait-outline';
};

export default function BuyDevicesScreen({ navigation }) {
  const [cats, setCats] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    getDeviceCategories()
      .then((rows) => setCats((rows || []).filter((c) => c && c.isActive !== false)))
      .catch(() => setCats([]));
  }, []);

  const tiles = [
    ...(cats || []).map((c) => ({ key: c.id, label: c.name, params: { categoryId: c.id, categoryCode: c.code, categoryName: c.name, title: c.name } })),
    { key: 'acc', label: 'Accessories', params: { q: 'accessory', title: 'Accessories' } },
    { key: 'spare', label: 'Spare Parts', params: { q: 'spare', title: 'Spare Parts' } },
  ];
  const search = () => { const t = q.trim(); if (t) navigation.navigate('BuyListing', { q: t, title: t, layout: 'list' }); };

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={search} returnKeyType="search" placeholder="Search devices, brands, shops..."
          placeholderTextColor={MUTED} style={{ flex: 1, marginLeft: 8, fontSize: rf(13), color: INK, padding: 0 }} />
      </View>
      {cats === null ? <ActivityIndicator color={GREEN} style={{ marginTop: 30 }} /> : (
        <View style={styles.grid}>
          {tiles.map((t) => (
            <Pressable key={t.key} onPress={() => navigation.navigate('BuyListing', t.params)} accessibilityRole="button" accessibilityLabel={t.label} style={styles.tile}>
              <Ionicons name={iconFor(t.label)} size={30} color={INK} />
              <Text numberOfLines={1} style={styles.label}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  search: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 12, borderWidth: 1, borderColor: LINE, paddingHorizontal: 12, backgroundColor: '#F6F7F9' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16, rowGap: 12 },
  tile: { width: '48.5%', height: 96, borderRadius: 16, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: rf(13), fontWeight: '700', color: INK, marginTop: 8 },
});
