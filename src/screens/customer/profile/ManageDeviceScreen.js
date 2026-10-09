import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2,
  Plus, Pencil, Trash2, Star, ChevronRight, HardDrive, Hash,
} from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listSavedDevices, deleteSavedDevice, setDefaultSavedDevice } from '../../../api/customer';
import { getDeviceCategories, getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';
import { BRAND } from '../../../theme/brand';
import { tintFor } from '../../../theme/categoryTints';
import { rf } from '../../../utils/responsive';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 };

const CATEGORY_META = {
  MOBILE:     { name: 'Mobile',        icon: Smartphone },
  LAPTOP:     { name: 'Laptops',       icon: Laptop },
  SMARTWATCH: { name: 'Smartwatches',  icon: Watch },
  TABLET:     { name: 'Tablets',       icon: Tablet },
  AUDIO:      { name: 'Audio Devices', icon: Headphones },
  SPEAKER:    { name: 'Speakers',      icon: Volume2 },
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

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-80"
      style={{
        height: 32, paddingHorizontal: 14, borderRadius: 16, marginRight: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? BRAND.green : '#FFFFFF', borderWidth: 1, borderColor: active ? BRAND.green : LINE,
      }}
    >
      <Text style={{ fontSize: rf(12), fontWeight: '700', color: active ? '#FFFFFF' : BRAND.ink }}>{label}</Text>
    </Pressable>
  );
}

function CardAction({ icon: Icon, label, color, textColor = BRAND.ink, onPress, divider }) {
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-70"
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 5, borderLeftWidth: divider ? 1 : 0, borderLeftColor: BRAND.line }}
    >
      <Icon size={13} color={color} />
      <Text style={{ marginLeft: 5, fontSize: rf(11), fontWeight: '700', color: textColor }}>{label}</Text>
    </Pressable>
  );
}

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
  // Normalised source: data: prefix for base64, JPEG for Cloudinary .avif.
  const deviceImage = useCallback((d) => {
    const m = modelById[d.modelId];
    return m ? resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 }) : null;
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
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      {/* Filter chips */}
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 12, paddingVertical: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          {FILTERS.map((f) => {
            const count = f.key === 'ALL'
              ? items.length
              : items.filter((d) => deviceCode(d) === f.key).length;
            return (
              <FilterChip
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
            icon={<Smartphone size={28} color={BRAND.green} />}
            accentSoft="#EAF8EC"
            title="No saved devices yet"
            description="Add a device to speed up your repair bookings."
          />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<Smartphone size={28} color={BRAND.green} />}
            accentSoft="#EAF8EC"
            title="No devices in this category"
            description="Switch filter or add a new device below."
          />
        ) : (
          grouped.map(([catCode, devices]) => {
            const meta = CATEGORY_META[catCode] || { name: 'Other', icon: Smartphone };
            const Icon = meta.icon;
            const tint = tintFor(catCode);
            return (
              <View key={catCode} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ height: 24, width: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 7, backgroundColor: tint }}>
                    <Icon size={13} color={BRAND.green} />
                  </View>
                  <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>{meta.name}</Text>
                  <Text style={{ fontSize: rf(10.5), color: BRAND.muted }}>{devices.length} saved</Text>
                </View>

                {devices.map((d) => {
                  const img = deviceImage(d);
                  const specs = [deviceRam(d), deviceStorage(d)].filter(Boolean).join(' / ');
                  return (
                    <View key={d.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 10, marginBottom: 8, ...cardShadow }}>
                      {/* Row 1: image + name + default star */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ height: 46, width: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden', backgroundColor: tint }}>
                          {img ? (
                            <Image source={{ uri: img }} style={{ width: 42, height: 42 }} resizeMode="contain" />
                          ) : (
                            <Icon size={20} color={BRAND.green} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: rf(13), fontWeight: '800', color: BRAND.ink }}>{deviceName(d)}</Text>
                            {d.isDefault ? (
                              <View style={{ marginLeft: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#EAF8EC' }}>
                                <Text style={{ fontSize: rf(9), fontWeight: '800', color: GREEN_TEXT, letterSpacing: 0.4 }}>DEFAULT</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                            {d.color ? <Text style={{ fontSize: rf(10.5), color: BRAND.muted, marginRight: 8 }}>{d.color}</Text> : null}
                            {specs ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                                <HardDrive size={10} color={BRAND.muted} />
                                <Text style={{ fontSize: rf(10.5), color: BRAND.muted, marginLeft: 3 }}>{specs}</Text>
                              </View>
                            ) : null}
                            {d.imei ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Hash size={10} color={BRAND.muted} />
                                <Text numberOfLines={1} style={{ fontSize: rf(10.5), color: BRAND.muted, marginLeft: 3 }}>{d.imei}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Pressable onPress={() => !d.isDefault && onDefault(d.id)} hitSlop={8} className="active:opacity-70">
                          <Star size={18} color={d.isDefault ? BRAND.yellow : '#C9C9C9'} fill={d.isDefault ? BRAND.yellow : 'transparent'} />
                        </Pressable>
                      </View>

                      {d.note ? (
                        <Text numberOfLines={2} style={{ fontSize: rf(10.5), color: BRAND.muted, marginTop: 6 }}>Note: {d.note}</Text>
                      ) : null}

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: BRAND.line }}>
                        <CardAction icon={Pencil} label="Edit" color={BRAND.green} onPress={() => onEdit(d)} />
                        {!d.isDefault ? (
                          <CardAction icon={Star} label="Set Default" color={BRAND.yellow} onPress={() => onDefault(d.id)} divider />
                        ) : null}
                        <CardAction icon={Trash2} label="Delete" color={BRAND.red} textColor={BRAND.red} onPress={() => onDelete(d.id)} divider />
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        {/* Add device CTA */}
        <Pressable
          onPress={onAdd}
          className="active:opacity-80"
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderStyle: 'dashed', borderColor: BRAND.greenLine }}
        >
          <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: '#EAF8EC', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Plus size={18} color={BRAND.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: GREEN_TEXT }}>Add a new device</Text>
            <Text numberOfLines={1} style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 2 }}>Pick category, brand & model</Text>
          </View>
          <ChevronRight size={16} color={BRAND.green} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
