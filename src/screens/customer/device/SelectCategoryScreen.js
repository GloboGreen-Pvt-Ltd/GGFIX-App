import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2, ChevronRight,
} from 'lucide-react-native';
import { EmptyState, Loader, ScreenHeader, SearchBar } from '../../../components/rnr';
import { getDeviceCategories } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const CODE_META = {
  MOBILE:        { icon: Smartphone, color: '#00008B', bg: 'bg-primary/10', sub: 'Smartphones' },
  SMARTPHONE:    { icon: Smartphone, color: '#00008B', bg: 'bg-primary/10', sub: 'Smartphones' },
  LAPTOP:        { icon: Laptop,     color: '#7C3AED', bg: 'bg-primary/10', sub: 'Laptops & Notebooks' },
  TABLET:        { icon: Tablet,     color: '#0369A1', bg: 'bg-info/10',    sub: 'Tablets' },
  SMARTWATCH:    { icon: Watch,      color: '#B45309', bg: 'bg-warning/10', sub: 'Smart Watches' },
  SMARTWATCHES:  { icon: Watch,      color: '#B45309', bg: 'bg-warning/10', sub: 'Smart Watches' },
  AUDIO:         { icon: Headphones, color: '#BE185D', bg: 'bg-danger/10',  sub: 'Headphones, Earbuds & Speakers' },
  AUDIO_DEVICES: { icon: Headphones, color: '#BE185D', bg: 'bg-danger/10',  sub: 'Headphones, Earbuds & Speakers' },
  SPEAKER:       { icon: Volume2,    color: '#0E9384', bg: 'bg-success/10', sub: 'Speakers' },
};
const DEFAULT_META = { icon: Smartphone, color: '#00008B', bg: 'bg-primary/10', sub: 'Devices' };

export default function SelectCategoryScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await getDeviceCategories();
        setCats((list || []).filter((c) => c.isActive !== false));
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return cats;
    const needle = q.toLowerCase();
    return cats.filter((c) => (c.name || '').toLowerCase().includes(needle));
  }, [cats, q]);

  // Tap auto-advances straight to the brand step. Forward `editSellOrderId`
  // (set when entering the wizard from "Edit sell order") so SellComplete can
  // PUT instead of POST at the end of the flow.
  const onPick = (c) => navigation.navigate('SelectBrand', {
    flow,
    categoryId: c.id,
    categoryCode: (c.code || '').toUpperCase(),
    categoryName: c.name,
    editSellOrderId: route?.params?.editSellOrderId,
  });

  if (loading) return <Loader label="Loading categories..." />;

  const headerTitle = flow === 'OWNER_LIST' ? 'Sell' : 'Select Category';

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={headerTitle}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <View className="bg-card border-b border-border px-4 pt-3 pb-3">
        <SearchBar value={q} onChangeText={setQ} placeholder="Search category" onClear={() => setQ('')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {filtered.length === 0 ? (
          <EmptyState title="No categories" description="Master data isn't seeded yet." />
        ) : (
          filtered.map((c) => {
            const code = (c.code || '').toUpperCase();
            const meta = CODE_META[code] || DEFAULT_META;
            const Icon = meta.icon;
            const uri = c.imageUrl || c.imageBase64;
            return (
              <Pressable
                key={c.id}
                onPress={() => onPick(c)}
                className="flex-row items-center bg-card border border-border rounded-2xl p-3.5 mb-3 active:opacity-80"
                style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
              >
                <View className={`h-12 w-12 rounded-2xl items-center justify-center mr-3 overflow-hidden ${meta.bg}`}>
                  {uri ? (
                    <Image source={{ uri }} style={{ width: 48, height: 48 }} resizeMode="cover" />
                  ) : (
                    <Icon size={24} color={meta.color} strokeWidth={2} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="font-extrabold text-text" style={{ fontSize: rf(15) }}>{c.name}</Text>
                  <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(12) }}>{meta.sub}</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
