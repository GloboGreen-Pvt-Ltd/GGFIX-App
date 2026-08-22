import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2,
  Plus, Pencil, Trash2, ChevronRight, Wrench, CheckCircle2, HardDrive,
} from 'lucide-react-native';
import {
  BottomActionBar, Loader, Badge, EmptyState, SectionHeader, useBottomBarInset,
} from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listSavedDevices, deleteSavedDevice } from '../../../api/customer';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

// Friendly names + per-category icon for the contextual banner.
const CATEGORY_META = {
  SMARTPHONE: { name: 'Smartphones',  icon: Smartphone,  color: '#00008B', bg: 'bg-primary/10' },
  LAPTOP:     { name: 'Laptops',      icon: Laptop,      color: '#7C3AED', bg: 'bg-primary/10' },
  SMARTWATCH: { name: 'Smartwatches', icon: Watch,       color: '#B45309', bg: 'bg-warning/10' },
  TABLET:     { name: 'Tablets',      icon: Tablet,      color: '#0369A1', bg: 'bg-info/10' },
  AUDIO:      { name: 'Audio Devices', icon: Headphones, color: '#BE185D', bg: 'bg-danger/10' },
  SPEAKER:    { name: 'Speakers',     icon: Volume2,     color: '#0E9384', bg: 'bg-success/10' },
};

export default function RepairSelectDeviceScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
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

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: bottomSpace }}>
        {/* Category context banner */}
        {presetCategoryName ? (
          <View className={`border rounded-xl p-2.5 mb-3 flex-row items-center ${meta?.bg || 'bg-primary/5'} border-primary/15`}>
            <View className={`h-8 w-8 rounded-full items-center justify-center mr-2 ${meta?.bg || 'bg-primary/10'}`}>
              <Icon size={14} color={meta?.color || '#00008B'} />
            </View>
            <View className="flex-1">
              <Text className="text-text-muted uppercase tracking-widest" style={{ fontSize: rf(10) }}>Repairing</Text>
              <Text className="font-extrabold text-text" style={{ fontSize: rf(13) }}>{presetCategoryName}</Text>
            </View>
            <Badge variant="softPrimary">{items.length} SAVED</Badge>
          </View>
        ) : null}

        <SectionHeader
          title={categoryCode ? `Your ${presetCategoryName}` : 'Your Devices'}
          caption={items.length ? 'Pick one or add a new one' : 'No saved devices in this category'}
          className="mt-0 mb-2"
        />

        {items.length === 0 ? (
          <EmptyState
            icon={<Icon size={26} color={meta?.color || '#00008B'} />}
            title={categoryCode ? `No saved ${presetCategoryName?.toLowerCase()} yet` : 'No saved devices'}
            description={presetCategoryId ? 'Add the device you want to repair.' : 'Add one to book a repair.'}
          />
        ) : (
          items.map((d) => {
            const active = selectedId === d.id;
            const dMeta = d.categoryCode && CATEGORY_META[d.categoryCode];
            const DIcon = dMeta?.icon || Icon;
            return (
              <Pressable
                key={d.id}
                onPress={() => setSelectedId(d.id)}
                className={`bg-card border rounded-xl p-2.5 mb-2 active:opacity-80 ${active ? 'border-primary' : 'border-border'}`}
              >
                <View className="flex-row items-start">
                  <View className={`h-11 w-11 rounded-xl items-center justify-center mr-2.5 overflow-hidden ${active ? 'bg-primary' : (dMeta?.bg || 'bg-primary/10')}`}>
                    {deviceImage(d) ? (
                      <Image source={{ uri: deviceImage(d) }} style={{ width: 44, height: 44 }} resizeMode="cover" />
                    ) : (
                      <DIcon size={18} color={active ? '#fff' : (dMeta?.color || '#00008B')} />
                    )}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="font-extrabold text-text mr-1.5" style={{ fontSize: rf(13) }} numberOfLines={1}>
                        {deviceName(d)}
                      </Text>
                      {d.isDefault ? <Badge variant="softSuccess">DEFAULT</Badge> : null}
                    </View>
                    <View className="flex-row items-center mt-0.5 flex-wrap">
                      {d.color ? <Text className="text-text-muted mr-2" style={{ fontSize: rf(10) }}>{d.color}</Text> : null}
                      {(deviceRam(d) || deviceStorage(d)) ? (
                        <View className="flex-row items-center mr-2">
                          <HardDrive size={9} color="#64748B" />
                          <Text className="text-text-muted ml-0.5" style={{ fontSize: rf(10) }}>
                            {[deviceRam(d), deviceStorage(d)].filter(Boolean).join(' / ')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View className={`h-4 w-4 rounded-full border-2 ${active ? 'border-primary' : 'border-border'} items-center justify-center`}>
                    {active ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
                  </View>
                </View>

                {active ? (
                  <View className="flex-row mt-2 pt-2 border-t border-border -mx-1">
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
                      className="flex-1 flex-row items-center justify-center py-1.5 active:opacity-70"
                    >
                      <Pencil size={12} color="#2563EB" />
                      <Text className="font-bold text-secondary ml-1" style={{ fontSize: rf(11) }}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        const ok = await confirm({ title: 'Delete', message: 'Remove this device?', confirmText: 'Delete', destructive: true });
                        if (!ok) return;
                        try { await deleteSavedDevice(d.id); load(); } catch (e) { notify('Error', e.message); }
                      }}
                      className="flex-1 flex-row items-center justify-center py-1.5 active:opacity-70 border-l border-border"
                    >
                      <Trash2 size={12} color="#EF4444" />
                      <Text className="font-bold text-danger ml-1" style={{ fontSize: rf(11) }}>Delete</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => proceedWith(d)}
                      className="flex-1 flex-row items-center justify-center py-1.5 active:opacity-70 border-l border-border"
                    >
                      <CheckCircle2 size={12} color="#004C40" />
                      <Text className="font-bold text-success ml-1" style={{ fontSize: rf(11) }}>Use</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}

        {items.length > 0 ? (
          <View className="flex-row items-center my-3">
            <View className="flex-1 h-px bg-border" />
            <Text className="font-bold text-text-muted mx-3 uppercase tracking-widest" style={{ fontSize: rf(11) }}>or</Text>
            <View className="flex-1 h-px bg-border" />
          </View>
        ) : null}

        <Pressable
          onPress={selectOtherDevice}
          className="bg-primary/5 border border-dashed border-primary/40 rounded-xl p-3 flex-row items-center mt-1 active:opacity-80"
        >
          <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center mr-2.5">
            <Plus size={18} color="#00008B" />
          </View>
          <View className="flex-1">
            <Text className="font-extrabold text-primary" style={{ fontSize: rf(13) }}>Select Other Device</Text>
            <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }} numberOfLines={1}>
              {presetCategoryId ? 'Pick a different brand & model' : 'Pick category, brand & model'}
            </Text>
          </View>
          <ChevronRight size={16} color="#00008B" />
        </Pressable>
      </ScrollView>

      {selectedDevice ? (
        <BottomActionBar
          priceCaption="Selected"
          priceValue={deviceName(selectedDevice).split(' ').slice(0, 3).join(' ')}
          priceLabel="Continue with this"
          title="Book Repair"
          onPress={() => proceedWith(selectedDevice)}
        />
      ) : null}
    </View>
  );
}

