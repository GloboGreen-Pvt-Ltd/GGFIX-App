import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Pencil, Search, ArrowLeft, X, ChevronRight, Plus } from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { getBrandsForCategory } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { HeaderIconButton } from '../../../components/PageHeader';
import OtherNameDialog from './OtherNameDialog';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const RED_SOFT = '#FEECEC';
const GAP = 8;
const GREEN_LINE = 'rgba(9,173,42,0.45)';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

// Initial-letter tile for brands without a logo (palette tints).
const BRAND_PALETTES = [
  { bg: MINT,        fg: GREEN_TEXT },
  { bg: YELLOW_SOFT, fg: BRAND.ink },
  { bg: RED_SOFT,    fg: BRAND.red },
  { bg: BRAND.line,  fg: BRAND.ink },
];
function paletteFor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BRAND_PALETTES[h % BRAND_PALETTES.length];
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
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
  const { width } = useWindowDimensions();

  // Compact grid: 4 per row on phones, more on wider screens.
  const cols = width < 340 ? 3 : width < 600 ? 4 : width < 900 ? 6 : 8;
  const tileW = Math.floor((width - 24 - GAP * (cols - 1)) / cols);
  const logoBox = Math.max(40, Math.min(52, Math.round(tileW * 0.52)));

  // Header: title + right-side search icon.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Select Brand',
      headerRight: () => <HeaderIconButton icon={Search} label="Search brands" onPress={() => setSearchOpen(true)} />,
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

  /**
   * "Other" — a device whose brand isn't in the catalogue.
   *
   * Repair booking and Sell. Sell is priced by shop quotations (not the
   * catalogue), so a typed device can still be quoted.
   *
   * Carries brandId: null with the typed brandName. Nothing is written to
   * master data — the name rides along on this booking only.
   */
  const allowOther = flow === 'REPAIR' || flow === 'SELL';
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherName, setOtherName] = useState('');
  const closeOther = () => { setOtherOpen(false); setOtherName(''); };
  const onPickOther = () => {
    const name = otherName.trim();
    if (!name) return;
    setOtherOpen(false);
    setOtherName('');
    setSearchOpen(false);
    setQ('');
    navigation.navigate('SelectModel', {
      ...(route?.params || {}),
      flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
      brandId: null, brandName: name, customBrand: true,
      editSellOrderId, editHints,
    });
  };
  const otherDialog = (
    <OtherNameDialog
      visible={otherOpen}
      title="Other brand"
      description={`Type the brand as it appears on the device. It is saved on this ${flow === 'SELL' ? 'sell order' : 'booking'} only — it is not added to the catalogue.`}
      label="BRAND NAME"
      placeholder="e.g. Lava"
      value={otherName}
      onChangeText={setOtherName}
      onCancel={closeOther}
      onSubmit={onPickOther}
    />
  );

  // ── Full-screen search mode ───────────────────────────────────────────────
  if (searchOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, paddingTop: insets.top + 8,
            backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE,
          }}
        >
          <Pressable
            onPress={() => { setSearchOpen(false); setQ(''); }}
            className="active:opacity-70"
            style={{ height: 40, width: 40, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={8}
            accessibilityLabel="Close search"
          >
            <ArrowLeft size={22} color={BRAND.ink} />
          </Pressable>
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', height: 42, paddingHorizontal: 12,
              borderRadius: 12, backgroundColor: BRAND.line, borderWidth: 1, borderColor: LINE,
            }}
          >
            <Search size={17} color={BRAND.green} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search brand"
              placeholderTextColor={BRAND.muted}
              // Web only: drop the browser focus ring inside the rounded field.
              style={[{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: rf(14), color: BRAND.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
              returnKeyType="search"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search">
                <X size={17} color={BRAND.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
          {searchResults.length === 0 ? (
            <EmptyState
              accent={BRAND.green}
              accentSoft={MINT}
              title="No brands found"
              description={q ? `Nothing matches "${q.trim()}".` : 'Start typing to search.'}
            />
          ) : null}
          {searchResults.length === 0 && allowOther && q.trim() ? (
            <Pressable
              onPress={() => { setOtherName(q.trim()); setOtherOpen(true); }}
              className="active:opacity-80"
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: BRAND.green, backgroundColor: '#FFFFFF' }}
            >
              <Plus size={15} color={GREEN_TEXT} />
              <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '700', color: GREEN_TEXT }} numberOfLines={1}>Use "{q.trim()}" as Other brand</Text>
            </Pressable>
          ) : null}
          {searchResults.length === 0 ? null : (
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: 'hidden', ...cardShadow }}>
              {searchResults.map((b, i) => {
                const logo = resolveDeviceImageSource({ url: b.imageUrl, base64: b.imageBase64 });
                const palette = paletteFor(b.name);
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => onPick(b)}
                    className="active:opacity-80"
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: BRAND.line,
                    }}
                  >
                    <View style={{ height: 36, width: 36, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: logo ? '#FFFFFF' : palette.bg, borderWidth: 1, borderColor: BRAND.line }}>
                      {logo ? (
                        <Image source={{ uri: logo }} style={{ width: 30, height: 30 }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: rf(14), fontWeight: '800', color: palette.fg }}>{(b.name || '?').slice(0, 1).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={{ flex: 1, fontSize: rf(13.5), fontWeight: '600', color: BRAND.ink }} numberOfLines={1}>{b.name}</Text>
                    <ChevronRight size={15} color={BRAND.muted} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
        {otherDialog}
      </View>
    );
  }

  if (loading) return <Loader label="Loading brands..." />;

  // ── Normal mode ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      {isEditing && editHints?.modelName ? (
        <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine }}>
            <Pencil size={13} color={BRAND.yellow} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.8 }}>EDITING ORDER</Text>
              <Text style={{ fontSize: rf(12), fontWeight: '600', color: BRAND.body }} numberOfLines={1}>
                Currently: {editHints.brandName ? `${editHints.brandName} · ` : ''}{editHints.modelName}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {gridBrands.length === 0 && !allowOther ? (
          <EmptyState accent={BRAND.green} accentSoft={MINT} title="No brands found" description="No brands mapped to this category yet." />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: rf(13), fontWeight: '800', color: BRAND.ink }}>
                {categoryName ? `${categoryName} brands` : 'All brands'}
              </Text>
              <Text style={{ fontSize: rf(11), color: BRAND.muted }}>{gridBrands.length}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
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
                    accessibilityRole="button"
                    accessibilityLabel={b.name}
                    style={{
                      width: tileW, alignItems: 'center', paddingTop: 8, paddingBottom: 7, paddingHorizontal: 4,
                      borderRadius: 14, backgroundColor: isCurrent ? MINT : '#FFFFFF',
                      borderWidth: isCurrent ? 1.5 : 1, borderColor: isCurrent ? BRAND.green : LINE,
                      ...cardShadow,
                    }}
                  >
                    {/* Contain (not cover) so wide wordmarks show in full. White
                        box keeps transparent PNG logos clean on every device. */}
                    <View
                      style={{
                        height: logoBox, width: logoBox, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        backgroundColor: logo ? '#FFFFFF' : palette.bg, borderWidth: 1, borderColor: BRAND.line,
                      }}
                    >
                      {logo ? (
                        <Image source={{ uri: logo }} style={{ width: logoBox - 8, height: logoBox - 8 }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: rf(17), fontWeight: '800', color: palette.fg }}>{initial}</Text>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      style={{ marginTop: 5, fontSize: rf(11), fontWeight: '700', color: BRAND.ink, textAlign: 'center', alignSelf: 'stretch' }}
                    >
                      {b.name}
                    </Text>
                    {isCurrent ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <CheckCircle2 size={10} color={GREEN_TEXT} />
                        <Text style={{ marginLeft: 3, fontSize: rf(9), fontWeight: '700', color: GREEN_TEXT }}>Current</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}

              {allowOther ? (
                <Pressable
                  onPress={() => setOtherOpen(true)}
                  className="active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel="Other brand"
                  style={{
                    width: tileW, alignItems: 'center', paddingTop: 8, paddingBottom: 7, paddingHorizontal: 4,
                    borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderStyle: 'dashed', borderColor: GREEN_LINE,
                  }}
                >
                  <View style={{ height: logoBox, width: logoBox, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: MINT }}>
                    <Plus size={Math.round(logoBox * 0.42)} color={GREEN_TEXT} />
                  </View>
                  <Text numberOfLines={1} style={{ marginTop: 5, fontSize: rf(11), fontWeight: '800', color: GREEN_TEXT, textAlign: 'center', alignSelf: 'stretch' }}>
                    Other
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
      {otherDialog}
    </View>
  );
}
