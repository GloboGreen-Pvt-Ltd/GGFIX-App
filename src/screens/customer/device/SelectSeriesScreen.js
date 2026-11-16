import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Pencil, Search, X } from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { getSeriesForCategoryBrand } from '../../../api/masterData';
import { useHideStackHeader } from '../service-booking-customer/FlowChrome';
import { DP, DP_COLUMN, DevicePickerHeader, DPSection, PickedCard, DPNextBar, gridTileW, goToPicker } from './DevicePickerChrome';

// Series tile — same as the Partner model step's series filter (text only,
// teal border + mint fill when selected).
// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function SeriesTile({ width, label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      className="active:opacity-80"
      style={{
        width, minHeight: 46, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: selected ? DP.mint : '#FFFFFF', borderWidth: selected ? 1.5 : 1, borderColor: selected ? DP.teal : DP.line,
      }}
    >
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ fontSize: 13, lineHeight: 16, fontWeight: selected ? '800' : '600', color: selected ? DP.teal : DP.ink, textAlign: 'center' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SelectSeriesScreen({ navigation, route }) {
  useHideStackHeader(navigation);
  const flow = route?.params?.flow || 'PROFILE';
  const {
    categoryId, categoryCode, categoryName, categoryImage, deviceTypeId, deviceTypeName, brandId, brandName, brandImage,
    editSellOrderId, editHints,
  } = route?.params || {};
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const isEditing = !!editSellOrderId;
  const currentSeriesId = editHints?.seriesId || null;
  const { width } = useWindowDimensions();

  // 4 per row on phones, 6 on tablets (content capped at 720).
  const cols = width >= 600 ? 6 : 4;
  const tileW = gridTileW(Math.min(width, 720), cols);

  const base = {
    flow, categoryId, categoryCode, categoryName, categoryImage, deviceTypeId, deviceTypeName,
    brandId, brandName, brandImage, editSellOrderId, editHints,
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

  const currentSeries = isEditing && currentSeriesId ? series.find((s) => s.id === currentSeriesId) : null;

  const onPick = (s) => navigation.navigate('SelectModel', {
    ...base, seriesId: s.id, seriesName: s.name,
  });

  // "Change" → back to that picker (later steps are popped).
  const changeCategory = () => goToPicker(navigation, 'SelectCategory', { flow, editSellOrderId });
  const changeBrand = () => goToPicker(navigation, 'SelectBrand', {
    flow, categoryId, categoryCode, categoryName, categoryImage, deviceTypeId, deviceTypeName, editSellOrderId, editHints,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DevicePickerHeader navigation={navigation} title={flow === 'OWNER_LIST' ? 'Sell' : undefined} />
      {loading ? (
        <Loader label="Loading series..." className="bg-white" />
      ) : (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={[DP_COLUMN, { paddingHorizontal: 16 }]}>
            {isEditing && editHints?.modelName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFF4D6', borderWidth: 1, borderColor: 'rgba(250,167,0,0.3)' }}>
                <Pencil size={13} color="#FAA700" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: DP.ink, letterSpacing: 0.8 }}>EDITING ORDER</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: DP.ink }} numberOfLines={1}>
                    Currently: {editHints.brandName ? `${editHints.brandName} · ` : ''}{editHints.modelName}
                  </Text>
                </View>
              </View>
            ) : null}

            <DPSection title="Category" />
            <PickedCard image={categoryImage} title={categoryName || 'Category'} onChange={changeCategory} />

            <DPSection title="Brand" />
            <PickedCard image={brandImage} title={brandName || 'Brand'} onChange={changeBrand} />

            <DPSection title="Series" />
            {/* Partner-style search field (48 high, soft grey, radius 12). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 12 }}>
              <Search size={18} color={DP.muted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search series"
                placeholderTextColor="#9CA3AF"
                cursorColor={DP.teal}
                returnKeyType="search"
                accessibilityLabel="Search series"
                // Web only: drop the browser focus ring inside the rounded field.
                style={[{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: 14, color: DP.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
              />
              {q ? (
                <Pressable onPress={() => setQ('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
                  <X size={16} color={DP.muted} />
                </Pressable>
              ) : null}
            </View>

            {filtered.length === 0 ? (
              <EmptyState accent={DP.teal} accentSoft={DP.mint} title="No series found" description="Try a different keyword." />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {filtered.map((s) => (
                  <SeriesTile
                    key={s.id}
                    width={tileW}
                    label={s.name}
                    selected={isEditing && s.id === currentSeriesId}
                    onPress={() => onPick(s)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
