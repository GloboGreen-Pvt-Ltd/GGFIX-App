import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Check, ChevronRight, Plus, Search, Skull, Smartphone, X } from 'lucide-react-native';
import { BRAND } from '../../../theme/brand';
import { createSavedDevice } from '../../../api/customer';
import { notify } from '../../../components/confirm';
import { ResponsiveModal } from '../../../components/responsive';
import { rf, rs } from '../../../utils/responsive';
import DeviceImage from '../../../components/DeviceImage';
import ImageViewerModal from '../../../components/ImageViewerModal';
import { resolveDeviceImageSource } from '../../../utils/images';
import {
  categoryMenuKey, getBrandsForCategory, getCategoryMenuImages, getDeviceCategories,
  getModelOptions, getModelsByBrand, getSeriesForCategoryBrand,
} from '../../../api/masterData';
import useDeviceSpecForm from '../../../lib/hooks/useDeviceSpecForm';
import { SPEC_ATTRIBUTE_KEYS, formatSpecValue, resolveSpecCategory, specDisplayParts, usesCategorySpecs } from '../../../utils/deviceSpecs';
import { useHideStackHeader } from '../service-booking-customer/FlowChrome';
import { DevicePickerHeader, DPNextBar } from './DevicePickerChrome';
import { imeiApplies, cleanImei, isValidImei } from '../../../utils/imeiPolicy';

/**
 * Device Details (repair booking) — port of the Partner app's booking
 * DeviceDetailsScreen: one screen for Category → Brand → Series → Model →
 * Model Number / Color / Storage (or the category's spec fields). Same
 * options and rules: grids fold to a picked card with Change, "Other" types a
 * brand / model / value that isn't listed, Color / Storage stay optional.
 * Next hands RepairSelectService the same `device` the old Select Variant
 * step built.
 */

const ACCENT = '#035C6C';
const MINT = '#E5F3F5';
const INK = '#111111';
const MUTED = '#6B7280';
const PLACEHOLDER = '#9CA3AF';
const BORDER = '#E5E7EB';
const PAGE_BG = '#F3F4F6';
const INPUT_H = 46;
const FIELD_BOX = { borderWidth: 1, borderColor: BORDER, borderRadius: 12, backgroundColor: '#FFFFFF' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const onlyUuid = (v) => (UUID_RE.test(String(v || '')) ? v : undefined);

// Category display order; anything else follows.
const CATEGORY_ORDER = ['mobile', 'smartphone', 'tablet', 'laptop', 'smartwatch', 'audiodevice', 'audio'];
const catRank = (c) => Math.min(
  ...[categoryMenuKey(c?.name), categoryMenuKey(c?.code)].map((k) => {
    const at = CATEGORY_ORDER.indexOf(k);
    return at === -1 ? CATEGORY_ORDER.length : at;
  }),
);

// Grid tile width: a hair under 100/cols so rounding never wraps the last tile.
const tilePct = (cols) => `${(100 / cols) - 0.1}%`;

// "A1234 / A5678" → ['A1234', 'A5678'] (deduped).
function parseModelNumbers(mn) {
  const raw = Array.isArray(mn) ? mn.map((s) => String(s).trim()) : String(mn || '').split(/[/,;]+/).map((s) => s.trim());
  return [...new Set(raw.filter(Boolean))];
}

// Product colour fallback when a catalogue colour has no hex.
const SWATCHES = {
  black: '#111111', white: '#F3F4F6', silver: '#D6D9DE', gold: '#F2D58A', rose: '#F4C6CC', blue: '#3B82F6',
  red: '#E53935', green: '#357D89', purple: '#8B5CF6', pink: '#F48FB1', graphite: '#4B4B4B', midnight: '#1E2A44',
  starlight: '#F5EBD8', orange: '#F59E3B', yellow: '#F3BF23', grey: '#9CA3AF', gray: '#9CA3AF', titanium: '#B8B3AA',
};
const swatchFor = (name) => {
  const n = String(name || '').toLowerCase();
  const key = Object.keys(SWATCHES).find((k) => n.includes(k));
  return key ? SWATCHES[key] : '#D1D5DB';
};
const titleCase = (v) => String(v || '').toLowerCase().replace(/(^|[\s\-/(])([a-z0-9])/g, (_, s, c) => s + c.toUpperCase());

export default function DeviceDetailsScreen({ navigation, route }) {
  useHideStackHeader(navigation);
  const params = route?.params || {};
  const { width: winW } = useWindowDimensions();
  const tablet = winW >= 600;
  // Columns follow the screen width (Partner grid).
  const catCols = tablet ? 6 : 4;
  const catImg = rs(tablet ? 84 : 64);
  const brandCols = tablet ? 8 : 4;
  const modelCols = tablet ? 5 : 3;
  const optCols = winW >= 900 ? 6 : tablet ? 5 : 3;
  const seriesCols = tablet ? 6 : 4;

  // ── Category ────────────────────────────────────────────────────────────
  const [cats, setCats] = useState([]);
  const [catImages, setCatImages] = useState({});
  const [catsLoading, setCatsLoading] = useState(true);
  const [catId, setCatId] = useState(null);
  // A Home tile's category (UUID or code like 'SMARTPHONE'), resolved once the list loads.
  const preset = useRef({ id: String(params.categoryId || ''), code: String(params.categoryCode || params.categoryId || '').toUpperCase() });
  // ── Brand / series / model ──────────────────────────────────────────────
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brand, setBrand] = useState(null);           // catalogue row | { id: null, name, custom: true }
  const [models, setModels] = useState([]);
  const [series, setSeries] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [seriesId, setSeriesId] = useState('');       // '' = All
  const [q, setQ] = useState('');
  const [model, setModel] = useState(null);           // catalogue row | { id: null, name, custom: true }
  // ── Variant ─────────────────────────────────────────────────────────────
  const [options, setOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [modelNumber, setModelNumber] = useState(null);
  const [color, setColor] = useState('');
  const [variantId, setVariantId] = useState(null);   // combined RAM+Storage spec id
  const [ram, setRam] = useState(null);               // fallback RAM option id
  const [storage, setStorage] = useState(null);       // fallback storage option id
  const [ramText, setRamText] = useState('');
  const [storageText, setStorageText] = useState('');
  const [specState, setSpecState] = useState(null);   // { category, values, fieldKeys } from <SpecFields>
  // Full-screen model image: { items: [{ uri, label, row }], index }.
  const [viewer, setViewer] = useState(null);
  // Sell only (was on the second "Your Device" page): condition + IMEI.
  const isSell = params.flow === 'SELL';
  const [sellCondition, setSellCondition] = useState('WORKING');
  const [sellImei, setSellImei] = useState('');
  // "Other" popup: { title, placeholder, initial?, onDone(name) }.
  const [typeSheet, setTypeSheet] = useState(null);
  // Category / Brand / Model grids fold to a picked card; Change reopens one.
  const [catListOpen, setCatListOpen] = useState(true);
  const [brandListOpen, setBrandListOpen] = useState(true);
  const [modelListOpen, setModelListOpen] = useState(true);
  const [modelLimit, setModelLimit] = useState(24);

  const category = cats.find((c) => c.id === catId) || null;
  const specCategory = category ? resolveSpecCategory(category.code, category.name) : null;
  const usesSpecs = usesCategorySpecs(specCategory);

  useEffect(() => {
    let alive = true;
    Promise.all([getDeviceCategories().catch(() => []), getCategoryMenuImages('REPAIR', { includeInactive: true }).catch(() => ({}))])
      .then(([list, images]) => {
        if (!alive) return;
        const rows = (Array.isArray(list) ? list : [])
          .filter((c) => c?.id && c.isActive !== false)
          .map((c, i) => ({ c, i }))
          .sort((a, b) => catRank(a.c) - catRank(b.c) || a.i - b.i)
          .map(({ c }) => c);
        setCats(rows);
        setCatImages(images || {});
        const { id, code } = preset.current;
        const hit = (id || code) && rows.find((c) => c.id === id || (code && String(c.code || '').toUpperCase() === code));
        if (hit) { setCatId(hit.id); setCatListOpen(false); }
      })
      .finally(() => { if (alive) setCatsLoading(false); });
    return () => { alive = false; };
  }, []);

  // New category → reload its brands, clear everything below it.
  useEffect(() => {
    setBrand(null); setBrands([]); setBrandListOpen(true);
    if (!catId) return undefined;
    let alive = true;
    setBrandsLoading(true);
    getBrandsForCategory(catId)
      .then((list) => { if (alive) setBrands(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setBrands([]); })
      .finally(() => { if (alive) setBrandsLoading(false); });
    return () => { alive = false; };
  }, [catId]);

  // New brand → reload its models + series.
  useEffect(() => {
    setModel(null); setModels([]); setSeries([]); setSeriesId(''); setQ(''); setModelListOpen(true); setModelLimit(24);
    if (!brand?.id) return undefined;
    let alive = true;
    setModelsLoading(true);
    Promise.all([getModelsByBrand(brand.id).catch(() => []), getSeriesForCategoryBrand(catId, brand.id).catch(() => [])])
      .then(([ms, ss]) => {
        if (!alive) return;
        let list = Array.isArray(ms) ? ms : [];
        if (UUID_RE.test(String(catId || ''))) list = list.filter((m) => !m.categoryId || m.categoryId === catId);
        setModels(list);
        setSeries(Array.isArray(ss) ? ss : []);
      })
      .finally(() => { if (alive) setModelsLoading(false); });
    return () => { alive = false; };
  }, [brand, catId]);

  // New model → its configured colours / variants / model numbers.
  useEffect(() => {
    setOptions(null); setColor(''); setVariantId(null); setRam(null); setStorage(null);
    setRamText(''); setStorageText(''); setSpecState(null);
    setModelNumber(model?.id ? (parseModelNumbers(model.modelNumber)[0] || null) : null);
    if (!model) return undefined;
    // A typed (not-in-list) model has no catalogue entry — its values are typed.
    if (!model.id) {
      setOptions({ colors: [], specs: [], allColors: [], allRams: [], allStorages: [], modelNumbers: [] });
      setOptionsLoading(false);
      return undefined;
    }
    let alive = true;
    setOptionsLoading(true);
    getModelOptions(model.id)
      .then((o) => {
        if (!alive) return;
        setOptions(o);
        const nums = o?.modelNumbers?.length ? o.modelNumbers : parseModelNumbers(model.modelNumber);
        setModelNumber((prev) => (prev && nums.includes(prev) ? prev : (nums[0] || null)));
      })
      .catch(() => { if (alive) setOptions({ colors: [], specs: [], allColors: [], allRams: [], allStorages: [], modelNumbers: [] }); })
      .finally(() => { if (alive) setOptionsLoading(false); });
    return () => { alive = false; };
  }, [model]);

  const seriesWithModels = useMemo(() => {
    const ids = new Set(models.map((m) => m.seriesId).filter(Boolean));
    return series.filter((s) => ids.has(s.id));
  }, [series, models]);

  // Model listing: the series chip narrows it; a search spans every series.
  const listModels = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle) return models.filter((m) => String(m.name || '').toLowerCase().includes(needle));
    return seriesId ? models.filter((m) => m.seriesId === seriesId) : models;
  }, [models, seriesId, q]);

  const isCustomModel = !!model && !model.id;
  const colorsList = options ? (options.colors?.length ? options.colors : options.allColors || []) : [];
  const variants = options?.specs || [];
  const storageOnly = variants.length > 0 && variants.every((v) => v.storageOnly);
  const modelNumbers = options?.modelNumbers?.length ? options.modelNumbers : parseModelNumbers(model?.modelNumber);

  const catImageFor = (c) => (c ? catImages[categoryMenuKey(c.name)] || catImages[categoryMenuKey(c.code)] || c.imageUrl || null : null);
  const modelImage = model?.id ? resolveDeviceImageSource({ url: model.imageUrl, base64: model.imageBase64 }) : null;
  const seriesName = model?.seriesId ? series.find((s) => s.id === model.seriesId)?.name : null;

  const pickModel = (m) => {
    setModel(m);
    if (m?.seriesId) setSeriesId((cur) => (cur && cur !== m.seriesId ? '' : cur));
    setQ('');
    setModelListOpen(false);
  };

  // A model's image full-screen; swipe moves through the listed models with an image.
  const openModelViewer = (list, modelId) => {
    const items = list
      .map((m) => ({ uri: resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 }), label: m.name, row: m }))
      .filter((x) => x.uri);
    if (!items.length) return;
    setViewer({ items, index: Math.max(0, items.findIndex((x) => x.row.id === modelId)), selectable: true });
  };

  // Booking: Color / RAM / Storage are optional (Partner rule).
  const ready = !!category && !!brand?.name && !!model?.name && !optionsLoading;

  const ramLabelOf = (id) => (id ? options?.allRams?.find((x) => x.id === id)?.label : undefined);
  const storageLabelOf = (id) => (id ? options?.allStorages?.find((x) => x.id === id)?.label : undefined);
  const colorSwatch = (name) => colorsList.find((c) => c.name === name)?.hexCode || swatchFor(name);

  const onNext = () => {
    if (!ready) return;
    const variant = variants.find((v) => v.id === variantId);
    if (params.flow === 'PROFILE') {
      // Manage My Device → Add: same one-page picker as Repair; save and return.
      const payload = {
        categoryId: onlyUuid(category.id),
        categoryCode: String(category.code || '').toUpperCase() || undefined,
        brandId: onlyUuid(brand.id),
        modelId: onlyUuid(model.id),
        modelName: model.name || undefined,
        brandName: brand.name || undefined,
        imageUrl: modelImage || undefined,
        ramOptionId: onlyUuid(variant ? variant.ramOptionId : ram),
        storageOptionId: onlyUuid(variant ? variant.storageOptionId : storage),
        ramLabel: variant ? (variant.ramLabel || undefined) : (ramLabelOf(ram) || ramText.trim() || undefined),
        storageLabel: variant ? (variant.storageLabel || undefined) : (storageLabelOf(storage) || storageText.trim() || undefined),
        color: color.trim() || undefined,
      };
      createSavedDevice(payload)
        .then(() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('ManageDevice'); })
        .catch((e) => notify('Save failed', e?.message || 'Could not save device. Try again.'));
      return;
    }
    if (params.flow === 'SELL') {
      // Sell: everything is picked on this one page → straight to screening.
      const imeiOn = imeiApplies(specCategory || category?.code || category?.name);
      if (imeiOn && sellImei && !isValidImei(sellImei)) return;
      navigation.navigate('SellScreening', {
        workingCondition: sellCondition,
        device: {
        flow: 'SELL',
        categoryId: onlyUuid(category.id),
        categoryCode: String(category.code || '').toUpperCase() || undefined,
        categoryName: category.name,
        brandId: onlyUuid(brand.id),
        brandName: brand.name,
        seriesId: model.seriesId || undefined,
        seriesName: seriesName || undefined,
        modelId: onlyUuid(model.id),
        modelName: model.name,
        customModel: !onlyUuid(model.id) ? true : undefined,
        modelImageUrl: modelImage || undefined,
        ramOptionId: onlyUuid(variant ? variant.ramOptionId : ram),
        storageOptionId: onlyUuid(variant ? variant.storageOptionId : storage),
        ramLabel: variant ? (variant.ramLabel || undefined) : (ramLabelOf(ram) || ramText.trim() || undefined),
        storageLabel: variant ? (variant.storageLabel || undefined) : (storageLabelOf(storage) || storageText.trim() || undefined),
        imageUrl: modelImage || undefined,
        color: color.trim() || undefined,
        imei: imeiOn && sellImei ? sellImei : undefined,
        },
      });
      return;
    }
    let variantParams;
    if (usesSpecs) {
      const values = specState?.values || {};
      const specs = {};
      SPEC_ATTRIBUTE_KEYS.forEach((k) => { if (values[k]) specs[k] = values[k]; });
      variantParams = {
        color: values.color || undefined,
        ramLabel: specs.ram ? formatSpecValue('ram', specs.ram) : undefined,
        storageLabel: specs.storageCapacity ? formatSpecValue('storageCapacity', specs.storageCapacity) : undefined,
        deviceCategory: specState?.category || specCategory || undefined,
        specs,
      };
    } else {
      // A listed variant, a master RAM / storage pick, or a typed value.
      variantParams = {
        color: color.trim() || undefined,
        ramOptionId: onlyUuid(variant ? variant.ramOptionId : ram),
        storageOptionId: onlyUuid(variant ? variant.storageOptionId : storage),
        ramLabel: variant ? (variant.ramLabel || undefined) : (ramLabelOf(ram) || ramText.trim() || undefined),
        storageLabel: variant ? (variant.storageLabel || undefined) : (storageLabelOf(storage) || storageText.trim() || undefined),
        deviceCategory: specCategory || undefined,
      };
    }
    navigation.navigate('RepairSelectService', {
      device: {
        categoryId: onlyUuid(category.id),
        categoryCode: String(category.code || '').toUpperCase() || undefined,
        categoryName: category.name,
        brandId: onlyUuid(brand.id),
        brandName: brand.name,
        customBrand: brand.custom ? true : undefined,
        seriesId: model.seriesId || undefined,
        seriesName: seriesName || undefined,
        modelId: onlyUuid(model.id),
        modelName: model.name,
        customModel: isCustomModel ? true : undefined,
        modelNumber: modelNumber || undefined,
        imageUrl: modelImage || undefined,
        ...variantParams,
        workingCondition: 'WORKING',
        dead: false,
      },
    });
  };

  // Brand › Series › Model — the category is already in its own field above.
  const crumbs = [brand?.name, seriesName, model?.name].filter(Boolean);
  const pickedVariant = variants.find((v) => v.id === variantId);
  const summaryColor = usesSpecs ? specState?.values?.color : color.trim();
  const summaryStorage = usesSpecs
    ? specDisplayParts({ deviceCategory: specState?.category || specCategory, specs: specState?.values || {} }).join(' / ')
    : pickedVariant
      ? pickedVariant.label
      : [ramLabelOf(ram) || ramText.trim(), storageLabelOf(storage) || storageText.trim()].filter(Boolean).join(' / ');

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DevicePickerHeader navigation={navigation} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: 24, alignItems: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: '100%', maxWidth: 760 }}>
            {/* ── Category — tiles with the admin Category Menu art. ── */}
            <Field label="Category">
              {category && !catListOpen ? (
                <PickedCard image={catImageFor(category)} title={category.name} onChange={() => setCatListOpen(true)} />
              ) : catsLoading ? (
                <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                  {cats.map((c) => {
                    const on = c.id === catId;
                    const img = catImageFor(c);
                    return (
                      <View key={c.id} style={{ width: tilePct(catCols), padding: 4 }}>
                        <Pressable
                          onPress={() => { if (!on) setCatId(c.id); setCatListOpen(false); }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={c.name}
                          className="items-center justify-center active:opacity-80"
                          style={{
                            paddingHorizontal: 4, paddingTop: 4, paddingBottom: 5, borderRadius: 14,
                            borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : BORDER, backgroundColor: on ? MINT : '#FFFFFF',
                          }}
                        >
                          {on ? <TickBadge size={18} top={6} /> : null}
                          {img ? (
                            <View style={{ width: '100%', height: catImg, overflow: 'hidden', borderRadius: 10 }}>
                              <DeviceImage url={img} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                            </View>
                          ) : (
                            <View className="items-center justify-center" style={{ height: catImg }}><Smartphone size={rs(34)} color={INK} strokeWidth={1.75} /></View>
                          )}
                          <Text
                            style={{ marginTop: 3, fontSize: rf(11.5), lineHeight: rf(14), fontWeight: on ? '800' : '600', color: INK, textAlign: 'center' }}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                          >
                            {c.name}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </Field>

            {/* ── Brand — logos plus Other (typed in a popup). ── */}
            {category ? (
              <Field label="Brand">
                {brand && !brandListOpen ? (
                  <PickedCard
                    image={brand.id ? resolveDeviceImageSource({ url: brand.imageUrl, base64: brand.imageBase64 }) : null}
                    title={brand.name}
                    subtitle={brand.custom ? 'Not in list' : null}
                    onChange={() => setBrandListOpen(true)}
                  />
                ) : brandsLoading ? (
                  <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                    {brands.map((b) => (
                      <View key={b.id} style={{ width: tilePct(brandCols), padding: 4 }}>
                        <GridTile
                          label={b.name}
                          image={resolveDeviceImageSource({ url: b.imageUrl, base64: b.imageBase64 })}
                          imageSize={rs(44)}
                          imageWidth="100%"
                          compact
                          padH={2}
                          on={brand?.id === b.id}
                          onPress={() => { if (brand?.id !== b.id) setBrand(b); setBrandListOpen(false); }}
                        />
                      </View>
                    ))}
                    <View style={{ width: tilePct(brandCols), padding: 4 }}>
                      <GridTile
                        label={brand?.custom ? brand.name : 'Other'}
                        icon={Plus}
                        imageSize={rs(35)}
                        compact
                        on={!!brand?.custom}
                        onPress={() => setTypeSheet({
                          title: 'Other Brand',
                          placeholder: 'Type the brand name',
                          onDone: (name) => { setBrand({ id: null, name, custom: true }); setBrandListOpen(false); },
                        })}
                      />
                    </View>
                  </View>
                )}
              </Field>
            ) : null}

            {/* ── Model — search, series chips, model tiles and Other. ── */}
            {brand ? (
              <Field label="Model">
                {model && !modelListOpen ? (
                  <PickedCard
                    image={modelImage}
                    imageSize={44}
                    title={model.name}
                    subtitle={seriesName || (isCustomModel ? 'Not in list' : null)}
                    onChange={() => setModelListOpen(true)}
                  />
                ) : modelsLoading ? (
                  <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
                ) : (
                  <>
                    {models.length ? (
                      <View className="flex-row items-center px-3" style={{ ...FIELD_BOX, height: INPUT_H, marginBottom: 10 }}>
                        <Search size={18} color={MUTED} />
                        <TextInput
                          value={q}
                          onChangeText={(v) => { setQ(v); setModelLimit(24); }}
                          placeholder="Search model"
                          placeholderTextColor={PLACEHOLDER}
                          cursorColor={ACCENT}
                          returnKeyType="search"
                          className="flex-1 ml-2"
                          style={[{ paddingVertical: 0, fontSize: rf(13), color: INK }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
                        />
                        {q ? (
                          <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search"><X size={16} color={MUTED} /></Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    {seriesWithModels.length && !q.trim() ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 6 }}>
                        {[{ id: '', name: 'All' }, ...seriesWithModels].map((sr) => (
                          <View key={sr.id || 'all'} style={{ width: tilePct(seriesCols), padding: 4 }}>
                            <OptionTile label={sr.name} on={seriesId === sr.id} onPress={() => { setSeriesId(sr.id); setModelLimit(24); }} />
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                      {listModels.slice(0, modelLimit).map((m) => (
                        <View key={m.id} style={{ width: tilePct(modelCols), padding: 4 }}>
                          <GridTile
                            label={m.name}
                            image={resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 })}
                            imageSize={rs(60)}
                            imageWidth={rs(64)}
                            padH={2}
                            labelSize={13}
                            fallbackIcon={Smartphone}
                            on={model?.id === m.id}
                            onPress={() => pickModel(m)}
                            onImagePress={() => openModelViewer(listModels, m.id)}
                          />
                        </View>
                      ))}
                      <View style={{ width: tilePct(modelCols), padding: 4 }}>
                        <GridTile
                          label={isCustomModel ? model.name : 'Other'}
                          icon={Plus}
                          imageSize={rs(60)}
                          imageWidth={rs(64)}
                          padH={2}
                          labelSize={13}
                          on={isCustomModel}
                          onPress={() => setTypeSheet({
                            title: 'Other Model',
                            placeholder: 'Type the model name',
                            initial: q.trim(),
                            onDone: (name) => pickModel({ id: null, name, custom: true }),
                          })}
                        />
                      </View>
                    </View>

                    {listModels.length > modelLimit ? (
                      <Pressable
                        onPress={() => setModelLimit((n) => n + 24)}
                        accessibilityRole="button"
                        className="items-center justify-center active:opacity-80"
                        style={{ marginTop: 8, height: 40, borderRadius: 12, borderWidth: 1, borderColor: BORDER }}
                      >
                        <Text style={{ fontSize: rf(13), fontWeight: '700', color: ACCENT }}>
                          Show more models ({listModels.length - modelLimit})
                        </Text>
                      </Pressable>
                    ) : null}
                    {q.trim() && !listModels.length ? (
                      <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 6 }}>
                        No model matches “{q.trim()}” — tap Other to type it.
                      </Text>
                    ) : null}
                  </>
                )}
              </Field>
            ) : null}

            {/* ── Variant: model number, colour, storage (all optional). ── */}
            {model ? (
              optionsLoading ? (
                <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
              ) : (
                <>
                  {modelNumbers.length > 1 ? (
                    <Field label="Model Number">
                      <FoldGrid
                        valueLabel={modelNumber || ''}
                        cols={optCols}
                        options={modelNumbers.map((n) => ({ key: n, label: n }))}
                        selected={modelNumber}
                        onSelect={(k) => setModelNumber(k)}
                        other={{
                          value: modelNumber && !modelNumbers.includes(modelNumber) ? modelNumber : '',
                          onPress: () => setTypeSheet({ title: 'Other Model Number', placeholder: 'Type the model number', onDone: (t) => setModelNumber(t) }),
                        }}
                      />
                    </Field>
                  ) : null}

                  {/* Sell only: device condition + IMEI, before Color. */}
                  {isSell ? (
                    <>
                      {(() => {
                        const cc = String(category?.code || category?.name || '').toUpperCase();
                        const lbl = cc.includes('LAPTOP') ? 'Laptop' : cc.includes('WATCH') ? 'Smart Watch'
                          : (cc.includes('AUDIO') || cc.includes('HEADPHONE') || cc.includes('EARBUD')) ? 'Audio Device' : 'Mobile';
                        const opts = [
                          { key: 'WORKING', label: `Working ${lbl}`, sub: 'Turns on · No major issues', icon: Smartphone, color: BRAND.green, soft: BRAND.greenSoft },
                          { key: 'DEAD', label: `${lbl} Dead / Unknown`, sub: "Won't turn on · Not sure", icon: Skull, color: BRAND.red, soft: BRAND.redSoft },
                        ];
                        return (
                          <Field label={`${lbl} Condition`} required>
                            <View style={{ flexDirection: 'row', marginHorizontal: -rs(4) }}>
                              {opts.map((o) => (
                                <View key={o.key} style={{ flex: 1, paddingHorizontal: rs(4) }}>
                                  <ConditionCard o={o} active={sellCondition === o.key} onPress={() => setSellCondition(o.key)} />
                                </View>
                              ))}
                            </View>
                          </Field>
                        );
                      })()}
                      {imeiApplies(specCategory || category?.code || category?.name) ? (
                        <Field label="IMEI Number" optional>
                          <TextInput
                            value={sellImei}
                            onChangeText={(v) => setSellImei(cleanImei(v))}
                            placeholder="15-digit IMEI (dial *#06#)"
                            placeholderTextColor={PLACEHOLDER}
                            keyboardType="number-pad"
                            maxLength={15}
                            cursorColor={ACCENT}
                            style={{ ...FIELD_BOX, height: 46, paddingHorizontal: 12, fontSize: rf(14), color: INK, borderColor: sellImei && !isValidImei(sellImei) ? '#DC2626' : BORDER }}
                          />
                          {sellImei && !isValidImei(sellImei) ? <Text style={{ fontSize: rf(11), color: '#DC2626', marginTop: 4 }}>Enter a valid 15-digit IMEI</Text> : null}
                        </Field>
                      ) : null}
                    </>
                  ) : null}

                  {usesSpecs ? (
                    <SpecFields
                      key={`${catId}|${model.id || model.name}`}
                      category={category}
                      modelId={model.id}
                      modelOptions={options}
                      onState={setSpecState}
                      cols={optCols}
                      manual={isCustomModel}
                    />
                  ) : isCustomModel ? (
                    <>
                      <Field label="Color" optional>
                        <ManualInput value={color} onChangeText={setColor} placeholder="Enter colour, e.g. Sea Green" />
                      </Field>
                      <Field label="RAM" optional>
                        <ManualInput value={ramText} onChangeText={setRamText} placeholder="Enter RAM, e.g. 8 GB" caps />
                      </Field>
                      <Field label="Storage" optional>
                        <ManualInput value={storageText} onChangeText={setStorageText} placeholder="Enter storage, e.g. 128 GB" caps />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="Color" optional>
                        <FoldGrid
                          valueLabel={color ? titleCase(color) : ''}
                          valueSwatch={color ? colorSwatch(color) : null}
                          cols={optCols}
                          options={colorsList.map((c) => ({ key: c.name, label: titleCase(c.name), swatch: c.hexCode || swatchFor(c.name) }))}
                          selected={color}
                          onSelect={(k) => setColor(color === k ? '' : k)}
                          other={{
                            value: color && !colorsList.some((c) => c.name === color) ? titleCase(color) : '',
                            onPress: () => setTypeSheet({ title: 'Other Color', placeholder: 'Type the colour, e.g. Sea Green', onDone: (t) => setColor(t) }),
                          }}
                        />
                      </Field>

                      {variants.length > 0 ? (
                        <Field label={storageOnly ? 'Storage' : 'RAM & Storage'} optional>
                          <FoldGrid
                            valueLabel={pickedVariant?.label || storageText}
                            cols={optCols}
                            options={variants.map((v) => ({ key: v.id, label: v.label }))}
                            selected={variantId}
                            onSelect={(k) => { setStorageText(''); setVariantId(variantId === k ? null : k); }}
                            other={{
                              value: !variantId && storageText ? storageText : '',
                              onPress: () => setTypeSheet({
                                title: storageOnly ? 'Other Storage' : 'Other RAM & Storage',
                                placeholder: storageOnly ? 'e.g. 256 GB' : 'e.g. 8 GB + 256 GB',
                                onDone: (t) => { setVariantId(null); setStorageText(t); },
                              }),
                            }}
                          />
                        </Field>
                      ) : (
                        <>
                          <Field label="RAM" optional>
                            <FoldGrid
                              valueLabel={ramLabelOf(ram) || ramText}
                              cols={optCols}
                              options={(options?.allRams || []).map((x) => ({ key: x.id, label: x.label }))}
                              selected={ram}
                              onSelect={(k) => { setRamText(''); setRam(ram === k ? null : k); }}
                              other={{
                                value: !ram && ramText ? ramText : '',
                                onPress: () => setTypeSheet({ title: 'Other RAM', placeholder: 'e.g. 12 GB', onDone: (t) => { setRam(null); setRamText(t); } }),
                              }}
                            />
                          </Field>
                          <Field label="Storage" optional>
                            <FoldGrid
                              valueLabel={storageLabelOf(storage) || storageText}
                              cols={optCols}
                              options={(options?.allStorages || []).map((x) => ({ key: x.id, label: x.label }))}
                              selected={storage}
                              onSelect={(k) => { setStorageText(''); setStorage(storage === k ? null : k); }}
                              other={{
                                value: !storage && storageText ? storageText : '',
                                onPress: () => setTypeSheet({ title: 'Other Storage', placeholder: 'e.g. 256 GB', onDone: (t) => { setStorage(null); setStorageText(t); } }),
                              }}
                            />
                          </Field>
                        </>
                      )}
                    </>
                  )}
                </>
              )
            ) : null}

            {/* ── Select Device summary ── */}
            {crumbs.length ? (
              <View style={{ marginTop: 4, borderRadius: 14, backgroundColor: PAGE_BG, padding: 12 }}>
                <Text style={{ fontSize: rf(14), fontWeight: '700', color: INK, marginBottom: 10 }}>Select Device</Text>
                <View className="flex-row items-center">
                  <Pressable
                    onPress={modelImage ? () => setViewer({ items: [{ uri: modelImage, label: model?.name, row: model }], index: 0 }) : undefined}
                    disabled={!modelImage}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View model image"
                    className="items-center justify-center"
                    style={{ width: 64, height: 76, borderRadius: 10, backgroundColor: '#FFFFFF', overflow: 'hidden' }}
                  >
                    {modelImage ? (
                      <DeviceImage url={modelImage} style={{ width: 56, height: 68 }} contentFit="contain" />
                    ) : (
                      <Smartphone size={28} color={ACCENT} />
                    )}
                  </Pressable>
                  <View className="flex-1" style={{ marginLeft: 12, minWidth: 0 }}>
                    <View className="flex-row flex-wrap items-center">
                      {crumbs.map((c, i) => (
                        <View key={`${c}-${i}`} className="flex-row items-center" style={{ marginVertical: 2, maxWidth: '100%' }}>
                          <Text style={{ flexShrink: 1, fontSize: rf(13), fontWeight: i === crumbs.length - 1 ? '800' : '500', color: INK }}>{c}</Text>
                          {i < crumbs.length - 1 ? <ChevronRight size={14} color={MUTED} style={{ marginHorizontal: 4 }} /> : null}
                        </View>
                      ))}
                    </View>
                    {summaryColor ? <SummaryLine label="Color" value={titleCase(summaryColor)} /> : null}
                    {summaryStorage ? <SummaryLine label="Storage" value={summaryStorage} /> : null}
                    {modelNumber ? <SummaryLine label="Model Number" value={modelNumber} /> : null}
                  </View>
                </View>
              </View>
            ) : null}

          </View>
        </ScrollView>

        <DPNextBar disabled={!ready || (isSell && !!sellImei && !isValidImei(sellImei))} onPress={onNext} />
      </KeyboardAvoidingView>

      <TypeSheet config={typeSheet} onClose={() => setTypeSheet(null)} />

      <ImageViewerModal
        visible={!!viewer}
        images={viewer?.items || []}
        index={viewer?.index || 0}
        onClose={() => setViewer(null)}
        actionLabel={viewer?.selectable ? 'Select this model' : undefined}
        onAction={viewer?.selectable ? (item) => { setViewer(null); pickModel(item.row); } : undefined}
      />
    </View>
  );
}

// Category spec fields (Laptop / Smartwatch / Audio) — keyed by category + model
// so a new pick starts clean; reports its values up for Next.
const MANUAL_SPEC_PLACEHOLDER = {
  color: 'Enter colour, e.g. Space Gray',
  ram: 'Enter RAM, e.g. 16 GB',
  storageCapacity: 'Enter storage, e.g. 512 GB',
  caseSize: 'Enter case size, e.g. 44 mm',
};

function SpecFields({ category, modelId, modelOptions, onState, cols = 3, manual = false }) {
  const spec = useDeviceSpecForm({
    context: 'BOOKING',
    hints: [category?.code, category?.name, category?.id],
    categoryId: category?.id,
    modelId: modelId || undefined,
    modelOptions,
    initial: {},
  });
  useEffect(() => {
    onState({ category: spec.category, values: spec.values, fieldKeys: spec.fields.map((f) => f.key) });
  }, [spec.category, spec.values, spec.fields, onState]);

  if (spec.loading) return <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />;
  return spec.fields.map((f) => {
    const isColor = f.key === 'color';
    const cur = spec.values[f.key];
    const curOpt = f.options.find((o) => o.value === cur);
    if (manual && MANUAL_SPEC_PLACEHOLDER[f.key]) {
      return (
        <Field key={f.key} label={isColor ? 'Color' : f.label} optional>
          <ManualInput value={cur || ''} onChangeText={(v) => spec.setValue(f.key, v)} placeholder={MANUAL_SPEC_PLACEHOLDER[f.key]} caps={!isColor} />
        </Field>
      );
    }
    return (
      <Field key={f.key} label={isColor ? 'Color' : f.label} optional>
        <FoldGrid
          valueLabel={curOpt ? (isColor ? titleCase(curOpt.label || curOpt.value) : curOpt.label) : ''}
          valueSwatch={isColor && curOpt ? (curOpt.hex || swatchFor(curOpt.value)) : null}
          cols={cols}
          options={f.options.map((o) => ({
            key: o.value,
            label: isColor ? titleCase(o.label || o.value) : o.label,
            swatch: isColor ? (o.hex || swatchFor(o.value)) : undefined,
          }))}
          selected={cur}
          onSelect={(k) => spec.setValue(f.key, cur === k ? null : k)}
        />
      </Field>
    );
  });
}

// ── Building blocks ─────────────────────────────────────────────────────────
function TickBadge({ size = 16, top = 5 }) {
  return (
    <View className="items-center justify-center" style={{ position: 'absolute', top, right: top, height: size, width: size, borderRadius: size / 2, backgroundColor: ACCENT, zIndex: 1 }}>
      <Check size={Math.round(size * 0.62)} color="#FFFFFF" strokeWidth={3} />
    </View>
  );
}

function ManualInput({ value, onChangeText, placeholder, caps = false }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={PLACEHOLDER}
      autoCapitalize={caps ? 'characters' : 'words'}
      cursorColor={ACCENT}
      style={{ ...FIELD_BOX, height: INPUT_H, paddingHorizontal: 12, fontSize: rf(14), color: INK }}
    />
  );
}

// Exact condition card from the former Sell "Your Device" page (SelectVariantScreen).
function ConditionCard({ o, active, onPress }) {
  const { width } = useWindowDimensions();
  const tab = width >= 600;
  const s = {
    pad: tab ? rs(16) : rs(12), disc: tab ? rs(40) : rs(34), icon: tab ? rs(20) : rs(17),
    tick: tab ? rs(24) : rs(20), title: tab ? rf(13) : rf(12), sub: tab ? rf(11) : rf(10),
  };
  const titleLH = Math.round(s.title * 1.3);
  const subLH = Math.round(s.sub * 1.35);
  const Icon = o.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${o.label}, ${o.sub}`}
      className="active:opacity-85"
      style={{
        flex: 1, alignItems: 'center', paddingTop: s.pad + rs(4), paddingBottom: s.pad, paddingHorizontal: rs(6),
        borderRadius: rs(14), borderWidth: active ? 1.5 : 1, borderColor: active ? ACCENT : BORDER, backgroundColor: active ? MINT : '#FFFFFF',
      }}
    >
      <View style={{ position: 'absolute', top: rs(7), right: rs(7), height: s.tick, width: s.tick, borderRadius: s.tick / 2, borderWidth: active ? 0 : 1.5, borderColor: '#D1D5DB', backgroundColor: active ? ACCENT : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        {active ? <Check size={Math.round(s.tick * 0.6)} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <View style={{ height: s.disc, width: s.disc, borderRadius: s.disc / 2, backgroundColor: o.color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={s.icon} color="#FFFFFF" />
      </View>
      <Text
        style={{ marginTop: rs(8), minHeight: titleLH * 2, fontSize: s.title, lineHeight: titleLH, fontWeight: '800', color: INK, textAlign: 'center' }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {o.label}
      </Text>
      <Text style={{ minHeight: subLH * 2, fontSize: s.sub, lineHeight: subLH, color: MUTED, textAlign: 'center' }} numberOfLines={2}>
        {o.sub}
      </Text>
    </Pressable>
  );
}

function Field({ label, required, optional, children }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: rf(14), fontWeight: '700', color: INK, marginBottom: 8 }}>
        {label}
        {required ? <Text style={{ color: '#DC2626' }}> *</Text> : null}
        {optional ? <Text style={{ fontWeight: '400', color: MUTED }}> (Optional)</Text> : null}
      </Text>
      {children}
    </View>
  );
}

// Brand / model tile — art (or icon / initial) over a two-line name.
function GridTile({ label, image, imageSize = 40, imageWidth, compact, padH, labelSize, icon: Icon, fallbackIcon: Fallback, on, onPress, onImagePress }) {
  const small = compact ?? imageSize <= 36;
  const fs = rf(labelSize ?? (small ? 10.5 : 12));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={label}
      className="items-center justify-center active:opacity-80"
      style={{
        minHeight: rs(small ? 78 : 112), paddingHorizontal: padH ?? (small ? 3 : 6), paddingVertical: small ? 8 : 10, borderRadius: 14,
        borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : BORDER, backgroundColor: on ? MINT : '#FFFFFF',
      }}
    >
      {on ? <TickBadge /> : null}
      {image && onImagePress ? (
        <Pressable onPress={onImagePress} hitSlop={4} accessibilityRole="imagebutton" accessibilityLabel={`View ${label} image`}>
          <DeviceImage url={image} style={{ width: imageWidth ?? imageSize, height: imageSize }} contentFit="contain" />
        </Pressable>
      ) : image ? (
        <DeviceImage url={image} style={{ width: imageWidth ?? imageSize, height: imageSize }} contentFit="contain" />
      ) : Icon ? (
        <View className="items-center justify-center" style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2, backgroundColor: MINT }}>
          <Icon size={Math.round(imageSize * 0.55)} color={ACCENT} strokeWidth={2.25} />
        </View>
      ) : Fallback ? (
        <Fallback size={Math.round(imageSize * 0.6)} color={INK} strokeWidth={1.5} />
      ) : (
        <View className="items-center justify-center" style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2, backgroundColor: PAGE_BG }}>
          <Text style={{ fontSize: Math.round(imageSize * 0.45), fontWeight: '800', color: INK }}>{String(label || '?').trim().charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text
        style={{ marginTop: 6, fontSize: fs, lineHeight: Math.round(fs * 1.25), fontWeight: on ? '700' : '500', color: INK, textAlign: 'center' }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// "Other" brand / model / value: type it — Done, ✕ or closing uses what was typed.
function TypeSheet({ config, onClose }) {
  const [text, setText] = useState('');
  useEffect(() => { setText(config?.initial || ''); }, [config]);
  const finish = () => {
    const t = text.trim();
    if (t && config?.onDone) config.onDone(t);
    onClose();
  };
  return (
    <ResponsiveModal visible={!!config} onClose={finish} maxWidth={520}>
      <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, marginBottom: 10 }} />
      <View className="flex-row items-center" style={{ marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: rf(15), fontWeight: '800', color: INK }}>{config?.title || ''}</Text>
        <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close"><X size={20} color={MUTED} /></Pressable>
      </View>
      <View className="justify-center" style={{ ...FIELD_BOX, height: INPUT_H, paddingHorizontal: 12 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          placeholder={config?.placeholder || ''}
          placeholderTextColor={PLACEHOLDER}
          cursorColor={ACCENT}
          returnKeyType="done"
          onSubmitEditing={finish}
          style={{ paddingVertical: 0, fontSize: rf(14), color: INK }}
        />
      </View>
      <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 8 }}>Press Done to use this name.</Text>
    </ResponsiveModal>
  );
}

// Folded Category / Brand / Model: art, name, Change.
function PickedCard({ image, imageSize = 36, title, subtitle, onChange }) {
  return (
    <View className="flex-row items-center" style={{ ...FIELD_BOX, padding: 10 }}>
      <View className="items-center justify-center" style={{ width: imageSize + 8, height: imageSize + 8, borderRadius: 10, backgroundColor: PAGE_BG, overflow: 'hidden' }}>
        {image ? (
          <DeviceImage url={image} style={{ width: imageSize, height: imageSize }} contentFit="contain" />
        ) : (
          <Text style={{ fontSize: Math.round(imageSize * 0.45), fontWeight: '800', color: INK }}>{String(title || '?').trim().charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
        <Text style={{ fontSize: rf(14), fontWeight: '700', color: INK }} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <ChangePill label={title} onPress={onChange} />
    </View>
  );
}

function ChangePill({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Change ${label}`}
      className="items-center justify-center active:opacity-70"
      style={{ paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1, borderColor: ACCENT }}
    >
      <Text style={{ fontSize: rf(12), fontWeight: '700', color: ACCENT }}>Change</Text>
    </Pressable>
  );
}

function SummaryLine({ label, value }) {
  return (
    <Text style={{ marginTop: 4, fontSize: rf(12), color: MUTED }} numberOfLines={1}>
      {label}: <Text style={{ fontWeight: '700', color: INK }}>{value}</Text>
    </Text>
  );
}

// Option grid that folds to its picked value (swatch + label + Change).
function FoldGrid({ valueLabel, valueSwatch, ...grid }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [valueLabel]);
  if (valueLabel && !editing) {
    return (
      <View className="flex-row items-center" style={{ ...FIELD_BOX, minHeight: INPUT_H, paddingHorizontal: 12, paddingVertical: 6 }}>
        {valueSwatch ? (
          <View style={{ height: 18, width: 18, borderRadius: 9, backgroundColor: valueSwatch, borderWidth: 1, borderColor: 'rgba(17,17,17,0.15)', marginRight: 10 }} />
        ) : null}
        <Text style={{ flex: 1, fontSize: rf(14), fontWeight: '700', color: INK }} numberOfLines={1}>{valueLabel}</Text>
        <ChangePill label={valueLabel} onPress={() => setEditing(true)} />
      </View>
    );
  }
  return <OptionGrid {...grid} />;
}

// Colour / storage / spec options as tiles; `other` adds a last "Other" tile.
function OptionGrid({ options, selected, onSelect, cols = 3, other }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
      {options.map((o) => (
        <View key={o.key} style={{ width: tilePct(cols), padding: 4 }}>
          <OptionTile label={o.label} swatch={o.swatch} on={selected === o.key} onPress={() => onSelect(o.key)} />
        </View>
      ))}
      {other ? (
        <View style={{ width: tilePct(cols), padding: 4 }}>
          <OptionTile label={other.value || 'Other'} icon={Plus} on={!!other.value} onPress={other.onPress} />
        </View>
      ) : null}
    </View>
  );
}

function OptionTile({ label, swatch, icon: Icon, on, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={label}
      className="flex-row items-center justify-center active:opacity-80"
      style={{
        minHeight: INPUT_H, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12,
        borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : BORDER, backgroundColor: on ? MINT : '#FFFFFF',
      }}
    >
      {swatch ? (
        <View style={{ height: 16, width: 16, borderRadius: 8, backgroundColor: swatch, borderWidth: 1, borderColor: 'rgba(17,17,17,0.15)', marginRight: 6 }} />
      ) : Icon ? (
        <Icon size={15} color={ACCENT} strokeWidth={2.5} style={{ marginRight: 4 }} />
      ) : null}
      <Text
        style={{ flexShrink: 1, fontSize: rf(12), lineHeight: rf(15), fontWeight: on ? '800' : '600', color: on ? ACCENT : INK, textAlign: 'center' }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}
