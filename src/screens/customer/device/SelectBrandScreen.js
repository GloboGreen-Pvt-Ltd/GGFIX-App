import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Pencil, Search, ArrowLeft, X } from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { getBrandsForCategory } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';

const BRAND_PALETTES = [
  { bg: 'bg-primary/10',   text: 'text-primary' },
  { bg: 'bg-secondary/10', text: 'text-secondary' },
  { bg: 'bg-success/10',   text: 'text-success' },
  { bg: 'bg-warning/10',   text: 'text-warning' },
  { bg: 'bg-danger/10',    text: 'text-danger' },
  { bg: 'bg-info/10',      text: 'text-info' },
];
function paletteFor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BRAND_PALETTES[h % BRAND_PALETTES.length];
}

export default function SelectBrandScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const {
    categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    editSellOrderId, editHints,
  } = route?.params || {};
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const isEditing = !!editSellOrderId;
  const currentBrandId = editHints?.brandId || null;
  const insets = useSafeAreaInsets();

  // Header: title + right-side search icon.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Select Brand',
      headerRight: () => (
        <Pressable onPress={() => setSearchOpen(true)} hitSlop={8} style={{ paddingHorizontal: 6 }}>
          <Search size={22} color="#0F172A" />
        </Pressable>
      ),
    });
  }, [navigation]);

  // Hide the navigator header while searching for a full-screen search bar.
  useEffect(() => {
    navigation.setOptions({ headerShown: !searchOpen });
    return () => navigation.setOptions({ headerShown: true });
  }, [navigation, searchOpen]);

  useEffect(() => {
    (async () => {
      try { setBrands(await getBrandsForCategory(categoryId)); } catch (_) {}
      setLoading(false);
    })();
  }, [categoryId]);

  const gridBrands = useMemo(() => {
    if (isEditing && currentBrandId) {
      const current = brands.find((b) => b.id === currentBrandId);
      const rest = brands.filter((b) => b.id !== currentBrandId);
      return current ? [current, ...rest] : brands;
    }
    return brands;
  }, [brands, isEditing, currentBrandId]);

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((b) => (b.name || '').toLowerCase().includes(needle));
  }, [brands, q]);

  const onPick = (b) => navigation.navigate('SelectModel', {
    flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    brandId: b.id, brandName: b.name,
    editSellOrderId, editHints,
  });

  // ── Full-screen search mode ───────────────────────────────────────────────
  if (searchOpen) {
    return (
      <View className="flex-1 bg-background">
        <View
          className="flex-row items-center px-2 pb-2 bg-card border-b border-border"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable
            onPress={() => { setSearchOpen(false); setQ(''); }}
            className="h-10 w-10 items-center justify-center"
            hitSlop={8}
          >
            <ArrowLeft size={22} color="#0F172A" />
          </Pressable>
          <View className="flex-1 flex-row items-center rounded-xl px-3" style={{ backgroundColor: '#EEF2F6' }}>
            <Search size={18} color="#94A3B8" />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search brand"
              placeholderTextColor="#94A3B8"
              className="flex-1 py-2.5 ml-2 text-text" style={{ fontSize: rf(14) }}
              returnKeyType="search"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <X size={18} color="#64748B" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          {searchResults.length === 0 ? (
            <EmptyState title="No brands found" description={q ? `Nothing matches "${q.trim()}".` : 'Start typing to search.'} />
          ) : (
            searchResults.map((b) => {
              const logo = resolveDeviceImageSource({ url: b.imageUrl, base64: b.imageBase64 });
              const palette = paletteFor(b.name);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => onPick(b)}
                  className="flex-row items-center px-4 py-2.5 border-b border-border active:bg-primary/5"
                >
                  <View className="h-10 w-10 rounded-lg overflow-hidden bg-white border border-border items-center justify-center mr-3">
                    {logo ? (
                      <Image source={{ uri: logo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
                    ) : (
                      <View className={`h-10 w-10 items-center justify-center ${palette.bg}`}>
                        <Text className={` font-extrabold ${palette.text}`} style={{ fontSize: rf(14) }}>{(b.name || '?').slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="flex-1 text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{b.name}</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  if (loading) return <Loader label="Loading brands..." />;

  // ── Normal mode ───────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      {isEditing && editHints?.modelName ? (
        <View className="bg-card border-b border-border px-4 pt-3 pb-3">
          <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 flex-row items-center">
            <Pencil size={13} color="#F59E0B" />
            <View className="flex-1 ml-2">
              <Text className="font-extrabold text-warning tracking-wider" style={{ fontSize: rf(10) }}>EDITING ORDER</Text>
              <Text className="text-text font-semibold" style={{ fontSize: rf(12) }} numberOfLines={1}>
                Currently: {editHints.brandName ? `${editHints.brandName} · ` : ''}{editHints.modelName}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {gridBrands.length === 0 ? (
          <EmptyState title="No brands found" description="No brands mapped to this category yet." />
        ) : (
          <View className="flex-row flex-wrap">
            {gridBrands.map((b) => {
              const palette = paletteFor(b.name);
              const initial = (b.name || '?').slice(0, 1).toUpperCase();
              const logo = resolveDeviceImageSource({ url: b.imageUrl, base64: b.imageBase64 });
              const isCurrent = isEditing && b.id === currentBrandId;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => onPick(b)}
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
                    {/* Contain (not cover) so wide wordmarks show in full. White
                        box keeps transparent PNG logos clean on every device. */}
                    <View className="h-16 w-16 rounded-2xl items-center justify-center overflow-hidden bg-white border border-border">
                      {logo ? (
                        <Image source={{ uri: logo }} style={{ width: 54, height: 54 }} resizeMode="contain" />
                      ) : (
                        <View className={`h-16 w-16 items-center justify-center ${palette.bg}`}>
                          <Text className={` font-extrabold ${palette.text}`} style={{ fontSize: rf(20) }}>{initial}</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      className="font-extrabold text-text text-center mt-2" style={{ fontSize: rf(12) }}
                      numberOfLines={1}
                    >
                      {b.name}
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
