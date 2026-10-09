import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2,
  Plus, Pencil, Trash2, ChevronRight, Tag, CheckCircle2,
} from 'lucide-react-native';
import { BottomActionBar, Loader, useBottomBarInset } from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listSavedDevices, deleteSavedDevice } from '../../../api/customer';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

// Palette: 09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141.
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const GREEN_LINE = 'rgba(9,173,42,0.45)';
const MUTED = '#6B6B6B';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 };
const ACTION = { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 };

// Friendly names + per-category icon (palette tints) for the banner / rows.
const CATEGORY_META = {
  SMARTPHONE: { name: 'Smartphones',   icon: Smartphone, color: '#078F23', tint: '#EAF8EC' },
  LAPTOP:     { name: 'Laptops',       icon: Laptop,     color: '#1E1E1E', tint: '#F3F3F3' },
  SMARTWATCH: { name: 'Smartwatches',  icon: Watch,      color: '#1E1E1E', tint: '#FEF6DA' },
  TABLET:     { name: 'Tablets',       icon: Tablet,     color: '#078F23', tint: '#EAF8EC' },
  AUDIO:      { name: 'Audio Devices', icon: Headphones, color: '#F84141', tint: '#FEECEC' },
  SPEAKER:    { name: 'Speakers',      icon: Volume2,    color: '#078F23', tint: '#EAF8EC' },
};

export default function SellSelectDeviceScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const params = route?.params || {};
  const presetCategoryId = params.categoryId || null;
  const presetCategoryName = params.categoryName
    || (presetCategoryId && CATEGORY_META[presetCategoryId]?.name)
    || null;
  // Treat a string categoryId from the service menu (e.g. 'SMARTPHONE') as the
  // categoryCode; a real UUID stays the categoryId.
  const categoryCode = typeof presetCategoryId === 'string' && !/^[0-9a-f-]{36}$/i.test(presetCategoryId)
    ? presetCategoryId.toUpperCase()
    : (params.categoryCode || null);
  const meta = categoryCode && CATEGORY_META[categoryCode];
  const Icon = (meta?.icon) || Tag;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [brandById, setBrandById] = useState({});
  const [modelById, setModelById] = useState({});
  const [ramById, setRamById] = useState({});
  const [storageById, setStorageById] = useState({});

  const load = useCallback(async () => {
    try {
      // Filter saved devices to the chosen category (same logic as the repair
      // flow): match by UUID when present, else by categoryCode.
      const all = await listSavedDevices({});
      const isUuidCat = /^[0-9a-f-]{36}$/i.test(String(presetCategoryId || ''));
      const wantCode = (categoryCode || '').toUpperCase();
      const list = presetCategoryId
        ? all.filter((d) =>
            (isUuidCat && d.categoryId === presetCategoryId)
            || (!!wantCode && (d.categoryCode || '').toUpperCase() === wantCode))
        : all;
      setItems(list);
      const def = list.find((x) => x.isDefault) || list[0];
      if (def) setSelectedId(def.id);

      // Build lookups so each row shows its real model/image/specs.
      const [brands, rams, storages] = await Promise.all([
        getBrands().catch(() => []),
        getRamOptions().catch(() => []),
        getStorageOptions().catch(() => []),
      ]);
      const bmap = {}; (brands || []).forEach((b) => { bmap[b.id] = b; });
      const rmap = {}; (rams || []).forEach((r) => { rmap[r.id] = r; });
      const smap = {}; (storages || []).forEach((s) => { smap[s.id] = s; });
      setBrandById(bmap); setRamById(rmap); setStorageById(smap);

      const brandIds = [...new Set(list.filter((d) => d.brandId).map((d) => d.brandId))];
      if (brandIds.length) {
        const mmap = {};
        await Promise.all(brandIds.map(async (bid) => {
          const models = await getModelsByBrand(bid).catch(() => []);
          (models || []).forEach((m) => { mmap[m.id] = m; });
        }));
        setModelById(mmap);
      } else {
        setModelById({});
      }
    } finally { setLoading(false); }
  }, [presetCategoryId, categoryCode]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Deep-link from the service menu with a category: if there are no saved
  // devices for THIS category, jump straight into the device wizard (→ Select
  // Brand) instead of showing an empty page — same as the repair flow.
  useEffect(() => {
    if (!loading && presetCategoryId && items.length === 0) {
      navigation.replace('SelectBrand', {
        flow: 'SELL',
        categoryId: presetCategoryId,
        categoryName: presetCategoryName,
        categoryCode,
      });
    }
  }, [loading, presetCategoryId, presetCategoryName, categoryCode, items.length, navigation]);

  const deviceName = useCallback((d) => (
    d.modelName
    || modelById[d.modelId]?.name
    || (d.brandName || brandById[d.brandId]?.name
      ? `${d.brandName || brandById[d.brandId]?.name} device`
      : 'Device')
  ), [modelById, brandById]);
  const deviceImage = useCallback((d) => {
    const m = modelById[d.modelId];
    if (!m) return null;
    if (m.imageUrl) return m.imageUrl;
    if (m.imageBase64) return m.imageBase64.startsWith('data:') ? m.imageBase64 : `data:image/png;base64,${m.imageBase64}`;
    return null;
  }, [modelById]);
  const deviceRam = useCallback((d) => d.ramLabel || ramById[d.ramOptionId]?.label || null, [ramById]);
  const deviceStorage = useCallback((d) => d.storageLabel || storageById[d.storageOptionId]?.label || null, [storageById]);

  // Continue selling the chosen saved device — its variant (color/RAM/storage)
  // is already known, so skip the variant step and go straight to the
  // condition screen (IMEI + working/dead).
  const proceedWith = (d) => navigation.navigate('SellCondition', {
    device: {
      categoryId: d.categoryId,
      categoryCode: d.categoryCode,
      brandId: d.brandId,
      brandName: d.brandName || brandById[d.brandId]?.name,
      modelId: d.modelId,
      modelName: deviceName(d),
      ramOptionId: d.ramOptionId,
      storageOptionId: d.storageOptionId,
      ramLabel: deviceRam(d),
      storageLabel: deviceStorage(d),
      color: d.color,
      imei: d.imei,
      imageUrl: deviceImage(d) || d.imageUrl,
    },
  });

  // "Select Other Device" — pick a different brand & model. Goes straight to
  // the brand step for the current category (skips the device-type step).
  const selectOtherDevice = () => {
    if (presetCategoryId) {
      navigation.navigate('SelectBrand', {
        flow: 'SELL',
        categoryId: presetCategoryId,
        categoryName: presetCategoryName,
        categoryCode,
      });
    } else {
      navigation.navigate('SelectCategory', { flow: 'SELL' });
    }
  };

  if (loading) return <Loader label="Loading your devices..." />;

  const selectedDevice = items.find((x) => x.id === selectedId);
  const accent = meta?.color || GREEN_TEXT;
  const tint = meta?.tint || MINT;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: selectedDevice ? bottomSpace : 24 }}>
        {/* Category context banner */}
        {presetCategoryName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 9, marginBottom: 10, ...cardShadow }}>
            <View style={{ height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 9, backgroundColor: tint }}>
              <Icon size={14} color={accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(9.5), fontWeight: '700', letterSpacing: 1, color: MUTED }}>SELLING</Text>
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{presetCategoryName}</Text>
            </View>
            <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: MINT }}>
              <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: GREEN_TEXT }}>{items.length} SAVED</Text>
            </View>
          </View>
        ) : null}

        <View style={{ marginBottom: 8, paddingHorizontal: 2 }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: BRAND.ink }}>{categoryCode ? `Your ${presetCategoryName}` : 'Your Devices'}</Text>
          <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }}>{items.length ? 'Pick one or add a new one' : 'No saved devices in this category'}</Text>
        </View>

        {items.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 12, ...cardShadow }}>
            <View style={{ height: 40, width: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: tint }}>
              <Icon size={18} color={accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: BRAND.ink }}>{categoryCode ? `No saved ${presetCategoryName?.toLowerCase()} yet` : 'No saved devices'}</Text>
              <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }}>{presetCategoryId ? 'Add the device you want to sell.' : 'Add one to sell.'}</Text>
            </View>
          </View>
        ) : (
          items.map((d) => {
            const active = selectedId === d.id;
            const dMeta = d.categoryCode && CATEGORY_META[d.categoryCode];
            const DIcon = dMeta?.icon || Icon;
            const img = deviceImage(d);
            const spec = [d.color, [deviceRam(d), deviceStorage(d)].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={d.id}
                onPress={() => setSelectedId(d.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={deviceName(d)}
                className="active:opacity-90"
                style={{
                  backgroundColor: active ? '#F7FCF8' : '#FFFFFF', borderRadius: 14, padding: 10, marginBottom: 8,
                  borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : LINE, ...cardShadow,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ height: 42, width: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: img ? '#FFFFFF' : (active ? BRAND.green : (dMeta?.tint || MINT)), borderWidth: 1, borderColor: BRAND.line }}>
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: 38, height: 38 }} resizeMode="contain" />
                    ) : (
                      <DIcon size={18} color={active ? '#FFFFFF' : (dMeta?.color || GREEN_TEXT)} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 9 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ flexShrink: 1, fontSize: rf(13), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{deviceName(d)}</Text>
                      {d.isDefault ? (
                        <View style={{ marginLeft: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1.5, backgroundColor: MINT }}>
                          <Text style={{ fontSize: rf(8.5), fontWeight: '800', letterSpacing: 0.5, color: GREEN_TEXT }}>DEFAULT</Text>
                        </View>
                      ) : null}
                    </View>
                    {spec ? <Text style={{ fontSize: rf(10.5), color: MUTED, marginTop: 1 }} numberOfLines={1}>{spec}</Text> : null}
                  </View>
                  <View style={{ height: 18, width: 18, borderRadius: 9, marginLeft: 8, borderWidth: 2, borderColor: active ? BRAND.green : '#C9C9C9', alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <View style={{ height: 9, width: 9, borderRadius: 5, backgroundColor: BRAND.green }} /> : null}
                  </View>
                </View>

                {active ? (
                  <View style={{ flexDirection: 'row', marginTop: 9, paddingTop: 7, borderTopWidth: 1, borderTopColor: BRAND.line }}>
                    <Pressable
                      onPress={() => navigation.navigate('SelectVariant', {
                        flow: 'PROFILE',
                        deviceId: d.id,
                        categoryId: d.categoryId,
                        categoryCode: d.categoryCode,
                        brandId: d.brandId,
                        brandName: d.brandName || brandById[d.brandId]?.name,
                        modelId: d.modelId,
                        modelName: deviceName(d),
                        ramOptionId: d.ramOptionId,
                        storageOptionId: d.storageOptionId,
                        color: d.color,
                      })}
                      accessibilityRole="button"
                      className="active:opacity-70"
                      style={ACTION}
                    >
                      <Pencil size={12} color={BRAND.ink} />
                      <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: BRAND.ink }}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        const ok = await confirm({ title: 'Delete', message: 'Remove this device?', confirmText: 'Delete', destructive: true });
                        if (!ok) return;
                        try { await deleteSavedDevice(d.id); load(); } catch (e) { notify('Error', e.message); }
                      }}
                      accessibilityRole="button"
                      className="active:opacity-70"
                      style={{ ...ACTION, borderLeftWidth: 1, borderLeftColor: BRAND.line }}
                    >
                      <Trash2 size={12} color={BRAND.red} />
                      <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: BRAND.red }}>Delete</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => proceedWith(d)}
                      accessibilityRole="button"
                      className="active:opacity-70"
                      style={{ ...ACTION, borderLeftWidth: 1, borderLeftColor: BRAND.line }}
                    >
                      <CheckCircle2 size={12} color={GREEN_TEXT} />
                      <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: GREEN_TEXT }}>Use</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}

        {items.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: LINE }} />
            <Text style={{ marginHorizontal: 10, fontSize: rf(10.5), fontWeight: '700', letterSpacing: 1, color: MUTED }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: LINE }} />
          </View>
        ) : null}

        <Pressable
          onPress={selectOtherDevice}
          accessibilityRole="button"
          accessibilityLabel="Select Other Device"
          className="active:opacity-85"
          style={{
            flexDirection: 'row', alignItems: 'center', marginTop: items.length ? 0 : 10,
            backgroundColor: '#F4FBF5', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: GREEN_LINE,
            paddingVertical: 9, paddingHorizontal: 10,
          }}
        >
          <View style={{ height: 32, width: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 9, backgroundColor: MINT }}>
            <Plus size={16} color={GREEN_TEXT} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: GREEN_TEXT }}>Select Other Device</Text>
            <Text style={{ fontSize: rf(10.5), color: MUTED, marginTop: 1 }} numberOfLines={1}>
              {presetCategoryId ? 'Pick a different brand & model' : 'Pick category, brand & model'}
            </Text>
          </View>
          <ChevronRight size={16} color={GREEN_TEXT} />
        </Pressable>
      </ScrollView>

      {selectedDevice ? (
        <BottomActionBar>
          {/* Same action as before: continue selling the selected saved device. */}
          <Pressable
            onPress={() => proceedWith(selectedDevice)}
            accessibilityRole="button"
            accessibilityLabel="Sell Device"
            className="active:opacity-90"
            style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: BRAND.green }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(9.5), fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.85)' }}>SELECTED</Text>
              <Text style={{ marginTop: 1, fontSize: rf(13), fontWeight: '800', color: '#FFFFFF' }} numberOfLines={1}>{deviceName(selectedDevice)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#FFFFFF' }}>Sell Device</Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </BottomActionBar>
      ) : null}
    </View>
  );
}
