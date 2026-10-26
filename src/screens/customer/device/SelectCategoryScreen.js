import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2, ChevronRight, Search, X,
} from 'lucide-react-native';
import { EmptyState, Loader, ScreenHeader } from '../../../components/rnr';
import { getDeviceCategories, getCategoryMenu, categoryMenuKey } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

// Palette: 09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141.
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const MUTED = '#6B6B6B';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

// Fallback icon + subtitle per category code (same subtitles as the Repair tab).
const CODE_META = {
  MOBILE:        { icon: Smartphone, sub: 'Smartphones' },
  SMARTPHONE:    { icon: Smartphone, sub: 'Smartphones' },
  LAPTOP:        { icon: Laptop,     sub: 'Windows, MacBook' },
  TABLET:        { icon: Tablet,     sub: 'iPad, Android Tablet' },
  SMARTWATCH:    { icon: Watch,      sub: 'Apple, Samsung, Others' },
  SMARTWATCHES:  { icon: Watch,      sub: 'Apple, Samsung, Others' },
  AUDIO:         { icon: Headphones, sub: 'Earbuds, Headphones' },
  AUDIO_DEVICE:  { icon: Headphones, sub: 'Earbuds, Headphones' },
  AUDIO_DEVICES: { icon: Headphones, sub: 'Earbuds, Headphones' },
  SPEAKER:       { icon: Volume2,    sub: 'Speakers' },
};
const DEFAULT_META = { icon: Smartphone, sub: 'Devices' };

// Same order as the Home rails: Mobile, Laptop, Tablet, Smartwatch, Audio.
const ORDER = ['mobile', 'laptop', 'tablet', 'smartwatch', 'audiodevice'];

// Admin "Category Menu" artwork for this flow (repair art for REPAIR, sell art
// for SELL, …). Saved-device (PROFILE) picks keep the plain category image.
const MENU_TYPE = { REPAIR: 'REPAIR', SELL: 'SELL', OWNER_LIST: 'SELL', BUY: 'BUY' };

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function CategoryRow({ c, art, onPress }) {
  const [broken, setBroken] = useState(false);
  const meta = CODE_META[(c.code || '').toUpperCase()] || DEFAULT_META;
  const Icon = meta.icon;
  const uri = !broken ? art : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={c.name}
      className="active:opacity-85"
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8, ...cardShadow }}
    >
      <View style={{ height: 48, width: 48, borderRadius: 24, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 }}>
        {uri ? (
          <Image resizeMethod="resize" source={{ uri }} onError={() => setBroken(true)} style={{ width: 46, height: 46 }} resizeMode="contain" />
        ) : (
          <Icon size={22} color={GREEN_TEXT} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{c.name}</Text>
        <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }} numberOfLines={1}>{meta.sub}</Text>
      </View>
      <View style={{ height: 26, width: 26, borderRadius: 13, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight size={15} color={GREEN_TEXT} />
      </View>
    </Pressable>
  );
}

export default function SelectCategoryScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const [cats, setCats] = useState([]);
  const [menuArt, setMenuArt] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const menuType = MENU_TYPE[flow];
        const [list, menu] = await Promise.all([
          getDeviceCategories(),
          menuType ? getCategoryMenu(menuType).catch(() => []) : Promise.resolve([]),
        ]);
        const rank = (c) => { const i = ORDER.indexOf(categoryMenuKey(c.name || c.code)); return i === -1 ? ORDER.length : i; };
        setCats((list || []).filter((c) => c.isActive !== false).sort((a, b) => rank(a) - rank(b)));
        // Active rows win over inactive ones with the same key.
        const art = {};
        (Array.isArray(menu) ? menu : [])
          .filter((m) => m && m.imageUrl && String(m.imageUrl).trim())
          .sort((a, b) => Number(a.isActive === true) - Number(b.isActive === true))
          .forEach((m) => { art[categoryMenuKey(m.menuName)] = String(m.imageUrl).trim(); });
        setMenuArt(art);
      } catch (_) {}
      setLoading(false);
    })();
  }, [flow]);

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
  const artFor = (c) => menuArt[categoryMenuKey(c.name)] || menuArt[categoryMenuKey(c.code)]
    || c.imageUrl || (c.imageBase64 ? (String(c.imageBase64).startsWith('data:') ? c.imageBase64 : `data:image/png;base64,${c.imageBase64}`) : null);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScreenHeader
        title={headerTitle}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: BRAND.line, borderWidth: 1, borderColor: LINE }}>
          <Search size={17} color={BRAND.green} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search category"
            placeholderTextColor={MUTED}
            returnKeyType="search"
            accessibilityLabel="Search category"
            // Web only: drop the browser focus ring inside the rounded field.
            style={[{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: rf(13.5), color: BRAND.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <X size={16} color={MUTED} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {filtered.length === 0 ? (
          <EmptyState
            accent={BRAND.green}
            accentSoft={MINT}
            title="No categories"
            description={q ? `Nothing matches "${q.trim()}".` : "Master data isn't seeded yet."}
          />
        ) : (
          filtered.map((c) => <CategoryRow key={c.id} c={c} art={artFor(c)} onPress={() => onPick(c)} />)
        )}
      </ScrollView>
    </View>
  );
}
