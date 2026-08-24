import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Layers, CheckCircle2, Pencil } from 'lucide-react-native';
import { EmptyState, Loader, SearchBar, SelectionCrumb } from '../../../components/rnr';
import { getSeriesForCategoryBrand } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

export default function SelectSeriesScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const {
    categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName, brandId, brandName,
    editSellOrderId, editHints,
  } = route?.params || {};
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const isEditing = !!editSellOrderId;
  const currentSeriesId = editHints?.seriesId || null;

  const base = {
    flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    brandId, brandName, editSellOrderId, editHints,
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Authoritative: only series under THIS (category, brand) pair. No
        // brand-wide fallback — that would leak another category's series
        // (e.g. Laptop+Samsung showing Samsung's Mobile Galaxy series).
        const list = await getSeriesForCategoryBrand(categoryId, brandId);
        if (cancelled) return;
        // No series under this (category, brand) -> skip straight to models.
        if (!list || list.length === 0) { navigation.replace('SelectModel', { ...base }); return; }
        setSeries(list);
      } catch (_) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoryId, brandId]);

  const filtered = useMemo(() => {
    let list = series;
    if (isEditing && currentSeriesId) {
      const current = series.find((s) => s.id === currentSeriesId);
      const rest = series.filter((s) => s.id !== currentSeriesId);
      list = current ? [current, ...rest] : series;
    }
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((s) => (s.name || '').toLowerCase().includes(needle));
  }, [series, q, isEditing, currentSeriesId]);

  const onPick = (s) => navigation.navigate('SelectModel', {
    ...base, seriesId: s.id, seriesName: s.name,
  });

  if (loading) return <Loader label="Loading series..." />;

  return (
    <View className="flex-1 bg-background">
      <View className="bg-card border-b border-border px-4 pt-3 pb-3">
        <SelectionCrumb items={[{ label: 'Brand', value: brandName }]} className="mb-3" />
        {isEditing && editHints?.modelName ? (
          <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 mb-3 flex-row items-center">
            <Pencil size={13} color="#F59E0B" />
            <View className="flex-1 ml-2">
              <Text className="font-extrabold text-warning tracking-wider" style={{ fontSize: rf(10) }}>EDITING ORDER</Text>
              <Text className="text-text font-semibold" style={{ fontSize: rf(12) }} numberOfLines={1}>
                Currently: {editHints.brandName ? `${editHints.brandName} · ` : ''}{editHints.modelName}
              </Text>
            </View>
          </View>
        ) : null}
        <SearchBar value={q} onChangeText={setQ} placeholder="Search series" onClear={() => setQ('')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {filtered.length === 0 ? (
          <EmptyState title="No series found" description="Try a different keyword." />
        ) : (
          // 3-column grid — matches SelectBrand / Home rhythm. No chevron.
          <View className="flex-row flex-wrap">
            {filtered.map((s) => {
              const thumb = s.imageUrl || s.imageBase64;
              const isCurrent = isEditing && s.id === currentSeriesId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onPick(s)}
                  className="active:opacity-80"
                  style={{ width: '33.333%', padding: 6 }}
                >
                  <View
                    className={`items-center rounded-2xl bg-card ${isCurrent ? 'border-success' : 'border-border'}`}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 8,
                      borderWidth: isCurrent ? 2 : 1,
                      shadowColor: isCurrent ? '#004C40' : '#0F172A',
                      shadowOpacity: isCurrent ? 0.10 : 0.04,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 1,
                    }}
                  >
                    <View className="h-14 w-14 rounded-2xl bg-primary/10 items-center justify-center overflow-hidden">
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                      ) : (
                        <Layers size={24} color="#00008B" />
                      )}
                    </View>
                    <Text
                      className="font-extrabold text-text text-center mt-2" style={{ fontSize: rf(12) }}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                    {isCurrent ? (
                      <View className="flex-row items-center mt-1">
                        <CheckCircle2 size={10} color="#004C40" />
                        <Text className="font-bold text-success ml-1" style={{ fontSize: rf(9) }}>Current</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
