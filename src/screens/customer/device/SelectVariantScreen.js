import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  Smartphone,
  Cpu,
  HardDrive,
  Palette,
  Check,
  Tag,
  Skull,
  Pencil,
  ChevronRight,
} from 'lucide-react-native';

const P = BRAND;

const cardStyle = {
  backgroundColor: P.card,
  borderRadius: 14,
  padding: 11,
  marginBottom: 9,
  borderWidth: 1,
  borderColor: '#E6E6E6',
  shadowColor: P.ink,
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

const sellConditionsFor = (deviceLabel) => [
  { key: 'WORKING', label: `Working ${deviceLabel}`, sub: 'Turns on · No major issues', icon: Smartphone, color: P.green, soft: P.greenSoft },
  { key: 'DEAD', label: `${deviceLabel} Dead / Unknown`, sub: "Won't turn on · Not sure", icon: Skull, color: P.red, soft: P.redSoft },
];
import { notify } from '../../../components/confirm';
import {
  BottomActionBar,
  Button,
  Input,
  Loader,
  useBottomBarInset,
} from '../../../components/rnr';
import { getModelOptions } from '../../../api/masterData';
import useDeviceSpecForm from '../../../hooks/useDeviceSpecForm';
import { formatSpecValue, normalizeCapacity } from '../../../utils/deviceSpecs';
import { createSavedDevice, updateSavedDevice } from '../../../api/customer';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

const COLOR_SWATCHES = {
  black: '#0F172A', white: '#F8FAFC', silver: '#CBD5E1', gold: '#F5E6B0',
  rose: '#FBCFE8', blue: '#3B82F6', red: '#EF4444', green: '#004C40',
  purple: '#A855F7', pink: '#EC4899', graphite: '#4B5563', midnight: '#1E1B4B',
  starlight: '#FAF7F0', sierra: '#B7BCC8', alpine: '#3F4754', sky: '#7DD3FC',
  phantom: '#475569', cosmic: '#312E81',
};
function swatchFor(name) {
  const n = (name || '').toLowerCase();
  for (const key of Object.keys(COLOR_SWATCHES)) {
    if (n.includes(key)) return COLOR_SWATCHES[key];
  }
  return '#94A3B8';
}

function SectionHead({ icon: Icon, tint, color, title, right }) {
  return (
    <View className="flex-row items-center" style={{ marginBottom: 8 }}>
      <View className="rounded-full items-center justify-center mr-2" style={{ height: 28, width: 28, backgroundColor: tint }}>
        <Icon size={13} color={color} />
      </View>
      <Text className="font-extrabold flex-1" style={{ fontSize: rf(12.5), color: P.ink }}>{title}</Text>
      {right}
    </View>
  );
}

function TypedField({ value, onChangeText, placeholder, label, autoCapitalize = 'words' }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={P.muted}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      returnKeyType="done"
      accessibilityLabel={label}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        { height: 42, paddingHorizontal: 12, borderRadius: 12, fontSize: rf(13), color: P.ink, backgroundColor: P.bg, borderWidth: 1, borderColor: focused ? P.green : '#E6E6E6' },
        // Web only: drop the browser focus ring inside the rounded field.
        Platform.OS === 'web' ? { outlineStyle: 'none' } : null,
      ]}
    />
  );
}

function ConditionTile({ o, active, onPress }) {
  const Icon = o.icon;
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-85"
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 1.5, borderColor: active ? o.color : P.line, backgroundColor: active ? o.soft : P.bg }}
    >
      <View style={{ height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 7, backgroundColor: active ? P.card : o.soft }}>
        <Icon size={15} color={o.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: P.ink, lineHeight: rf(14) }} numberOfLines={2}>{o.label}</Text>
        <Text style={{ fontSize: rf(9.5), color: P.muted, marginTop: 1 }} numberOfLines={2}>{o.sub}</Text>
      </View>
      {active ? (
        <View style={{ height: 16, width: 16, borderRadius: 8, marginLeft: 4, backgroundColor: o.color, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={10} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function SelectVariantScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const flow = route?.params?.flow || 'PROFILE';
  const isEdit = !!route?.params?.deviceId;
  const modelId = route?.params?.modelId;
  const modelName = route?.params?.modelName || 'Device';
  const brandId = route?.params?.brandId;
  const brandName = route?.params?.brandName;
  const categoryId = route?.params?.categoryId;
  const modelImageUrl = route?.params?.modelImageUrl;


  // Categories that don't have an IMEI (laptops, audio devices, smartwatches…).
  // We resolve the category code from either the params (set by the picker) or
  // the categoryId itself when it's a code string and not a UUID.
  const isUuid = (v) => typeof v === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const categoryCode = (
    typeof categoryId === 'string' && !isUuid(categoryId)
      ? categoryId
      : (route?.params?.categoryCode || '')
  ).toUpperCase();
  const NO_IMEI_KEYWORDS = ['LAPTOP', 'AUDIO', 'WATCH', 'HEADPHONE', 'EARBUD', 'TABLET'];
  const noImei = NO_IMEI_KEYWORDS.some((k) => categoryCode.includes(k));
  // Smart watches & audio devices don't take RAM/Storage selections.
  const NO_RAM_STORAGE_KEYWORDS = ['WATCH', 'AUDIO', 'HEADPHONE', 'EARBUD'];
  const noRamStorage = NO_RAM_STORAGE_KEYWORDS.some((k) => categoryCode.includes(k));
  // Heading + condition labels follow the category.
  const conditionDeviceLabel = categoryCode.includes('LAPTOP') ? 'Laptop'
    : categoryCode.includes('WATCH') ? 'Smart Watch'
    : categoryCode.includes('AUDIO') || categoryCode.includes('HEADPHONE') || categoryCode.includes('EARBUD') ? 'Audio Device'
    : 'Mobile';
  const SELL_CONDITIONS = sellConditionsFor(conditionDeviceLabel);

  const [rams, setRams] = useState([]);
  const [storages, setStorages] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [colorsList, setColorsList] = useState([]);
  const [modelOptions, setModelOptions] = useState(null);

  const editHints = route?.params?.editHints || null;
  const editSellOrderId = route?.params?.editSellOrderId || null;
  const isEditingSellOrder = !!editSellOrderId;

  const [ram, setRam] = useState(route?.params?.ramOptionId ? { id: route.params.ramOptionId, label: '' } : null);
  const [storage, setStorage] = useState(route?.params?.storageOptionId ? { id: route.params.storageOptionId, label: '' } : null);
  const [color, setColor] = useState(route?.params?.color ? { id: route.params.color, name: route.params.color } : null);
  const [imei, setImei] = useState(route?.params?.imei || '');
  const [imeiFocused, setImeiFocused] = useState(false);
  // When editing a sell order, restore the original working condition; for a
  // brand-new sell we default to WORKING.
  const [condition, setCondition] = useState(
    (isEditingSellOrder && editHints?.workingCondition === 'DEAD') ? 'DEAD' : 'WORKING',
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // "Other" model (typed on Select Product; Repair and Sell): the catalogue's
  // colours and variants describe some other device, so colour, RAM and
  // storage are typed instead and travel as labels with no option ids.
  const isCustomModel = !!route?.params?.customModel;
  const [colorText, setColorText] = useState(route?.params?.color || '');
  const [ramText, setRamText] = useState(route?.params?.ramLabel || '');
  const [storageText, setStorageText] = useState(route?.params?.storageLabel || '');

  // When a model's variants are storage-only ("128 GB", no "+"), the picker shows
  // a single Storage grid and doesn't require a RAM selection.
  const specsStorageOnly = specs.length > 0 && specs.every((sp) => sp.storageOnly);

  // A "dead" mobile (won't power on) can't be inspected for RAM/Storage, so in
  // the REPAIR flow picking DEAD hides those pickers and lets the customer go
  // straight to choosing a repair service without them being required.
  const isDead = condition === 'DEAD';
  const repairDead = flow === 'REPAIR' && isDead;

  // Laptop RAM / Storage come from the DB's Device Configuration fields
  // (/master/config-fields) via the same hook the Partner app's booking screen
  // uses — not the phone RAM/Storage master lists. Mobile / Tablet keep the
  // grids below. Sell already asks config fields on SellDeviceConfigScreen.
  const specFlow = flow === 'REPAIR' || flow === 'PROFILE';
  const spec = useDeviceSpecForm({
    context: 'BOOKING',
    hints: [route?.params?.categoryCode, route?.params?.categoryName, categoryId],
    categoryId,
    modelId: isCustomModel ? undefined : modelId,
    modelOptions,
    legacy: {
      ramOptionId: route?.params?.ramOptionId,
      storageOptionId: route?.params?.storageOptionId,
      ramLabel: route?.params?.ramLabel,
      storageLabel: route?.params?.storageLabel,
    },
  });
  const deviceSpecFields = spec.fields.filter((f) => f.key !== 'color');
  const useDeviceSpecs = specFlow && !isCustomModel && spec.usesSpecs && deviceSpecFields.length > 0;
  const specsMissing = deviceSpecFields.some((f) => f.required && !spec.values[f.key]);
  // Spec values travel as labels, linked to the master RAM / storage option of
  // the same size when one exists, so existing id-based displays still resolve.
  const masterIdFor = (list, value) => list.find((o) => normalizeCapacity(o.label) === value)?.id;
  const chosenRam = !useDeviceSpecs ? ram
    : spec.values.ram ? { id: masterIdFor(rams, spec.values.ram), label: formatSpecValue('ram', spec.values.ram) } : null;
  const chosenStorage = !useDeviceSpecs ? storage
    : spec.values.storageCapacity ? {
      id: masterIdFor(storages, spec.values.storageCapacity),
      label: [formatSpecValue('storageCapacity', spec.values.storageCapacity), formatSpecValue('storageType', spec.values.storageType)]
        .filter(Boolean).join(' '),
    } : null;

  // Pick a condition. In REPAIR, marking the device DEAD skips RAM/Storage, so we
  // also clear any RAM/Storage already chosen — otherwise stale specs would
  // linger in the summary chips and the booking payload for a device we couldn't
  // inspect. (SELL still needs specs even when dead, so it's untouched there.)
  const chooseCondition = (key) => {
    setCondition(key);
    if (flow === 'REPAIR' && key === 'DEAD') {
      setRam(null);
      setStorage(null);
    }
  };

  useEffect(() => {
    if (isCustomModel) { setLoading(false); return; }
    (async () => {
      try {
        const opts = await getModelOptions(modelId);
        // Prefer THIS model's configured colors + RAM/storage variants; fall back
        // to the full master lists (then a hardcoded color list) when nothing is set.
        const cs = opts.colors.length ? opts.colors : opts.allColors;
        setColorsList(cs.length ? cs : [
          { id: 'Midnight Black', name: 'Midnight Black' },
          { id: 'Phantom Silver', name: 'Phantom Silver' },
          { id: 'Cosmic Blue', name: 'Cosmic Blue' },
          { id: 'Rose Gold', name: 'Rose Gold' },
          { id: 'Starlight', name: 'Starlight' },
          { id: 'Alpine Green', name: 'Alpine Green' },
        ]);
        setSpecs(opts.specs);
        setRams(opts.allRams);
        setStorages(opts.allStorages);
        setModelOptions(opts);
      } catch (_) { setModelOptions({}); }
      setLoading(false);
    })();
  }, []);

  // Sync display labels for RAM/storage when arriving with only id
  useEffect(() => {
    if (ram && !ram.label) {
      const found = rams.find((r) => r.id === ram.id);
      if (found) setRam(found);
    }
    if (storage && !storage.label) {
      const found = storages.find((s) => s.id === storage.id);
      if (found) setStorage(found);
    }
  }, [rams, storages, ram, storage]);

  // Typed device (repair / sell). Partial values are fine on Skip (repair
  // only) — the repair screens render these with .filter(Boolean).
  const buildCustomDevice = () => {
    const keepSpecs = !noRamStorage && !repairDead;
    return {
      categoryId: isUuid(categoryId) ? categoryId : undefined,
      categoryCode: typeof categoryId === 'string' && !isUuid(categoryId)
        ? categoryId.toUpperCase()
        : (route?.params?.categoryCode || undefined),
      brandId: isUuid(brandId) ? brandId : undefined,
      modelId: undefined,
      modelName,
      brandName: brandName || undefined,
      ramLabel: keepSpecs ? (ramText.trim() || undefined) : undefined,
      storageLabel: keepSpecs ? (storageText.trim() || undefined) : undefined,
      color: colorText.trim() || undefined,
      customModel: true,
      customBrand: !!route?.params?.customBrand,
      workingCondition: condition,
      dead: isDead,
    };
  };
  const onSkip = () => navigation.navigate('RepairSelectService', { device: buildCustomDevice() });

  useLayoutEffect(() => {
    if (!isCustomModel || flow !== 'REPAIR') return;
    navigation.setOptions({
      // Wider side slots (both sides, so the title stays centred) — the default
      // 36 px slot only fits an icon and wrapped "Skip" one letter per line.
      headerSideWidth: 60,
      headerRight: () => (
        <Pressable
          onPress={onSkip}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          className="active:opacity-70"
          style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4FBF8', borderWidth: 1, borderColor: '#DCE7E2' }}
        >
          <Text numberOfLines={1} style={{ fontSize: rf(12.5), fontWeight: '800', color: '#078F23' }}>Skip</Text>
        </Pressable>
      ),
    });
  }, [navigation, flow, isCustomModel, colorText, ramText, storageText, condition]);

  const onContinue = async () => {
    if (isCustomModel) {
      // Colour + storage are required; RAM stays optional (as in the Partner app).
      if (!repairDead && (!colorText.trim() || (!noRamStorage && !storageText.trim()))) return;
      if (flow === 'SELL') {
        if (!noImei && !imei.trim()) return;
        navigation.navigate('SellScreening', {
          device: { ...buildCustomDevice(), imei },
          workingCondition: condition,
          editSellOrderId: route?.params?.editSellOrderId,
          editHints: route?.params?.editHints,
        });
        return;
      }
      navigation.navigate('RepairSelectService', { device: buildCustomDevice() });
      return;
    }
    if (!repairDead) {
      if (!color) return;
      if (useDeviceSpecs) { if (specsMissing) return; }
      else if (!noRamStorage && (!storage || (!specsStorageOnly && !ram))) return;
    }

    // Only send UUID-typed fields the backend can parse. Hardcoded category
    // codes like 'SMARTPHONE' (from Home tiles / fallback list) would fail
    // Spring's @RequestBody UUID parsing — strip anything that isn't a UUID.
    const onlyUuid = (v) => (isUuid(v) ? v : undefined);

    // categoryCode is a string code like SMARTPHONE / LAPTOP — preserved
    // separately from the UUID so the backend can filter saved devices per
    // category even when no UUID was known at booking time.
    const categoryCodeString = typeof categoryId === 'string' && !isUuid(categoryId)
      ? categoryId.toUpperCase()
      : (route?.params?.categoryCode || undefined);

    const payload = {
      categoryId: onlyUuid(categoryId),
      categoryCode: categoryCodeString,
      brandId: onlyUuid(brandId),
      modelId: onlyUuid(modelId),
      // Denormalized display fields so the saved-device list can render the
      // real name/brand/specs without a master-data join.
      modelName: modelName && modelName !== 'Device' ? modelName : undefined,
      brandName: brandName || undefined,
      imageUrl: modelImageUrl || undefined,
      ramLabel: noRamStorage ? undefined : (chosenRam?.label || undefined),
      storageLabel: noRamStorage ? undefined : (chosenStorage?.label || undefined),
      ramOptionId: noRamStorage ? undefined : onlyUuid(chosenRam?.id),
      storageOptionId: noRamStorage ? undefined : onlyUuid(chosenStorage?.id),
      color: color?.name || color?.id,
      imei: (flow === 'SELL' && !noImei) ? imei : undefined,
    };

    if (flow === 'PROFILE') {
      setSaving(true);
      try {
        if (isEdit) await updateSavedDevice(route.params.deviceId, payload);
        else await createSavedDevice(payload);
        navigation.popToTop();
        navigation.navigate('ManageDevice');
      } catch (e) {
        notify('Save failed', e.message || 'Could not save device. Try again.');
      } finally { setSaving(false); }
      return;
    }
    if (flow === 'REPAIR') {
      navigation.navigate('RepairSelectService', {
        device: { ...payload, modelName, workingCondition: condition, dead: isDead },
      });
      return;
    }
    if (flow === 'SELL') {
      navigation.navigate('SellScreening', {
        device: { ...payload, modelName, imei },
        workingCondition: condition,
        editSellOrderId: route?.params?.editSellOrderId,
        editHints: route?.params?.editHints,
      });
      return;
    }
    if (flow === 'OWNER_LIST') {
      // Owner is listing this device on the marketplace — hand off to the
      // description chooser (Detailed / Short / Dead Phone Short).
      navigation.navigate('OwnerSellMobile', { device: { ...payload, modelName, imei } });
      return;
    }
  };

  if (loading || (specFlow && !isCustomModel && spec.loading)) return <Loader label="Loading variants..." />;

  const ready = isCustomModel
    ? ((repairDead || (!!colorText.trim() && (noRamStorage || !!storageText.trim()))) && (flow !== 'SELL' || noImei || !!imei.trim()))
    : repairDead
    ? true
    : (
        color &&
        (useDeviceSpecs ? !specsMissing : (noRamStorage || (storage && (specsStorageOnly || ram)))) &&
        (flow !== 'SELL' || noImei || imei.trim())
      );
  const ctaLabel = flow === 'PROFILE'
    ? (isEdit ? 'Update Device' : 'Save Device')
    : flow === 'REPAIR' ? 'Choose Repair Service'
    : flow === 'OWNER_LIST' ? 'Choose Description'
    : 'Continue';

  const tileStyle = (active) => ({
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: active ? P.green : P.line,
    backgroundColor: active ? P.green : P.bg,
  });
  const tileText = (active) => ({ fontSize: rf(13), color: active ? '#fff' : P.ink });
  const customSummary = [colorText, ramText, storageText].map((v) => v.trim()).filter(Boolean).join(' · ')
    || (repairDead ? "Won't power on · inspected at the shop" : 'Type the colour and storage');

  return (
    <View className="flex-1" style={{ backgroundColor: P.bg }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: bottomSpace }}>

        {isEditingSellOrder ? (
          <View className="rounded-xl px-3 py-2 mb-3 flex-row items-center" style={{ backgroundColor: P.yellowSoft, borderWidth: 1, borderColor: 'rgba(243,191,35,0.45)' }}>
            <Pencil size={13} color={P.ink} />
            <View className="flex-1 ml-2">
              <Text className="font-extrabold tracking-wider" style={{ fontSize: rf(10), color: P.ink }}>EDITING ORDER</Text>
              <Text className="font-semibold" style={{ fontSize: rf(12), color: P.ink }} numberOfLines={1}>
                We've kept your existing color, storage and IMEI — change any of them below.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Device summary */}
        <View className="rounded-2xl p-3 mb-3 flex-row items-center"
              style={[cardStyle, { shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }]}>
          <View className="items-center justify-center mr-3 overflow-hidden" style={{ height: 48, width: 48, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: P.line }}>
            {modelImageUrl ? (
              <Image source={{ uri: modelImageUrl }} style={{ width: 44, height: 44 }} resizeMode="contain" />
            ) : (
              <Smartphone size={22} color={P.green} />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="uppercase tracking-widest" style={{ fontSize: rf(9.5), color: P.greenDeep, fontWeight: '800' }}>Your Device</Text>
              {isCustomModel ? (
                <View style={{ marginLeft: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: P.yellowSoft }}>
                  <Text style={{ fontSize: rf(9), fontWeight: '800', color: P.ink }}>OTHER MODEL</Text>
                </View>
              ) : null}
            </View>
            <Text className="font-extrabold mt-0.5" style={{ fontSize: rf(14), color: P.ink }} numberOfLines={2}>{modelName}</Text>
            {brandName ? (
              <Text className="mt-0.5" style={{ fontSize: rf(11), color: P.muted }}>{brandName}</Text>
            ) : null}
          </View>
        </View>

        {/* Device condition (repair flow) — pick "Working" to choose the exact
            color/RAM/storage, or "Dead" when the device won't power on. A dead
            device skips the RAM/Storage pickers and can go straight to choosing
            a repair service. */}
        {flow === 'REPAIR' ? (
          <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
            <Text className="font-extrabold tracking-widest mb-2" style={{ fontSize: rf(10), color: P.muted }}>{conditionDeviceLabel.toUpperCase()} CONDITION</Text>
            <View className="flex-row -mx-1">
              {SELL_CONDITIONS.map((o) => (
                <View key={o.key} className="px-1 flex-1">
                  <ConditionTile o={o} active={condition === o.key} onPress={() => chooseCondition(o.key)} />
                </View>
              ))}
            </View>
            {repairDead ? (
              <View className="flex-row items-center mt-2.5 rounded-xl px-3 py-2" style={{ backgroundColor: P.redSoft, borderWidth: 1, borderColor: 'rgba(248,65,65,0.25)' }}>
                <Skull size={13} color={P.red} />
                <Text className="ml-2 flex-1" style={{ fontSize: rf(11), color: P.ink }}>
                  Since your {conditionDeviceLabel.toLowerCase()} won't power on, we'll skip RAM &amp; Storage and inspect it at the shop.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Selection summary chips */}
        {!isCustomModel && (chosenRam || chosenStorage || color) ? (
          <View className="flex-row flex-wrap mb-3">
            {chosenRam?.label ? (
              <View className="rounded-full px-3 py-1 mr-2 mb-2 flex-row items-center" style={{ backgroundColor: P.greenSoft }}>
                <Cpu size={11} color={P.green} />
                <Text className="font-bold ml-1" style={{ fontSize: rf(11), color: P.ink }}>{chosenRam.label}</Text>
              </View>
            ) : null}
            {chosenStorage?.label ? (
              <View className="rounded-full px-3 py-1 mr-2 mb-2 flex-row items-center" style={{ backgroundColor: P.inkSoft }}>
                <HardDrive size={11} color={P.ink} />
                <Text className="font-bold ml-1" style={{ fontSize: rf(11), color: P.ink }}>{chosenStorage.label}</Text>
              </View>
            ) : null}
            {color?.name ? (
              <View className="rounded-full px-3 py-1 mr-2 mb-2 flex-row items-center" style={{ backgroundColor: P.yellowSoft }}>
                <View className="h-3 w-3 rounded-full mr-1" style={{ backgroundColor: swatchFor(color.name), borderWidth: 1, borderColor: P.hairline }} />
                <Text className="font-bold" style={{ fontSize: rf(11), color: P.ink }}>{color.name}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Typed colour / RAM / storage — a model that isn't in the catalogue */}
        {isCustomModel ? (
          <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
            <SectionHead icon={Palette} tint={P.yellowSoft} color={P.yellow} title="Model Color" right={<Text style={{ fontSize: rf(11), color: P.muted }}>{repairDead ? 'Optional' : 'Type the colour'}</Text>} />
            <TypedField label="Model colour" value={colorText} onChangeText={setColorText} placeholder="e.g. Sea Green" />
            {!noRamStorage && !repairDead ? (
              <>
                <View style={{ height: 12 }} />
                <SectionHead icon={Cpu} tint={P.greenSoft} color={P.green} title="RAM" right={<Text style={{ fontSize: rf(11), color: P.muted }}>Optional</Text>} />
                <TypedField label="RAM" value={ramText} onChangeText={setRamText} placeholder="e.g. 8 GB" autoCapitalize="characters" />
                <View style={{ height: 12 }} />
                <SectionHead icon={HardDrive} tint={P.inkSoft} color={P.ink} title="Storage" right={<Text style={{ fontSize: rf(11), color: P.muted }}>Type the capacity</Text>} />
                <TypedField label="Storage" value={storageText} onChangeText={setStorageText} placeholder="e.g. 128 GB" autoCapitalize="characters" />
              </>
            ) : null}
            <Text style={{ marginTop: 10, fontSize: rf(10.5), color: P.muted }}>{`Saved on this ${flow === 'SELL' ? 'sell order' : 'booking'} only — not added to the catalogue.`}</Text>
          </View>
        ) : (
        /* Color picker */
        <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
          <SectionHead
            icon={Palette}
            tint={P.yellowSoft}
            color={P.yellow}
            title="Color"
            right={color ? (
              <View className="flex-row items-center">
                <View className="h-4 w-4 rounded-full mr-1" style={{ backgroundColor: swatchFor(color.name), borderWidth: 1, borderColor: P.hairline }} />
                <Text className="font-bold" style={{ fontSize: rf(11), color: P.ink }} numberOfLines={1}>{color.name}</Text>
              </View>
            ) : null}
          />
          <View className="flex-row flex-wrap -mx-1">
            {colorsList.map((c) => {
              const name = c.name || c.id;
              const active = color?.name === name || color?.id === name;
              const sw = c.hexCode || swatchFor(name);
              return (
                <View key={c.id || name} className="p-1" style={{ width: '33.333%' }}>
                  <Pressable
                    onPress={() => setColor(active ? null : { id: c.id || name, name })}
                    className="rounded-xl p-2.5 items-center"
                    style={{ paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: active ? P.green : P.line, backgroundColor: active ? P.greenSoft : P.bg }}
                  >
                    <View className="flex-row items-center justify-center">
                      <View className="h-5 w-5 rounded-full" style={{ backgroundColor: sw, borderWidth: 1, borderColor: P.hairline }} />
                      {active ? (
                        <View className="ml-1 h-4 w-4 rounded-full items-center justify-center" style={{ backgroundColor: P.green }}>
                          <Check size={10} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      className="font-bold mt-1.5 text-center" style={{ fontSize: rf(11), color: P.ink }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
        )}

        {/* Model variants — RAM + Storage combos, or storage-only sizes the model ships */}
        {!isCustomModel && !noRamStorage && !useDeviceSpecs && specs.length > 0 && !repairDead ? (
        <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
          <SectionHead
            icon={HardDrive}
            tint={P.greenSoft}
            color={P.green}
            title={specsStorageOnly ? 'Storage' : 'RAM & Storage'}
            right={<Text style={{ fontSize: rf(11), color: P.muted }}>Variant</Text>}
          />
          <View className="flex-row flex-wrap -mx-1">
            {specs.map((sp) => {
              const active = sp.storageOnly
                ? storage?.id === sp.storageOptionId
                : (ram?.id === sp.ramOptionId && storage?.id === sp.storageOptionId);
              return (
                <View key={sp.id} className="p-1" style={{ width: '50%' }}>
                  <Pressable
                    onPress={() => {
                      if (active) { setRam(null); setStorage(null); return; }
                      setRam(sp.storageOnly ? null : { id: sp.ramOptionId, label: sp.ramLabel });
                      setStorage({ id: sp.storageOptionId, label: sp.storageLabel });
                    }}
                    className="rounded-xl py-3 items-center"
                    style={tileStyle(active)}
                  >
                    <Text className="font-extrabold" style={tileText(active)} numberOfLines={1}>
                      {sp.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
        ) : null}

        {/* RAM (fallback: model has no variants configured) */}
        {!isCustomModel && !noRamStorage && !useDeviceSpecs && specs.length === 0 && !repairDead ? (
        <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
          <SectionHead
            icon={Cpu}
            tint={P.greenSoft}
            color={P.green}
            title="RAM"
            right={<Text style={{ fontSize: rf(11), color: P.muted }}>Memory</Text>}
          />
          <View className="flex-row flex-wrap -mx-1">
            {rams.map((r) => {
              const active = ram?.id === r.id;
              return (
                <View key={r.id} className="p-1" style={{ width: '33.333%' }}>
                  <Pressable
                    onPress={() => setRam(active ? null : r)}
                    className="rounded-xl py-3 items-center"
                    style={tileStyle(active)}
                  >
                    <Text className="font-extrabold" style={tileText(active)}>{r.label}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
        ) : null}

        {/* Storage (fallback) */}
        {!isCustomModel && !noRamStorage && !useDeviceSpecs && specs.length === 0 && !repairDead ? (
        <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
          <SectionHead
            icon={HardDrive}
            tint={P.inkSoft}
            color={P.ink}
            title="Storage"
            right={<Text style={{ fontSize: rf(11), color: P.muted }}>Capacity</Text>}
          />
          <View className="flex-row flex-wrap -mx-1">
            {storages.map((s) => {
              const active = storage?.id === s.id;
              return (
                <View key={s.id} className="p-1" style={{ width: '33.333%' }}>
                  <Pressable
                    onPress={() => setStorage(active ? null : s)}
                    className="rounded-xl py-3 items-center"
                    style={tileStyle(active)}
                  >
                    <Text className="font-extrabold" style={tileText(active)}>{s.label}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
        ) : null}

        {/* Laptop RAM / Storage / Storage Type — DB config fields (as in the Partner app) */}
        {useDeviceSpecs && !repairDead ? deviceSpecFields.map((f) => (
          <View key={f.key} className="rounded-2xl p-3 mb-3" style={cardStyle}>
            <SectionHead
              icon={f.key === 'ram' ? Cpu : HardDrive}
              tint={f.key === 'ram' ? P.greenSoft : P.inkSoft}
              color={f.key === 'ram' ? P.green : P.ink}
              title={f.label}
              right={<Text style={{ fontSize: rf(11), color: P.muted }}>{f.required ? f.hint : 'Optional'}</Text>}
            />
            <View className="flex-row flex-wrap -mx-1">
              {f.options.map((o) => {
                const active = spec.values[f.key] === o.value;
                return (
                  <View key={o.value} className="p-1" style={{ width: '33.333%' }}>
                    <Pressable
                      onPress={() => spec.setValue(f.key, active ? null : o.value)}
                      className="rounded-xl py-3 items-center"
                      style={tileStyle(active)}
                    >
                      <Text className="font-extrabold" style={tileText(active)} numberOfLines={1}>{o.label}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )) : null}

        {/* IMEI for sell flow — only for mobile/smartphone categories. */}
        {flow === 'SELL' && !noImei ? (
          <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
            <SectionHead
              icon={Tag}
              tint={P.greenSoft}
              color={P.green}
              title="IMEI Number"
              right={<Text style={{ fontSize: rf(10), color: P.muted }}>Required for sell</Text>}
            />
            <Text className="mb-1" style={{ fontSize: rf(11.5), fontWeight: '600', color: P.body }}>Dial *#06# on your device to find IMEI</Text>
            <Input
              placeholder="15-digit IMEI"
              value={imei}
              onChangeText={setImei}
              keyboardType="number-pad"
              placeholderTextColor={P.muted}
              onFocus={() => setImeiFocused(true)}
              onBlur={() => setImeiFocused(false)}
              className="py-2"
              style={{ fontSize: rf(13), color: P.ink, backgroundColor: P.bg, borderColor: imeiFocused ? P.green : P.line, shadowColor: P.green }}
            />
          </View>
        ) : null}

        {/* Phone condition (sell flow) */}
        {flow === 'SELL' ? (
          <View className="rounded-2xl p-3 mb-3" style={cardStyle}>
            <Text className="font-extrabold tracking-widest mb-2" style={{ fontSize: rf(10), color: P.muted }}>{conditionDeviceLabel.toUpperCase()} CONDITION</Text>
            <View className="flex-row -mx-1">
              {SELL_CONDITIONS.map((o) => (
                <View key={o.key} className="px-1 flex-1">
                  <ConditionTile o={o} active={condition === o.key} onPress={() => chooseCondition(o.key)} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

      </ScrollView>

      <BottomActionBar>
        {isCustomModel ? (
        <Pressable
          onPress={onContinue}
          disabled={!ready}
          className="active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !ready }}
          style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: ready ? P.green : P.bg, borderWidth: ready ? 0 : 1, borderColor: '#E6E6E6' }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(9.5), fontWeight: '800', letterSpacing: 0.8, color: ready ? 'rgba(255,255,255,0.85)' : P.muted }}>YOUR CONFIGURATION</Text>
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: rf(13), fontWeight: '800', color: ready ? '#FFFFFF' : P.ink }}>{customSummary}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: ready ? 'rgba(255,255,255,0.2)' : '#FFFFFF' }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: ready ? '#FFFFFF' : P.muted }}>Continue</Text>
            <ChevronRight size={16} color={ready ? '#FFFFFF' : P.muted} />
          </View>
        </Pressable>
        ) : (
        <Button
          onPress={onContinue}
          loading={saving}
          disabled={!ready}
          className="w-full"
          style={{ backgroundColor: P.green, shadowColor: P.green }}
          rightIcon={<ChevronRight size={18} color="#fff" />}
        >
          {ctaLabel}
        </Button>
        )}
      </BottomActionBar>
    </View>
  );
}
