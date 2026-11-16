import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Smartphone, Laptop, Watch, Tablet, Headphones, Volume2,
  Plus, Pencil, Trash2, Star, ChevronRight, HardDrive, Hash, LayoutGrid,
} from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listSavedDevices, deleteSavedDevice, setDefaultSavedDevice } from '../../../api/customer';
import { getDeviceCategories, getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';
import { BRAND } from '../../../theme/brand';
import { tintFor } from '../../../theme/categoryTints';
import { rf } from '../../../utils/responsive';
import { resolveSpecCategory } from '../../../utils/deviceSpecs';
import { imeiApplies } from '../../../utils/imeiPolicy';

const GREEN_TEXT = '#035C6C'; // #035C6C shaded for text on white
const LINE = '#E8EAEE';
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

  // Add → the one-page device picker (same as Repair).
  const onAdd = () => navigation.navigate('DeviceDetails', { flow: 'PROFILE' });

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

  // Service-orders design: white category rail (left) + device tiles (right).
  const RAIL = [
    { key: 'ALL',        label: 'All',     icon: LayoutGrid, tone: '#035C6C' },
    { key: 'MOBILE',     label: 'Phones',  icon: Smartphone, tone: '#0788C9' },
    { key: 'LAPTOP',     label: 'Laptops', icon: Laptop,     tone: '#609138' },
    { key: 'SMARTWATCH', label: 'Watches', icon: Watch,      tone: '#F09406' },
    { key: 'TABLET',     label: 'Tablets', icon: Tablet,     tone: '#357D89' },
    { key: 'AUDIO',      label: 'Audio',   icon: Headphones, tone: '#1C3053' },
  ];
  const countOf = (k) => (k === 'ALL' ? items.length : items.filter((d) => deviceCode(d) === k).length);
  const shown = grouped.flatMap(([, devices]) => devices);
  const TEAL = '#035C6C';
  const MINTD = '#E5F3F5';
  const TileAction = ({ icon: I, label, color = TEAL, onPress }) => (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} className="active:opacity-70"
      style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: MINTD, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
      <I size={14} color={color} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#FFFFFF' }}>
      {/* Left: category rail (flat white tiles, count badges). */}
      <ScrollView
        style={{ width: 92, flexGrow: 0, borderRightWidth: 1, borderRightColor: LINE, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 6, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {RAIL.map((r) => {
          const I = r.icon;
          const active = filter === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => setFilter(r.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className="active:opacity-80"
              style={{ marginVertical: 4, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: active ? 2 : 1, borderColor: active ? TEAL : '#E5E7EB', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 3 }}
            >
              <View>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: r.tone, alignItems: 'center', justifyContent: 'center' }}>
                  <I size={17} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <View style={{ position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: r.tone, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: r.tone }}>{countOf(r.key)}</Text>
                </View>
              </View>
              <Text style={{ marginTop: 5, fontSize: rf(11), fontWeight: active ? '800' : '700', color: '#111111', textAlign: 'center' }} numberOfLines={1}>{r.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Right: device tiles. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, paddingBottom: 100 }}>
        {items.length === 0 ? (
          <EmptyState
            icon={<Smartphone size={28} color={BRAND.green} />}
            accentSoft="#E5F3F5"
            title="No saved devices yet"
            description="Add a device to speed up your repair bookings."
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Smartphone size={28} color={BRAND.green} />}
            accentSoft="#E5F3F5"
            title="No devices in this category"
            description="Pick another category or add a new device below."
          />
        ) : (
          shown.map((d) => {
            const code = deviceCode(d);
            const meta = CATEGORY_META[code] || { name: 'Other', icon: Smartphone };
            const Icon = meta.icon;
            const img = deviceImage(d);
            const specs = [deviceRam(d), deviceStorage(d)].filter(Boolean).join(' / ');
            const brand = d.brandName || brandById[d.brandId]?.name;
            const showImei = d.imei && imeiApplies(resolveSpecCategory(d.categoryCode, catById[d.categoryId]?.code, catById[d.categoryId]?.name));
            return (
              <View key={d.id} style={{ marginBottom: 12, borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
                <View style={{ flexDirection: 'row' }}>
                  {/* Image panel with a ribbon (Default / category). */}
                  <View style={{ width: 104, minHeight: 104, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#E5E7EB' }}>
                    {img ? <Image source={{ uri: img }} style={{ width: 76, height: 76 }} resizeMode="contain" /> : <Icon size={34} color={TEAL} />}
                    <View style={{ position: 'absolute', top: 0, left: 0, maxWidth: '86%', backgroundColor: d.isDefault ? '#F09406' : TEAL, paddingHorizontal: 8, paddingVertical: 4, borderBottomRightRadius: 12 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' }} numberOfLines={1}>{d.isDefault ? 'Default' : meta.name}</Text>
                    </View>
                  </View>
                  {/* Details */}
                  <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 8 }}>
                    {brand ? <Text style={{ fontSize: 11, fontWeight: '800', color: TEAL }} numberOfLines={1}>{brand}</Text> : null}
                    <Text style={{ marginTop: 2, fontSize: 13, fontWeight: '800', lineHeight: 17, color: '#111111' }} numberOfLines={2}>{deviceName(d)}</Text>
                    {specs ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                        <HardDrive size={11} color="#6B7280" />
                        <Text style={{ fontSize: 11.5, color: '#6B7280', marginLeft: 4 }} numberOfLines={1}>{specs}</Text>
                      </View>
                    ) : null}
                    {d.color ? <Text style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{d.color}</Text> : null}
                    {showImei ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Hash size={11} color="#6B7280" />
                        <Text style={{ fontSize: 11.5, color: '#6B7280', marginLeft: 4 }} numberOfLines={1}>{d.imei}</Text>
                      </View>
                    ) : null}
                    {d.note ? <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }} numberOfLines={2}>Note: {d.note}</Text> : null}
                  </View>
                </View>
                {/* Bottom bar (orders style): label · actions. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: d.isDefault ? '#B45309' : TEAL }} numberOfLines={1}>
                    {d.isDefault ? 'Default Device' : meta.name}
                  </Text>
                  {!d.isDefault ? <TileAction icon={Star} label="Set Default" color="#F09406" onPress={() => onDefault(d.id)} /> : null}
                  <TileAction icon={Pencil} label="Edit" onPress={() => onEdit(d)} />
                  <TileAction icon={Trash2} label="Delete" color={BRAND.red} onPress={() => onDelete(d.id)} />
                </View>
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
          <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: '#E5F3F5', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
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
