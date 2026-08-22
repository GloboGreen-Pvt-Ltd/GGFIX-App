import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2,
  Plus, Pencil, Trash2, Star, ChevronRight, HardDrive, Hash,
} from 'lucide-react-native';
import {
  Loader, EmptyState, Badge, SectionHeader, Chip,
} from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listSavedDevices, deleteSavedDevice, setDefaultSavedDevice } from '../../../api/customer';
import { getDeviceCategories, getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const CATEGORY_META = {
  MOBILE:     { name: 'Mobile',        icon: Smartphone,  color: '#00008B', bg: 'bg-primary/10' },
  LAPTOP:     { name: 'Laptops',       icon: Laptop,      color: '#7C3AED', bg: 'bg-primary/10' },
  SMARTWATCH: { name: 'Smartwatches',  icon: Watch,       color: '#B45309', bg: 'bg-warning/10' },
  TABLET:     { name: 'Tablets',       icon: Tablet,      color: '#0369A1', bg: 'bg-info/10' },
  AUDIO:      { name: 'Audio Devices', icon: Headphones,  color: '#BE185D', bg: 'bg-danger/10' },
  SPEAKER:    { name: 'Speakers',      icon: Volume2,     color: '#0E9384', bg: 'bg-success/10' },
};

// Saved devices store admin-derived codes (Mobile -> MOBILE, Smartwatches ->
// SMARTWATCHES). Normalize singular/plural/legacy codes to one canonical key.
const CODE_ALIASES = {
  MOBILE: 'MOBILE', SMARTPHONE: 'MOBILE', SMARTPHONES: 'MOBILE',
  LAPTOP: 'LAPTOP', LAPTOPS: 'LAPTOP',
  SMARTWATCH: 'SMARTWATCH', SMARTWATCHES: 'SMARTWATCH', WATCH: 'SMARTWATCH', WATCHES: 'SMARTWATCH',
  TABLET: 'TABLET', TABLETS: 'TABLET',
  AUDIO: 'AUDIO', AUDIO_DEVICES: 'AUDIO', AUDIO_DEVICE: 'AUDIO',
  SPEAKER: 'SPEAKER', SPEAKERS: 'SPEAKER',
};
const canonCode = (code) => CODE_ALIASES[(code || '').toUpperCase()] || (code || '').toUpperCase() || 'OTHER';

const FILTERS = [
  { key: 'ALL',        label: 'All' },
  { key: 'MOBILE',     label: 'Phones' },
  { key: 'LAPTOP',     label: 'Laptops' },
  { key: 'SMARTWATCH', label: 'Watches' },
  { key: 'TABLET',     label: 'Tablets' },
  { key: 'AUDIO',      label: 'Audio' },
];

export default function ManageDeviceScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  // Lookups so we can resolve names from IDs when the saved row didn't store
  // denormalized labels (older records / older backend builds).
  const [catById, setCatById] = useState({});
  const [brandById, setBrandById] = useState({});
  const [modelById, setModelById] = useState({});
  const [ramById, setRamById] = useState({});
  const [storageById, setStorageById] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSavedDevices();
      setItems(list);

      const [cats, brands, rams, storages] = await Promise.all([
        getDeviceCategories().catch(() => []),
        getBrands().catch(() => []),
        getRamOptions().catch(() => []),
        getStorageOptions().catch(() => []),
      ]);
      const cmap = {};
      (cats || []).forEach((c) => { cmap[c.id] = c; });
      const bmap = {};
      (brands || []).forEach((b) => { bmap[b.id] = b; });
      const rmap = {};
      (rams || []).forEach((r) => { rmap[r.id] = r; });
      const smap = {};
      (storages || []).forEach((s) => { smap[s.id] = s; });
      setCatById(cmap);
      setBrandById(bmap);
      setRamById(rmap);
      setStorageById(smap);

      // Fetch models for every brand present so we can resolve names + images.
      const brandIds = [...new Set((list || []).filter((d) => d.brandId).map((d) => d.brandId))];
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
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Resolve a device's category code from its stored code or its categoryId.
  const deviceCode = useCallback(
    (d) => canonCode(d.categoryCode || catById[d.categoryId]?.code),
    [catById],
  );
  // Resolve a device's display name from stored name, model lookup, or brand.
  const deviceName = useCallback((d) => (
    d.modelName
    || modelById[d.modelId]?.name
    || (d.brandName || brandById[d.brandId]?.name
      ? `${d.brandName || brandById[d.brandId]?.name} device`
      : 'Device')
  ), [modelById, brandById]);
  const deviceImage = useCallback((d) => {
    const m = modelById[d.modelId];
    return (m && (m.imageUrl || m.imageBase64)) || null;
  }, [modelById]);
  const deviceRam = useCallback((d) => d.ramLabel || ramById[d.ramOptionId]?.label || null, [ramById]);
  const deviceStorage = useCallback((d) => d.storageLabel || storageById[d.storageOptionId]?.label || null, [storageById]);

  const onDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete device',
      message: 'Remove this device from your saved list?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteSavedDevice(id); load(); } catch (e) { notify('Error', e.message); }
  };

  const onDefault = async (id) => {
    try { await setDefaultSavedDevice(id); load(); } catch (e) { notify('Error', e.message); }
  };

  const onAdd = () => navigation.navigate('SelectCategory', { flow: 'PROFILE' });

  const onEdit = (d) => navigation.navigate('SelectVariant', {
    flow: 'PROFILE',
    deviceId: d.id,
    categoryId: d.categoryId,
    categoryCode: d.categoryCode || catById[d.categoryId]?.code,
    brandId: d.brandId,
    brandName: d.brandName || brandById[d.brandId]?.name,
    modelId: d.modelId,
    modelName: deviceName(d),
    ramOptionId: d.ramOptionId,
    storageOptionId: d.storageOptionId,
    color: d.color,
    imei: d.imei,
    note: d.note,
  });

  // Group by category for the section view
  const grouped = useMemo(() => {
    const filtered = filter === 'ALL'
      ? items
      : items.filter((d) => deviceCode(d) === filter);
    const map = new Map();
    for (const d of filtered) {
      const key = deviceCode(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
    return Array.from(map.entries());
  }, [items, filter, deviceCode]);

  if (loading) return <Loader label="Loading your devices..." />;

  return (
    <View className="flex-1 bg-background">
      {/* Filter chips */}
      <View className="bg-card border-b border-border px-3 pt-2 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          {FILTERS.map((f) => {
            const count = f.key === 'ALL'
              ? items.length
              : items.filter((d) => deviceCode(d) === f.key).length;
            return (
              <Chip
                key={f.key}
                label={count > 0 ? `${f.label} (${count})` : f.label}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
        {items.length === 0 ? (
          <EmptyState
            icon={<Smartphone size={26} color="#00008B" />}
            title="No saved devices yet"
            description="Add a device to speed up your repair bookings."
          />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<Smartphone size={26} color="#00008B" />}
            title="No devices in this category"
            description="Switch filter or add a new device below."
          />
        ) : (
          grouped.map(([catCode, devices]) => {
            const meta = CATEGORY_META[catCode] || {
              name: 'Other', icon: Smartphone, color: '#64748B', bg: 'bg-background',
            };
            const Icon = meta.icon;
            return (
              <View key={catCode} className="mb-3">
                <View className="flex-row items-center mb-1.5">
                  <View className={`h-7 w-7 rounded-lg items-center justify-center mr-2 ${meta.bg}`}>
                    <Icon size={14} color={meta.color} />
                  </View>
                  <Text className="font-extrabold text-text flex-1" style={{ fontSize: rf(12) }}>
                    {meta.name}
                  </Text>
                  <Text className="text-text-muted" style={{ fontSize: rf(10) }}>{devices.length} saved</Text>
                </View>

                {devices.map((d) => (
                  <View
                    key={d.id}
                    className="bg-card border border-border rounded-xl p-2.5 mb-2"
                    style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
                  >
                    {/* Row 1: icon + name + default star */}
                    <View className="flex-row items-start">
                      <View className={`h-11 w-11 rounded-xl items-center justify-center mr-2.5 overflow-hidden ${meta.bg}`}>
                        {deviceImage(d) ? (
                          <Image source={{ uri: deviceImage(d) }} style={{ width: 44, height: 44 }} resizeMode="cover" />
                        ) : (
                          <Icon size={18} color={meta.color} />
                        )}
                      </View>
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center">
                          <Text className="font-extrabold text-text flex-1" style={{ fontSize: rf(13) }} numberOfLines={1}>
                            {deviceName(d)}
                          </Text>
                          {d.isDefault ? <Badge variant="softSuccess">DEFAULT</Badge> : null}
                        </View>
                        <View className="flex-row items-center mt-0.5 flex-wrap">
                          {d.color ? (
                            <Text className="text-text-muted mr-2" style={{ fontSize: rf(10) }}>{d.color}</Text>
                          ) : null}
                          {(deviceRam(d) || deviceStorage(d)) ? (
                            <View className="flex-row items-center mr-2">
                              <HardDrive size={9} color="#64748B" />
                              <Text className="text-text-muted ml-0.5" style={{ fontSize: rf(10) }}>
                                {[deviceRam(d), deviceStorage(d)].filter(Boolean).join(' / ')}
                              </Text>
                            </View>
                          ) : null}
                          {d.imei ? (
                            <View className="flex-row items-center">
                              <Hash size={9} color="#64748B" />
                              <Text className="text-text-muted ml-0.5" style={{ fontSize: rf(10) }} numberOfLines={1}>
                                {d.imei}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => !d.isDefault && onDefault(d.id)}
                        hitSlop={8}
                        className="active:opacity-70"
                      >
                        <Star
                          size={18}
                          color={d.isDefault ? '#F59E0B' : '#CBD5E1'}
                          fill={d.isDefault ? '#F59E0B' : 'transparent'}
                        />
                      </Pressable>
                    </View>

                    {d.note ? (
                      <Text className="text-text-muted mt-1.5" style={{ fontSize: rf(10) }} numberOfLines={2}>
                        Note: {d.note}
                      </Text>
                    ) : null}

                    {/* Actions */}
                    <View className="flex-row mt-2 pt-1.5 border-t border-border -mx-0.5">
                      <Pressable
                        onPress={() => onEdit(d)}
                        className="flex-1 flex-row items-center justify-center py-1 active:opacity-70"
                      >
                        <Pencil size={11} color="#2563EB" />
                        <Text className="ml-1 font-bold text-secondary" style={{ fontSize: rf(10) }}>Edit</Text>
                      </Pressable>
                      {!d.isDefault ? (
                        <Pressable
                          onPress={() => onDefault(d.id)}
                          className="flex-1 flex-row items-center justify-center py-1 active:opacity-70 border-l border-border"
                        >
                          <Star size={11} color="#F59E0B" />
                          <Text className="ml-1 font-bold text-warning" style={{ fontSize: rf(10) }}>Set Default</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => onDelete(d.id)}
                        className="flex-1 flex-row items-center justify-center py-1 active:opacity-70 border-l border-border"
                      >
                        <Trash2 size={11} color="#EF4444" />
                        <Text className="ml-1 font-bold text-danger" style={{ fontSize: rf(10) }}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}

        {/* Add device CTA */}
        <Pressable
          onPress={onAdd}
          className="bg-primary/5 border border-dashed border-primary/40 rounded-xl p-3 flex-row items-center mt-1 active:opacity-80"
        >
          <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center mr-2.5">
            <Plus size={18} color="#00008B" />
          </View>
          <View className="flex-1">
            <Text className="font-extrabold text-primary" style={{ fontSize: rf(13) }}>Add a new device</Text>
            <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }} numberOfLines={1}>
              Pick category, brand & model
            </Text>
          </View>
          <ChevronRight size={16} color="#00008B" />
        </Pressable>
      </ScrollView>
    </View>
  );
}
