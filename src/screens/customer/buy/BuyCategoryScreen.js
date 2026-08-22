import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Loader } from '../../../components/ui';
import { getBrands } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { backgroundColor: '#fff', margin: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 8 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: colors.text, paddingHorizontal: 12, marginTop: 6 },
  brandRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8 },
  brandTile: { width: 80, padding: 12, marginRight: 8, backgroundColor: '#fff', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  brandText: { fontSize: rf(11), fontWeight: '700', color: colors.text, marginTop: 4 },
  banner: { backgroundColor: '#1E40AF', padding: 10, marginHorizontal: 12, marginTop: 12, borderRadius: 8, alignItems: 'center' },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: rf(13) },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginTop: 8 },
  priceTile: { width: '46%', margin: '2%', padding: 16, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  priceTitle: { fontSize: rf(12), color: colors.textSecondary, fontWeight: '600' },
  priceVal: { fontSize: rf(16), fontWeight: '700', color: colors.text, marginTop: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginTop: 8 },
  catTile: { width: '46%', margin: '2%', padding: 18, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, minHeight: 110 },
  catText: { fontSize: rf(13), fontWeight: '700', color: colors.text, marginTop: 6 },
});

const PRICE_BUCKETS = [
  { label: 'UNDER ₹10,000' },
  { label: 'UNDER ₹20,000' },
  { label: 'UNDER ₹30,000' },
  { label: 'UNDER ₹50,000' },
];
const KINDS = ['Budget Phones', 'Flagship Phones', 'Gaming Phones', 'Best Camera Phones'];

export default function BuyCategoryScreen({ navigation, route }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => { try { setBrands(await getBrands()); } catch (_) {} setLoading(false); })();
  }, []);
  if (loading) return <Loader />;
  return (
    <ScrollView style={styles.container}>
      <View style={styles.search}>
        <Ionicons name="search" color={colors.textSecondary} size={16} />
        <TextInput style={styles.searchInput} placeholder="Search mobile device by brand, model, or series" placeholderTextColor={colors.textSecondary} />
      </View>
      <Text style={styles.sectionTitle}>Favourite Brands</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8 }}>
        {brands.map((b) => (
          <TouchableOpacity key={b.id} style={styles.brandTile} onPress={() => navigation.navigate('BuyListing', { brandId: b.id, title: b.name })}>
            <Text style={styles.brandText}>{b.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.banner}><Text style={styles.bannerText}>Still searching for the perfect phone? Let us help you</Text></View>
      <View style={styles.priceGrid}>
        {PRICE_BUCKETS.map((b) => (
          <TouchableOpacity key={b.label} style={styles.priceTile} onPress={() => navigation.navigate('BuyListing', { title: b.label })}>
            <Text style={styles.priceTitle}>Best-Selling Phones</Text>
            <Text style={styles.priceVal}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.catGrid}>
        {KINDS.map((k) => (
          <TouchableOpacity key={k} style={styles.catTile} onPress={() => navigation.navigate('BuyListing', { title: k })}>
            <Text style={styles.catText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
