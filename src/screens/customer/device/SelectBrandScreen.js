import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Pencil, Search, X, Plus } from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import { getBrandsForCategory } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';
import { BRAND } from '../../../theme/brand';
import { useHideStackHeader } from '../service-booking-customer/FlowChrome';
import OtherNameDialog from './OtherNameDialog';
import { DP, DP_COLUMN, DevicePickerHeader, DPSection, DPGridTile, PickedCard, PickerImage, DPNextBar, gridTileW, goToPicker } from './DevicePickerChrome';
import { useDeviceCategories, categoryFallbackIcon } from './SelectCategoryScreen';

const YELLOW_SOFT = '#FFF4D6';
const RED_SOFT = '#FEEBEA';
const LOGO_H = 44;

// Initial-letter tile for brands without a logo (palette tints).
const BRAND_PALETTES = [
  { bg: DP.mint,     fg: DP.teal },
  { bg: YELLOW_SOFT, fg: BRAND.ink },
  { bg: RED_SOFT,    fg: BRAND.red },
  { bg: DP.page,     fg: BRAND.ink },
];
function paletteFor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BRAND_PALETTES[h % BRAND_PALETTES.length];
}

const logoFor = (b) => resolveDeviceImageSource({ url: b?.imageUrl, base64: b?.imageBase64 });

// Brand tile — same card as DPGridTile, but the logo spans the tile width so
// wide wordmarks (SAMSUNG, vivo, TECNO) read like the Partner grid.
// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function BrandTile({ width, name, logo, icon: Icon, selected, onPress, accessibilityLabel }) {
  const palette = paletteFor(name);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || name}
      accessibilityState={{ selected: !!selected }}
      className="active:opacity-80"
      style={{
        width, minHeight: 88, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4,
        backgroundColor: selected ? DP.mint : '#FFFFFF', borderWidth: selected ? 1.5 : 1, borderColor: selected ? DP.teal : DP.line,
      }}
    >
      {/* Contain (not cover) so wide wordmarks show in full; a logo that
          fails to load falls back to the brand's initial tile. */}
      {logo ? (
        <PickerImage
          uri={logo}
          width="100%"
          height={LOGO_H}
          fallback={(
            <View style={{ width: LOGO_H, height: LOGO_H, borderRadius: 12, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: palette.fg }}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        />
      ) : Icon ? (
        <View style={{ height: LOGO_H, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: DP.mint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} color={DP.teal} />
          </View>
        </View>
      ) : (
        <View style={{ width: LOGO_H, height: LOGO_H, borderRadius: 12, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: palette.fg }}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ marginTop: 8, fontSize: 12, lineHeight: 15, color: DP.ink, fontWeight: selected ? '700' : '500', textAlign: 'center', alignSelf: 'stretch' }}
      >
        {name}
      </Text>
    </Pressable>
  );
}

export default function SelectBrandScreen({ navigation, route }) {
  useHideStackHeader(navigation);
  const flow = route?.params?.flow || 'PROFILE';
  const {
    deviceTypeId, deviceTypeName, editSellOrderId, editHints,
  } = route?.params || {};
  // Repair reached without a category (fallback): pick it here, in a grid
  // above the brands, folding to a card once set. Normally the Category
  // screen comes first and passes it in.
  const [inlineCategory] = useState(() => flow === 'REPAIR' && !(route?.params?.categoryId || route?.params?.categoryName));
  const [cat, setCat] = useState(() => {
    const p = route?.params || {};
    return p.categoryId || p.categoryName
      ? { id: p.categoryId, code: p.categoryCode, name: p.categoryName, image: p.categoryImage }
      : null;
  });
  const [catOpen, setCatOpen] = useState(inlineCategory && !cat);
  const { cats, loading: catsLoading, artFor } = useDeviceCategories(flow, inlineCategory);
  const categoryId = cat?.id;
  const categoryCode = cat?.code;
  const categoryName = cat?.name;
  const categoryImage = cat?.image;
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(!(inlineCategory && !cat));
  const [q, setQ] = useState('');
  const isEditing = !!editSellOrderId;
  const currentBrandId = editHints?.brandId || null;
  const { width } = useWindowDimensions();

  // 4 per row on phones, 6 on tablets (content capped at 720).
  const cols = width >= 600 ? 6 : 4;
  const tileW = gridTileW(Math.min(width, 720), cols);

  useEffect(() => {
    // No category yet (repair, picked below) → nothing to load.
    if (inlineCategory && !cat) { setBrands([]); setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    (async () => {
      let list = [];
      try { list = await getBrandsForCategory(categoryId); } catch (_) {}
      if (!alive) return;
      setBrands(list || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [categoryId, cat, inlineCategory]);


  // Editing an order: its current brand leads the grid.
  const gridBrands = useMemo(() => {
    if (isEditing && currentBrandId) {
      const current = brands.find((b) => b.id === currentBrandId);
      const rest = brands.filter((b) => b.id !== currentBrandId);
      return current ? [current, ...rest] : brands;
    }
    return brands;
  }, [brands, isEditing, currentBrandId]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return gridBrands;
    return gridBrands.filter((b) => (b.name || '').toLowerCase().includes(needle));
  }, [gridBrands, q]);

  const currentBrand = isEditing && currentBrandId ? brands.find((b) => b.id === currentBrandId) : null;

  const onPick = (b) => navigation.navigate('SelectModel', {
    flow, categoryId, categoryCode, categoryName, categoryImage, deviceTypeId, deviceTypeName,
    brandId: b.id, brandName: b.name, brandImage: logoFor(b) || null,
    editSellOrderId, editHints,
  });

  // Category "Change": back to the Category screen (pops this step); the
  // no-category fallback reopens its grid instead.
  const changeCategory = () => {
    if (inlineCategory) setCatOpen(true);
    else goToPicker(navigation, 'SelectCategory', { flow, editSellOrderId });
  };
  const pickCat = (c) => {
    if (c.id !== cat?.id) {
      setCat({ id: c.id, code: (c.code || '').toUpperCase(), name: c.name, image: artFor(c) || null });
      setQ('');
    }
    setCatOpen(false);
  };

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
    setQ('');
    navigation.navigate('SelectModel', {
      ...(route?.params || {}),
      flow, categoryId, categoryCode, categoryName, categoryImage, deviceTypeId, deviceTypeName,
      brandId: null, brandName: name, brandImage: null, customBrand: true,
      editSellOrderId, editHints,
    });
  };

  const headerTitle = flow === 'OWNER_LIST' ? 'Sell' : undefined;
  const needle = q.trim();

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DevicePickerHeader navigation={navigation} title={headerTitle} />
      {(inlineCategory && catsLoading && !cat) || (loading && !inlineCategory) ? (
        <Loader label={inlineCategory && !cat ? 'Loading categories...' : 'Loading brands...'} className="bg-white" />
      ) : (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={[DP_COLUMN, { paddingHorizontal: 16 }]}>
            {isEditing && editHints?.modelName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine }}>
                <Pencil size={13} color={BRAND.yellow} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: BRAND.ink, letterSpacing: 0.8 }}>EDITING ORDER</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: BRAND.body }} numberOfLines={1}>
                    Currently: {editHints.brandName ? `${editHints.brandName} · ` : ''}{editHints.modelName}
                  </Text>
                </View>
              </View>
            ) : null}

            <DPSection title="Category" />
            {catOpen ? (
              catsLoading ? (
                <ActivityIndicator color={DP.teal} style={{ marginVertical: 12 }} />
              ) : cats.length === 0 ? (
                <EmptyState accent={DP.teal} accentSoft={DP.mint} title="No categories" description="Master data isn't seeded yet." />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {cats.map((c) => (
                    <DPGridTile
                      key={c.id}
                      width={tileW}
                      image={artFor(c)}
                      icon={categoryFallbackIcon(c.code)}
                      label={c.name}
                      imageSize={width >= 600 ? 48 : 44}
                      minHeight={96}
                      selected={c.id === cat?.id}
                      onPress={() => pickCat(c)}
                    />
                  ))}
                </View>
              )
            ) : (
              <PickedCard image={categoryImage} icon={categoryFallbackIcon(categoryCode)} title={categoryName || 'Category'} onChange={changeCategory} />
            )}

            {(inlineCategory && !cat) || catOpen ? null : loading ? (
              <>
                <DPSection title="Brand" />
                <ActivityIndicator color={DP.teal} style={{ marginVertical: 12 }} />
              </>
            ) : (
            <>
            <DPSection title="Brand" />
            {brands.length > 0 ? (
              // Partner-style search field (48 high, soft grey, radius 12).
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 12 }}>
                <Search size={18} color={DP.muted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search brand"
                  placeholderTextColor="#9CA3AF"
                  cursorColor={DP.teal}
                  returnKeyType="search"
                  accessibilityLabel="Search brand"
                  // Web only: drop the browser focus ring inside the rounded field.
                  style={[{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: 14, color: DP.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
                />
                {q ? (
                  <Pressable onPress={() => setQ('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
                    <X size={16} color={DP.muted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {gridBrands.length === 0 && !allowOther ? (
              <EmptyState accent={DP.teal} accentSoft={DP.mint} title="No brands found" description="No brands mapped to this category yet." />
            ) : needle && shown.length === 0 ? (
              <>
                <EmptyState accent={DP.teal} accentSoft={DP.mint} title="No brands found" description={`Nothing matches "${needle}".`} />
                {allowOther ? (
                  <Pressable
                    onPress={() => { setOtherName(needle); setOtherOpen(true); }}
                    className="active:opacity-80"
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 4, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: DP.teal, backgroundColor: '#FFFFFF' }}
                  >
                    <Plus size={15} color={DP.teal} />
                    <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '700', color: DP.teal }} numberOfLines={1}>Use "{needle}" as Other brand</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {shown.map((b) => (
                  <BrandTile
                    key={b.id}
                    width={tileW}
                    name={b.name}
                    logo={logoFor(b)}
                    selected={isEditing && b.id === currentBrandId}
                    onPress={() => onPick(b)}
                  />
                ))}
                {allowOther ? (
                  <BrandTile width={tileW} name="Other" icon={Plus} accessibilityLabel="Other brand" onPress={() => setOtherOpen(true)} />
                ) : null}
              </View>
            )}
            </>
            )}
          </View>
        </ScrollView>
      )}
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
    </View>
  );
}
