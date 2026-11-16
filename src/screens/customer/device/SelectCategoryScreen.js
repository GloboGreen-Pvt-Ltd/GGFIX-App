import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2, Search, X,
} from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { getDeviceCategories, getCategoryMenu, categoryMenuKey } from '../../../api/masterData';
import { DP, DP_COLUMN, DevicePickerHeader, DPSection, DPGridTile, DPNextBar, gridTileW } from './DevicePickerChrome';

// Fallback icon per category code when the API has no artwork.
const CODE_ICON = {
  MOBILE: Smartphone,
  SMARTPHONE: Smartphone,
  LAPTOP: Laptop,
  TABLET: Tablet,
  SMARTWATCH: Watch,
  SMARTWATCHES: Watch,
  AUDIO: Headphones,
  AUDIO_DEVICE: Headphones,
  AUDIO_DEVICES: Headphones,
  SPEAKER: Volume2,
};

// Same order as the Home rails: Mobile, Laptop, Tablet, Smartwatch, Audio.
const ORDER = ['mobile', 'laptop', 'tablet', 'smartwatch', 'audiodevice'];

// Admin "Category Menu" artwork for this flow (repair art for REPAIR, sell art
// for SELL, …). Saved-device (PROFILE) picks keep the plain category image.
const MENU_TYPE = { REPAIR: 'REPAIR', SELL: 'SELL', OWNER_LIST: 'SELL', BUY: 'BUY' };

// Search only earns its space once the catalogue outgrows two grid rows.
const SEARCH_MIN = 8;

// Partner-style search field (48 high, soft grey, radius 12).
function SearchField({ value, onChangeText, placeholder }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 12 }}>
      <Search size={18} color={DP.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        cursorColor={DP.teal}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        // Web only: drop the browser focus ring inside the rounded field.
        style={[{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: 14, color: DP.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={16} color={DP.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Fallback icon for a category code (no artwork / failed image).
export const categoryFallbackIcon = (code) => CODE_ICON[(code || '').toUpperCase()] || Smartphone;

// Active categories in Home-rail order, plus this flow's admin "Category Menu"
// artwork (falls back to the category's own image). `enabled` false skips the
// fetch — the repair brand step only loads them when it picks the category.
export function useDeviceCategories(flow, enabled = true) {
  const [cats, setCats] = useState([]);
  const [menuArt, setMenuArt] = useState({});
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const menuType = MENU_TYPE[flow];
        const [list, menu] = await Promise.all([
          getDeviceCategories(),
          menuType ? getCategoryMenu(menuType).catch(() => []) : Promise.resolve([]),
        ]);
        const rank = (c) => { const i = ORDER.indexOf(categoryMenuKey(c.name || c.code)); return i === -1 ? ORDER.length : i; };
        // Active rows win over inactive ones with the same key.
        const art = {};
        (Array.isArray(menu) ? menu : [])
          .filter((m) => m && m.imageUrl && String(m.imageUrl).trim())
          .sort((a, b) => Number(a.isActive === true) - Number(b.isActive === true))
          .forEach((m) => { art[categoryMenuKey(m.menuName)] = String(m.imageUrl).trim(); });
        if (!alive) return;
        setCats((list || []).filter((c) => c.isActive !== false).sort((a, b) => rank(a) - rank(b)));
        setMenuArt(art);
      } catch (_) {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [flow, enabled]);

  const artFor = useCallback((c) => menuArt[categoryMenuKey(c.name)] || menuArt[categoryMenuKey(c.code)]
    || c.imageUrl || (c.imageBase64 ? (String(c.imageBase64).startsWith('data:') ? c.imageBase64 : `data:image/png;base64,${c.imageBase64}`) : null), [menuArt]);

  return { cats, loading, artFor };
}

export default function SelectCategoryScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const { cats, loading, artFor } = useDeviceCategories(flow);
  const [q, setQ] = useState('');
  const { width } = useWindowDimensions();

  // 4 per row on phones, 6 on tablets (content capped at 720).
  const cols = width >= 600 ? 6 : 4;
  const tileW = gridTileW(Math.min(width, 720), cols);
  const imgSize = width >= 600 ? 48 : 44;

  const filtered = useMemo(() => {
    if (!q.trim()) return cats;
    const needle = q.toLowerCase();
    return cats.filter((c) => (c.name || '').toLowerCase().includes(needle));
  }, [cats, q]);

  // Tap auto-advances straight to the brand step. Forward `editSellOrderId`
  // (set when entering the wizard from "Edit sell order") so SellComplete can
  // PUT instead of POST at the end of the flow. `categoryImage` lets the next
  // steps show the picked category as a card.
  // Repair: a category chosen earlier (Home tile) shows as selected and Next
  // continues with it; tapping any tile still moves straight on.
  const presetId = String(route?.params?.categoryId || '');
  const presetCode = String(route?.params?.categoryCode || '').toUpperCase();
  const preset = presetId || presetCode
    ? cats.find((c) => c.id === presetId
      || (presetCode && (c.code || '').toUpperCase() === presetCode)
      || (presetId && (c.code || '').toUpperCase() === presetId.toUpperCase()))
    : null;

  const onPick = (c, art) => navigation.navigate('SelectBrand', {
    flow,
    categoryId: c.id,
    categoryCode: (c.code || '').toUpperCase(),
    categoryName: c.name,
    categoryImage: art || null,
    editSellOrderId: route?.params?.editSellOrderId,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DevicePickerHeader navigation={navigation} title={flow === 'OWNER_LIST' ? 'Sell' : undefined} />
      {loading ? (
        <Loader label="Loading categories..." className="bg-white" />
      ) : (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={[DP_COLUMN, { paddingHorizontal: 16 }]}>
            <DPSection title="Category" />
            {cats.length > SEARCH_MIN ? <SearchField value={q} onChangeText={setQ} placeholder="Search category" /> : null}
            {filtered.length === 0 ? (
              <EmptyState
                accent={DP.teal}
                accentSoft={DP.mint}
                title="No categories"
                description={q ? `Nothing matches "${q.trim()}".` : "Master data isn't seeded yet."}
              />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {filtered.map((c) => {
                  const art = artFor(c);
                  return (
                    <DPGridTile
                      key={c.id}
                      width={tileW}
                      image={art}
                      icon={categoryFallbackIcon(c.code)}
                      label={c.name}
                      imageSize={imgSize}
                      minHeight={96}
                      selected={preset?.id === c.id}
                      onPress={() => onPick(c, art)}
                    />
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
