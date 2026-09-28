import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2,
  Plus, Pencil, Trash2, ChevronRight, Wrench, CheckCircle2, HardDrive, ArrowLeft,
} from 'lucide-react-native';
import {
  BottomActionBar, Loader, Badge, EmptyState, SectionHeader, useBottomBarInset,
} from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listSavedDevices, deleteSavedDevice } from '../../../api/customer';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const DEEP = '#004C40';
const PRIMARY = '#006B57';
const MINT = '#E8F7F2';
const SOFT_MINT = '#F4FBF8';
const SOFT_BLUE = '#EEF4FF';
const BORDER = '#DCE7E2';
const INK = '#111827';
const MUTED = '#667085';

// Friendly names + per-category icon for the contextual banner.
const CATEGORY_META = {
  SMARTPHONE: { name: 'Smartphones',  icon: Smartphone,  color: '#00008B', bg: 'bg-primary/10' },
  LAPTOP:     { name: 'Laptops',      icon: Laptop,      color: '#7C3AED', bg: 'bg-primary/10' },
  SMARTWATCH: { name: 'Smartwatches', icon: Watch,       color: '#B45309', bg: 'bg-warning/10' },
  TABLET:     { name: 'Tablets',      icon: Tablet,      color: '#0369A1', bg: 'bg-info/10' },
  AUDIO:      { name: 'Audio Devices', icon: Headphones, color: '#BE185D', bg: 'bg-danger/10' },
  SPEAKER:    { name: 'Speakers',     icon: Volume2,     color: '#0E9384', bg: 'bg-success/10' },
};

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function CardAction({ icon: Icon, label, color, onPress, divider }) {
  return (
    <>
      {divider ? <View style={{ width: 1, height: 20, backgroundColor: BORDER }} /> : null}
      <Pressable
        onPress={onPress}
        className="active:opacity-70"
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38 }}
      >
        <Icon size={16} color={color} />
        <Text style={{ marginLeft: 6, fontSize: rf(13), fontWeight: '700', color }}>{label}</Text>
      </Pressable>
    </>
  );
}

export default function RepairSelectDeviceScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  // This screen draws its own header (round back button + centred title), so
  // the stack's default header is hidden here. Route and title are unchanged.
  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);
  const params = route?.params || {};
  const presetCategoryId = params.categoryId || null;
  const presetCategoryName = params.categoryName
    || (presetCategoryId && CATEGORY_META[presetCategoryId]?.name)
    || null;
  // Treat the categoryId from Home tiles as the categoryCode (e.g. 'SMARTPHONE').
  const categoryCode = typeof presetCategoryId === 'string' && !/^[0-9a-f-]{36}$/i.test(presetCategoryId)
    ? presetCategoryId.toUpperCase()
    : (params.categoryCode || null);
  const meta = categoryCode && CATEGORY_META[categoryCode];
  const Icon = (meta?.icon) || Wrench;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  // Lookups to resolve name/image/specs from IDs for rows that didn't store
  // denormalized labels (older records / older backend builds).
  const [brandById, setBrandById] = useState({});
  const [modelById, setModelById] = useState({});
  const [ramById, setRamById] = useState({});
  const [storageById, setStorageById] = useState({});

  const load = useCallback(async () => {
    try {
      // Filter client-side by category UUID (reliable) with categoryCode as a
      // fallback. Filtering only by categoryCode broke when a saved row had a
      // null/legacy code — e.g. a Mobile device leaking into the Laptop flow.
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

  const proceedWith = (d) => navigation.navigate('RepairSelectService', {
    device: {
      ...d,
      modelName: deviceName(d),
      brandName: d.brandName || brandById[d.brandId]?.name,
      ramLabel: deviceRam(d),
      storageLabel: deviceStorage(d),
      imageUrl: deviceImage(d) || d.imageUrl,
    },
  });

  // "Select Other Device" — pick a different brand & model. Goes straight to
  // the brand step for the current category (skips the device-type step).
  const selectOtherDevice = () => {
    if (presetCategoryId) {
      navigation.navigate('SelectBrand', {
        flow: 'REPAIR',
        categoryId: presetCategoryId,
        categoryName: presetCategoryName,
        categoryCode,
      });
    } else {
      navigation.navigate('SelectCategory', { flow: 'REPAIR' });
    }
  };

  // Deep-link from a Home tile with category: if user has no matching saved
  // devices for THIS category, jump straight to brand picker â€” no empty page.
  useEffect(() => {
    if (!loading && presetCategoryId && items.length === 0) {
      navigation.replace('SelectBrand', {
        flow: 'REPAIR',
        categoryId: presetCategoryId,
        categoryName: presetCategoryName,
        categoryCode,
      });
    }
  }, [loading, presetCategoryId, presetCategoryName, categoryCode, items.length, navigation]);

  if (loading) return <Loader label="Loading your devices..." />;

  const selectedDevice = items.find((x) => x.id === selectedId);

  const selectedImage = selectedDevice ? (deviceImage(selectedDevice) || selectedDevice.imageUrl) : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header — round soft-blue back button + centred title. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            className="active:opacity-80"
            style={{ height: 46, width: 46, borderRadius: 23, backgroundColor: SOFT_BLUE, alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={21} color={INK} />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: rf(18), fontWeight: '800', color: INK }}>
            Select Device
          </Text>
          <View style={{ width: 46 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottomSpace }}>
        {/* Repairing summary */}
        {presetCategoryName ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: SOFT_MINT, borderWidth: 1, borderColor: '#D5EDE3', borderRadius: 22,
              paddingVertical: 12, paddingLeft: 12, paddingRight: 12, marginBottom: 16,
            }}
          >
            <View style={{ height: 44, width: 44, borderRadius: 22, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Icon size={20} color={DEEP} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(10.5), color: MUTED, letterSpacing: 1.6, fontWeight: '600' }}>REPAIRING</Text>
              <Text style={{ fontSize: rf(17), fontWeight: '800', color: INK, marginTop: 1 }} numberOfLines={1}>{presetCategoryName}</Text>
            </View>
            <View style={{ backgroundColor: MINT, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
              <Text style={{ color: DEEP, fontSize: rf(12), fontWeight: '800', letterSpacing: 0.8 }}>{items.length} SAVED</Text>
            </View>
          </View>
        ) : null}

        <Text style={{ fontSize: rf(20), fontWeight: '800', color: INK }}>
          {categoryCode ? `Your ${presetCategoryName}` : 'Your Devices'}
        </Text>
        <Text style={{ fontSize: rf(13), color: MUTED, marginTop: 2, marginBottom: 12 }}>
          {items.length ? 'Pick one or add a new one' : 'No saved devices in this category'}
        </Text>

        {items.length === 0 ? (
          <EmptyState
            icon={<Icon size={26} color={meta?.color || DEEP} />}
            title={categoryCode ? `No saved ${presetCategoryName?.toLowerCase()} yet` : 'No saved devices'}
            description={presetCategoryId ? 'Add the device you want to repair.' : 'Add one to book a repair.'}
          />
        ) : (
          items.map((d) => {
            const active = selectedId === d.id;
            const dMeta = d.categoryCode && CATEGORY_META[d.categoryCode];
            const DIcon = dMeta?.icon || Icon;
            const img = deviceImage(d);
            return (
              <Pressable
                key={d.id}
                onPress={() => setSelectedId(d.id)}
                className="active:opacity-90"
                style={{
                  backgroundColor: active ? '#FAFDFB' : '#fff',
                  borderWidth: active ? 1.5 : 1, borderColor: active ? PRIMARY : BORDER,
                  borderRadius: 20, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, marginBottom: 10,
                  shadowColor: '#0F172A', shadowOpacity: active ? 0.08 : 0.04, shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 }, elevation: active ? 3 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      height: 60, width: 52, borderRadius: 12, marginRight: 12, overflow: 'hidden',
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: img ? '#fff' : MINT,
                      shadowColor: '#0F172A', shadowOpacity: img ? 0.06 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: img ? 1 : 0,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: 48, height: 56 }} resizeMode="contain" />
                    ) : (
                      <DIcon size={22} color={DEEP} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: rf(16), fontWeight: '800', color: INK, marginRight: 6, flexShrink: 1 }} numberOfLines={1}>
                        {deviceName(d)}
                      </Text>
                      {d.isDefault ? <Badge variant="softSuccess">DEFAULT</Badge> : null}
                    </View>
                    {d.color ? (
                      <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 1 }} numberOfLines={1}>{d.color}</Text>
                    ) : null}
                    {(deviceRam(d) || deviceStorage(d)) ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <HardDrive size={13} color={MUTED} />
                        <Text style={{ fontSize: rf(12), color: MUTED, marginLeft: 5 }} numberOfLines={1}>
                          {[deviceRam(d), deviceStorage(d)].filter(Boolean).join(' / ')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {/* Radio — follows the existing selectedId. */}
                  <View
                    style={{
                      height: 22, width: 22, borderRadius: 11, alignSelf: 'center',
                      borderWidth: 2.5, borderColor: active ? DEEP : '#CBD5E1',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {active ? <View style={{ height: 11, width: 11, borderRadius: 6, backgroundColor: PRIMARY }} /> : null}
                  </View>
                </View>

                {active ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 2, borderTopWidth: 1, borderTopColor: BORDER }}>
                    <CardAction
                      icon={Pencil}
                      label="Edit"
                      color="#2563EB"
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
                    />
                    <CardAction
                      icon={Trash2}
                      label="Delete"
                      color="#EF4444"
                      divider
                      onPress={async () => {
                        const ok = await confirm({ title: 'Delete', message: 'Remove this device?', confirmText: 'Delete', destructive: true });
                        if (!ok) return;
                        try { await deleteSavedDevice(d.id); load(); } catch (e) { notify('Error', e.message); }
                      }}
                    />
                    <CardAction icon={CheckCircle2} label="Use" color={DEEP} divider onPress={() => proceedWith(d)} />
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}

        {items.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 14 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
            <Text style={{ marginHorizontal: 14, fontSize: rf(13), fontWeight: '600', color: MUTED, letterSpacing: 0.5 }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
          </View>
        ) : null}

        {/* Select Other Device — dashed card, same handler. */}
        <Pressable
          onPress={selectOtherDevice}
          className="active:opacity-85"
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: SOFT_MINT, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9ED3BF',
            borderRadius: 22, paddingVertical: 14, paddingLeft: 14, paddingRight: 12, marginTop: items.length ? 0 : 8,
          }}
        >
          <View style={{ height: 52, width: 52, borderRadius: 26, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Plus size={24} color={DEEP} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(16), fontWeight: '800', color: DEEP }}>Select Other Device</Text>
            <Text style={{ fontSize: rf(12.5), color: MUTED, marginTop: 3 }} numberOfLines={1}>
              {presetCategoryId ? 'Pick a different brand & model' : 'Pick category, brand & model'}
            </Text>
          </View>
          <ChevronRight size={22} color={DEEP} />
        </Pressable>
      </ScrollView>

      {/* Sticky bottom bar — selected device summary · Book Repair. Same
          visibility rule (only with a selection) and same proceedWith(). */}
      {selectedDevice ? (
        <BottomActionBar>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 }}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={{ width: 38, height: 50, marginRight: 8 }} resizeMode="contain" />
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: rf(10.5), color: MUTED, letterSpacing: 1.2, fontWeight: '600' }}>SELECTED</Text>
                <Text style={{ fontSize: rf(16), fontWeight: '800', color: INK }} numberOfLines={1}>
                  {deviceName(selectedDevice).split(' ').slice(0, 3).join(' ')}
                </Text>
                <Text style={{ fontSize: rf(12), color: MUTED }} numberOfLines={1}>Continue with this</Text>
              </View>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: BORDER, marginRight: 12 }} />
            <Pressable
              onPress={() => proceedWith(selectedDevice)}
              accessibilityRole="button"
              className="active:opacity-90"
              style={{
                flexBasis: '47%', height: 58, borderRadius: 22,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: DEEP,
                shadowColor: DEEP, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: rf(16), fontWeight: '800', marginRight: 6 }}>Book Repair</Text>
              <ChevronRight size={20} color="#fff" />
            </Pressable>
          </View>
        </BottomActionBar>
      ) : null}
    </View>
  );
}
