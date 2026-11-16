import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Smartphone,
  Laptop,
  Watch,
  Headphones,
  Tablet,
  Check,
  Skull,
  Pencil,
  ChevronRight,
  Plus,
} from 'lucide-react-native';

const P = BRAND;

// Partner app "Device Details" look (service-booking-shop/DeviceDetailsScreen).
const ACCENT = '#035C6C';
const MINT = '#E5F3F5';
const INK = '#111111';
const MUTED = '#6B7280';
const PLACEHOLDER = '#9CA3AF';
const BORDER = '#E5E7EB';
const PAGE_BG = '#F3F4F6';

const sellConditionsFor = (deviceLabel) => [
  { key: 'WORKING', label: `Working ${deviceLabel}`, sub: 'Turns on · No major issues', icon: Smartphone, color: P.green, soft: P.greenSoft },
  { key: 'DEAD', label: `${deviceLabel} Dead / Unknown`, sub: "Won't turn on · Not sure", icon: Skull, color: P.red, soft: P.redSoft },
];
import { notify } from '../../../components/confirm';
import { Loader } from '../../../components/rnr';
import { getModelOptions } from '../../../api/masterData';
import useDeviceSpecForm from '../../../hooks/useDeviceSpecForm';
import { imeiApplies, cleanImei, isValidImei, imeiError } from '../../../utils/imeiPolicy';
import { formatSpecValue, normalizeCapacity } from '../../../utils/deviceSpecs';
import { createSavedDevice, updateSavedDevice } from '../../../api/customer';
import { rf, rs } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { useHideStackHeader } from '../service-booking-customer/FlowChrome';
import { DP_COLUMN, DPNextBar, DPSection, DevicePickerHeader, PickedCard, PickerImage } from './DevicePickerChrome';

const COLOR_SWATCHES = {
  black: '#1C3053', white: '#F3F4F6', silver: '#D2D6DD', gold: '#FDE3A3',
  rose: '#FEEBEA', blue: '#0788C9', red: '#F32C26', green: '#035C6C',
  purple: '#0788C9', pink: '#0788C9', graphite: '#606E87', midnight: '#1C3053',
  starlight: '#FFF4D6', sierra: '#8E97A9', alpine: '#111111', sky: '#9CCFE9',
  phantom: '#606e87', cosmic: '#1C3053',
};
function swatchFor(name) {
  const n = (name || '').toLowerCase();
  for (const key of Object.keys(COLOR_SWATCHES)) {
    if (n.includes(key)) return COLOR_SWATCHES[key];
  }
  return '#8E97A9';
}

const titleCase = (v) => String(v || '').toLowerCase().replace(/(^|[\s\-/(])([a-z0-9])/g, (_, s, c) => s + c.toUpperCase());

// Leading icon for the Category / Model rows when there's no art.
function categoryIconFor(code) {
  if (code.includes('LAPTOP')) return Laptop;
  if (code.includes('WATCH')) return Watch;
  if (code.includes('AUDIO') || code.includes('HEADPHONE') || code.includes('EARBUD')) return Headphones;
  if (code.includes('TABLET')) return Tablet;
  return Smartphone;
}

// Labelled section (Partner DPSection): bold label, red * when required,
// "(Optional)" otherwise.
function Field({ label, required, optional, hint, children }) {
  return (
    <View>
      <DPSection title={label} required={required} optional={optional} style={hint ? { marginBottom: 2 } : null} />
      {hint ? <Text style={{ fontSize: rf(12), color: MUTED, marginBottom: 8 }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

// Partner OptionTile: bordered card, colour swatch dot (or icon) + name;
// picked = mint fill + teal 1.5 border.
function OptionTile({ label, swatch, icon: Icon, on, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={label}
      className="active:opacity-80"
      style={{
        minHeight: 50, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : BORDER, backgroundColor: on ? MINT : '#FFFFFF',
      }}
    >
      {swatch ? (
        <View style={{ height: 18, width: 18, borderRadius: 9, marginRight: 8, backgroundColor: swatch, borderWidth: 1, borderColor: 'rgba(17,17,17,0.15)' }} />
      ) : Icon ? (
        <Icon size={16} color={ACCENT} strokeWidth={2.5} style={{ marginRight: 5 }} />
      ) : null}
      <Text
        style={{ flexShrink: 1, fontSize: rf(13), lineHeight: rf(16.5), fontWeight: on ? '800' : '600', color: on ? ACCENT : INK, textAlign: 'center' }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const tilePct = (cols) => `${(100 / cols) - 0.1}%`;

// Option cards in a `cols`-column grid; `other` adds a last "+ Other" card
// ({ value, onPress }) that shows the typed value once one is set.
function OptionGrid({ options, selected, onSelect, cols = 3, other }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
      {options.map((o) => (
        <View key={o.key} style={{ width: tilePct(cols), padding: 4 }}>
          <OptionTile label={o.label} swatch={o.swatch} on={selected != null && selected === o.key} onPress={() => onSelect(o.key)} />
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

// Partner FoldGrid: once a value is picked the grid folds to a compact card
// (swatch · value · Change); Change reopens the grid, a new pick folds it,
// tapping the picked card again clears it. `otherInput` ({ label,
// placeholder, autoCapitalize, onDone }) adds "+ Other", which opens the typed
// input under the grid.
function FoldGrid({ valueLabel, valueSwatch, otherValue, otherInput, ...grid }) {
  const [editing, setEditing] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => { setEditing(false); setTyping(false); }, [valueLabel]);
  if (valueLabel && !editing) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF' }}>
        {valueSwatch ? (
          <View style={{ height: 24, width: 24, borderRadius: 12, marginRight: 12, backgroundColor: valueSwatch, borderWidth: 1, borderColor: 'rgba(17,17,17,0.15)' }} />
        ) : null}
        <Text style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '800', color: INK }} numberOfLines={2}>{valueLabel}</Text>
        <Pressable
          onPress={() => setEditing(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Change ${valueLabel}`}
          className="active:opacity-70"
          style={{ marginLeft: 10, minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: ACCENT }}>Change</Text>
        </Pressable>
      </View>
    );
  }
  const done = () => {
    const t = draft.trim();
    setTyping(false);
    if (t && otherInput) otherInput.onDone(t);
  };
  return (
    <View>
      <OptionGrid
        {...grid}
        other={otherInput ? { value: otherValue || '', onPress: () => { setDraft(otherValue || ''); setTyping(true); } } : undefined}
      />
      {typing && otherInput ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TypedField
              label={otherInput.label}
              value={draft}
              onChangeText={setDraft}
              placeholder={otherInput.placeholder}
              autoCapitalize={otherInput.autoCapitalize}
              autoFocus
              onSubmitEditing={done}
            />
          </View>
          <Pressable
            onPress={done}
            accessibilityRole="button"
            accessibilityLabel={`Use ${otherInput.label}`}
            className="active:opacity-80"
            style={{ marginLeft: 8, height: 46, minWidth: 64, paddingHorizontal: 14, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#FFFFFF' }}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// Typed value (Partner "enter manually" box).
function TypedField({ value, onChangeText, placeholder, label, autoCapitalize = 'words', keyboardType, autoFocus, onSubmitEditing }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      autoFocus={autoFocus}
      onSubmitEditing={onSubmitEditing}
      placeholder={placeholder}
      placeholderTextColor={PLACEHOLDER}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      keyboardType={keyboardType}
      returnKeyType="done"
      accessibilityLabel={label}
      cursorColor={ACCENT}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        { height: 46, paddingHorizontal: 12, borderRadius: 12, fontSize: rf(14), color: INK, backgroundColor: '#FFFFFF', borderWidth: focused ? 1.5 : 1, borderColor: focused ? ACCENT : BORDER },
        // Web only: drop the browser focus ring inside the rounded field.
        Platform.OS === 'web' ? { outlineStyle: 'none' } : null,
      ]}
    />
  );
}

// Device condition card (Partner Device Condition): radio top-right, filled
// disc, title + note each reserving two lines so both cards match in height.
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

function SummaryLine({ label, value }) {
  return (
    <Text style={{ marginTop: 4, fontSize: rf(12), color: MUTED }} numberOfLines={1}>
      {label}: <Text style={{ fontWeight: '700', color: INK }}>{value}</Text>
    </Text>
  );
}

export default function SelectVariantScreen({ navigation, route }) {
  // This screen draws the Partner booking header itself.
  useHideStackHeader(navigation);
  const insets = useSafeAreaInsets();
  // Option cards: 3 columns on phones, 5 / 6 on tablets (Partner optCols).
  const { width: winW } = useWindowDimensions();
  const optCols = winW >= 900 ? 6 : winW >= 600 ? 5 : 3;
  const flow = route?.params?.flow || 'PROFILE';
  // Repair booking: Color / RAM / Storage are optional, as in the Partner app's
  // booking (the backend accepts nulls). Sell / profile keep their rules.
  const optionalVariant = flow === 'REPAIR';
  // "+ Other" typed RAM / storage travels as a label with no option id, so it
  // is offered only where those are optional (repair) — sell pricing and saved
  // devices rely on the option ids. A typed colour is a plain string anywhere.
  const variantOther = optionalVariant;
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
  const noImeiByCode = NO_IMEI_KEYWORDS.some((k) => categoryCode.includes(k));
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
  // IMEI is mobile-only; the spec hook also resolves UUID-only categories.
  const noImei = noImeiByCode || !imeiApplies(spec.category);
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

  // Category / Brand / Model "Change": back to that picker when it's in the
  // stack (it keeps its list), else open it with the params it reads. A saved
  // device being edited (deviceId) isn't re-picked — the pickers don't carry
  // deviceId, so the result would save as a new device.
  const canRepick = !isEdit;
  const goPicker = (name, extra = {}) => {
    const routes = navigation.getState?.()?.routes || [];
    if (routes.some((r) => r.name === name)) {
      if (typeof navigation.popTo === 'function') navigation.popTo(name);
      else navigation.navigate(name);
      return;
    }
    navigation.navigate(name, {
      flow,
      categoryId,
      categoryCode: route?.params?.categoryCode,
      categoryName: route?.params?.categoryName,
      categoryImage: route?.params?.categoryImage,
      deviceTypeId: route?.params?.deviceTypeId,
      deviceTypeName: route?.params?.deviceTypeName,
      editSellOrderId: editSellOrderId || undefined,
      editHints: editHints || undefined,
      ...extra,
    });
  };
  const changeCategory = () => goPicker('SelectCategory');
  const changeBrand = () => goPicker('SelectBrand');
  const changeModel = () => goPicker('SelectModel', {
    brandId,
    brandName,
    brandImage: route?.params?.brandImage,
    customBrand: route?.params?.customBrand || undefined,
    seriesId: route?.params?.seriesId,
    seriesName: route?.params?.seriesName,
  });

  const onContinue = async () => {
    if (isCustomModel) {
      // Colour + storage are required outside the repair booking; RAM stays
      // optional (as in the Partner app). Repair: all optional.
      if (!repairDead && !optionalVariant && (!colorText.trim() || (!noRamStorage && !storageText.trim()))) return;
      if (flow === 'SELL') {
        if (!noImei && !isValidImei(imei)) return;
        navigation.navigate('SellScreening', {
          device: { ...buildCustomDevice(), imei: noImei ? undefined : imei },
          workingCondition: condition,
          editSellOrderId: route?.params?.editSellOrderId,
          editHints: route?.params?.editHints,
        });
        return;
      }
      navigation.navigate('RepairSelectService', { device: buildCustomDevice() });
      return;
    }
    if (!repairDead && !optionalVariant) {
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
        device: { ...payload, modelName, imei: noImei ? undefined : imei },
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

  // Partner "Device Details" header (no step row). Repair shows its default
  // "Device for <name>"; the other flows keep their own subtitle. A typed
  // ("other") repair model keeps its Skip on the header's right.
  const headerSubtitle = flow === 'SELL' ? 'Device you’re selling'
    : flow === 'PROFILE' ? (isEdit ? 'Edit your saved device' : 'Add a device to your profile')
    : flow === 'OWNER_LIST' ? 'Device you’re listing'
    : undefined;
  const header = (
    <View>
      <DevicePickerHeader navigation={navigation} subtitle={headerSubtitle} />
      {isCustomModel && flow === 'REPAIR' ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 14, right: 14, height: 36, alignItems: 'center' }}>
          <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 720, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={onSkip}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Skip"
              className="active:opacity-70"
              style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: ACCENT }}
            >
              <Text numberOfLines={1} style={{ fontSize: rf(12.5), fontWeight: '800', color: ACCENT }}>Skip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  if (loading || (specFlow && !isCustomModel && spec.loading)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {header}
        <Loader label="Loading variants..." />
      </View>
    );
  }

  const ready = isCustomModel
    ? ((repairDead || optionalVariant || (!!colorText.trim() && (noRamStorage || !!storageText.trim()))) && (flow !== 'SELL' || noImei || isValidImei(imei)))
    : (repairDead || optionalVariant)
    ? true
    : (
        color &&
        (useDeviceSpecs ? !specsMissing : (noRamStorage || (storage && (specsStorageOnly || ram)))) &&
        (flow !== 'SELL' || noImei || isValidImei(imei))
      );
  // Saving to the profile keeps its wording; the other flows use Partner's "Next".
  const ctaLabel = flow === 'PROFILE' ? (isEdit ? 'Update Device' : 'Save Device') : 'Next';
  const customSummary = [colorText, ramText, storageText].map((v) => v.trim()).filter(Boolean).join(' · ')
    || (repairDead ? "Won't power on · inspected at the shop" : 'Type the colour and storage');

  // ── Row values ─────────────────────────────────────────────────────────
  const seriesName = route?.params?.seriesName;
  const categoryLabel = route?.params?.categoryName
    || (categoryCode ? titleCase(categoryCode.replace(/_/g, ' ')) : conditionDeviceLabel);
  const CategoryIcon = categoryIconFor(categoryCode);
  const colorHex = (name) => colorsList.find((c) => (c.name || c.id) === name)?.hexCode || swatchFor(name);
  // The listed variant matching the picked RAM + storage (same test the old tiles used).
  const variantActive = (sp) => !!storage && !storage.custom && (sp.storageOnly
    ? storage.id === sp.storageOptionId
    : (ram?.id === sp.ramOptionId && storage.id === sp.storageOptionId));
  const variantValue = specs.find(variantActive)?.label || [ram?.label, storage?.label].filter(Boolean).join(' + ');
  const specLabel = (f) => {
    const v = spec.values[f.key];
    if (!v) return '';
    return f.options.find((o) => o.value === v)?.label || formatSpecValue(f.key, v) || String(v);
  };

  // ── Inline option grids (Partner FoldGrid): the same options and the same
  // state updates the sheets / chips had — tapping the picked card clears it.
  const colorKey = (c) => c.name || c.id;
  const colorPicked = color ? colorsList.find((c) => colorKey(c) === color.name || colorKey(c) === color.id) : null;
  const colorListed = !!colorPicked;
  const colorOptions = colorsList.map((c) => ({ key: colorKey(c), label: colorKey(c), swatch: c.hexCode || swatchFor(colorKey(c)) }));
  const pickColor = (k) => {
    const c = colorsList.find((x) => colorKey(x) === k);
    const active = color?.name === k || color?.id === k;
    setColor(active ? null : { id: c?.id || k, name: k });
  };
  const pickedVariant = specs.find(variantActive);
  const pickVariant = (k) => {
    const sp = specs.find((x) => x.id === k);
    if (!sp) return;
    if (variantActive(sp)) { setRam(null); setStorage(null); return; }
    setRam(sp.storageOnly ? null : { id: sp.ramOptionId, label: sp.ramLabel });
    setStorage({ id: sp.storageOptionId, label: sp.storageLabel });
  };
  // A typed RAM / storage ("+ Other", repair only): label without an option id.
  const typedOption = (label) => ({ id: undefined, label, custom: true });

  // ── "Select Device" summary ────────────────────────────────────────────
  const crumbs = [brandName, seriesName, modelName].filter(Boolean);
  const showSpecs = !noRamStorage && !repairDead;
  const summaryColor = isCustomModel ? colorText.trim() : (color?.name || '');
  const sumRam = isCustomModel ? ramText.trim() : (chosenRam?.label || '');
  const sumStorage = isCustomModel ? storageText.trim() : (chosenStorage?.label || '');
  const summarySpecs = useDeviceSpecs
    ? (repairDead ? '' : deviceSpecFields.map(specLabel).filter(Boolean).join(' / '))
    : (showSpecs ? [sumRam, sumStorage].filter(Boolean).join(' / ') : '');
  const summarySpecsLabel = useDeviceSpecs ? 'Specs' : (sumRam ? 'RAM / Storage' : 'Storage');
  const modelNumber = route?.params?.modelNumber;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {header}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={DP_COLUMN}>

            {isEditingSellOrder ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: P.yellowSoft, borderWidth: 1, borderColor: 'rgba(250,167,0,0.45)' }}>
                <Pencil size={14} color={P.ink} />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
                  <Text style={{ fontSize: rf(10), fontWeight: '800', letterSpacing: 0.8, color: P.ink }}>EDITING ORDER</Text>
                  <Text style={{ fontSize: rf(12), fontWeight: '600', color: P.ink }} numberOfLines={2}>
                    We've kept your existing color, storage and IMEI — change any of them below.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ── Category / Brand / Model — Change goes back to that picker. */}
            <Field label="Category">
              <PickedCard
                image={route?.params?.categoryImage}
                icon={CategoryIcon}
                title={categoryLabel}
                onChange={canRepick ? changeCategory : undefined}
              />
            </Field>
            {brandName ? (
              <Field label="Brand">
                <PickedCard
                  image={route?.params?.brandImage}
                  initial={brandName}
                  title={brandName}
                  subtitle={route?.params?.customBrand ? 'Not in list' : null}
                  onChange={canRepick ? changeBrand : undefined}
                />
              </Field>
            ) : null}
            <Field label="Model">
              <PickedCard
                image={modelImageUrl}
                imageSize={44}
                icon={CategoryIcon}
                title={modelName}
                subtitle={seriesName || (isCustomModel ? 'Other model · not in list' : null)}
                onChange={canRepick ? changeModel : undefined}
              />
            </Field>

            {/* Device condition — Sell only (repair bookings don't ask; the
                device is treated as working and the shop inspects it). */}
            {flow === 'SELL' ? (
              <Field label={`${conditionDeviceLabel} Condition`} required>
                <View style={{ flexDirection: 'row', marginHorizontal: -rs(4) }}>
                  {SELL_CONDITIONS.map((o) => (
                    <View key={o.key} style={{ flex: 1, paddingHorizontal: rs(4) }}>
                      <ConditionCard o={o} active={condition === o.key} onPress={() => chooseCondition(o.key)} />
                    </View>
                  ))}
                </View>
                {repairDead ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: P.redSoft, borderWidth: 1, borderColor: 'rgba(243,44,38,0.25)' }}>
                    <Skull size={14} color={P.red} />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12), color: INK }}>
                      Since your {conditionDeviceLabel.toLowerCase()} won't power on, we'll skip RAM &amp; Storage and inspect it at the shop.
                    </Text>
                  </View>
                ) : null}
              </Field>
            ) : null}

            {isCustomModel ? (
              /* Typed colour / RAM / storage — a model that isn't in the catalogue */
              <>
                <Field label="Color" required={!repairDead && !optionalVariant} optional={repairDead || optionalVariant}>
                  <TypedField label="Model colour" value={colorText} onChangeText={setColorText} placeholder="Enter colour, e.g. Sea Green" />
                </Field>
                {!noRamStorage && !repairDead ? (
                  <>
                    <Field label="RAM" optional>
                      <TypedField label="RAM" value={ramText} onChangeText={setRamText} placeholder="Enter RAM, e.g. 8 GB" autoCapitalize="characters" />
                    </Field>
                    <Field label="Storage" required={!optionalVariant} optional={optionalVariant}>
                      <TypedField label="Storage" value={storageText} onChangeText={setStorageText} placeholder="Enter storage, e.g. 128 GB" autoCapitalize="characters" />
                    </Field>
                  </>
                ) : null}
                <Text style={{ marginTop: 8, fontSize: rf(11.5), color: MUTED }}>
                  {`Saved on this ${flow === 'SELL' ? 'sell order' : 'booking'} only — not added to the catalogue.`}
                </Text>
              </>
            ) : (
              /* Catalogue model: inline option cards (Partner), folding to the
                 picked value with Change. */
              <>
                <Field label="Color" required={!repairDead && !optionalVariant} optional={repairDead || optionalVariant}>
                  <FoldGrid
                    valueLabel={color?.name || ''}
                    valueSwatch={color ? colorHex(color.name) : null}
                    cols={optCols}
                    options={colorOptions}
                    selected={colorPicked ? colorKey(colorPicked) : null}
                    onSelect={pickColor}
                    otherValue={color && !colorListed ? color.name : ''}
                    otherInput={{ label: 'Other colour', placeholder: 'Enter colour, e.g. Sea Green', onDone: (t) => setColor({ id: t, name: t }) }}
                  />
                </Field>

                {/* Model variants — RAM + Storage combos, or storage-only sizes the model ships */}
                {!noRamStorage && !useDeviceSpecs && specs.length > 0 && !repairDead ? (
                  <Field label={specsStorageOnly ? 'Storage' : 'RAM & Storage'} required={!optionalVariant} optional={optionalVariant}>
                    <FoldGrid
                      valueLabel={variantValue}
                      cols={optCols}
                      options={specs.map((sp) => ({ key: sp.id, label: sp.label }))}
                      selected={pickedVariant ? pickedVariant.id : null}
                      onSelect={pickVariant}
                      otherValue={storage?.custom ? storage.label : ''}
                      otherInput={variantOther ? {
                        label: specsStorageOnly ? 'Other storage' : 'Other RAM & storage',
                        placeholder: specsStorageOnly ? 'e.g. 256 GB' : 'e.g. 8 GB + 256 GB',
                        autoCapitalize: 'characters',
                        onDone: (t) => { setRam(null); setStorage(typedOption(t)); },
                      } : undefined}
                    />
                  </Field>
                ) : null}

                {/* RAM / Storage (fallback: model has no variants configured) */}
                {!noRamStorage && !useDeviceSpecs && specs.length === 0 && !repairDead ? (
                  <>
                    <Field label="RAM" required={!optionalVariant} optional={optionalVariant}>
                      <FoldGrid
                        valueLabel={ram?.label || ''}
                        cols={optCols}
                        options={rams.map((r) => ({ key: r.id, label: r.label }))}
                        selected={ram && !ram.custom ? ram.id : null}
                        onSelect={(k) => { const r = rams.find((x) => x.id === k); setRam(ram?.id === k ? null : (r || null)); }}
                        otherValue={ram?.custom ? ram.label : ''}
                        otherInput={variantOther ? { label: 'Other RAM', placeholder: 'e.g. 12 GB', autoCapitalize: 'characters', onDone: (t) => setRam(typedOption(t)) } : undefined}
                      />
                    </Field>
                    <Field label="Storage" required={!optionalVariant} optional={optionalVariant}>
                      <FoldGrid
                        valueLabel={storage?.label || ''}
                        cols={optCols}
                        options={storages.map((s) => ({ key: s.id, label: s.label }))}
                        selected={storage && !storage.custom ? storage.id : null}
                        onSelect={(k) => { const s = storages.find((x) => x.id === k); setStorage(storage?.id === k ? null : (s || null)); }}
                        otherValue={storage?.custom ? storage.label : ''}
                        otherInput={variantOther ? { label: 'Other storage', placeholder: 'e.g. 256 GB', autoCapitalize: 'characters', onDone: (t) => setStorage(typedOption(t)) } : undefined}
                      />
                    </Field>
                  </>
                ) : null}

                {/* Laptop RAM / Storage / Storage Type — DB config fields (as in the Partner app) */}
                {useDeviceSpecs && !repairDead ? deviceSpecFields.map((f) => {
                  const cur = spec.values[f.key];
                  return (
                    <Field key={f.key} label={f.label} required={!!f.required && !optionalVariant} optional={!f.required || optionalVariant}>
                      <FoldGrid
                        valueLabel={specLabel(f)}
                        cols={optCols}
                        options={f.options.map((o) => ({ key: o.value, label: o.label }))}
                        selected={cur ?? null}
                        onSelect={(k) => spec.setValue(f.key, cur === k ? null : k)}
                      />
                    </Field>
                  );
                }) : null}
              </>
            )}

            {/* IMEI for sell flow — only for mobile/smartphone categories. */}
            {flow === 'SELL' && !noImei ? (
              <Field label="IMEI Number" required hint="Dial *#06# on your device to find IMEI">
                <TypedField label="IMEI number" value={imei} onChangeText={(t) => setImei(cleanImei(t))} placeholder="15-digit IMEI" keyboardType="number-pad" autoCapitalize="none" />
                {imeiError(imei) ? (
                  <Text style={{ fontSize: rf(11.5), color: '#F32C26', marginTop: 5 }}>{imeiError(imei)}</Text>
                ) : null}
              </Field>
            ) : null}

            {/* ── Select Device summary ─────────────────────────────────── */}
            {crumbs.length ? (
              <View style={{ marginTop: 20, borderRadius: 14, backgroundColor: PAGE_BG, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ flex: 1, fontSize: rf(14), fontWeight: '700', color: INK }}>Select Device</Text>
                  {isCustomModel ? (
                    <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: P.yellowSoft }}>
                      <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: P.ink }}>OTHER MODEL</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 64, height: 76, borderRadius: 10, backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    <PickerImage uri={modelImageUrl} width={56} height={68} fallback={<CategoryIcon size={28} color={ACCENT} />} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                      {crumbs.map((c, i) => (
                        <View key={`${c}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%', marginVertical: 2 }}>
                          <Text style={{ flexShrink: 1, fontSize: rf(13), fontWeight: i === crumbs.length - 1 ? '800' : '500', color: INK }}>{c}</Text>
                          {i < crumbs.length - 1 ? <ChevronRight size={14} color={MUTED} style={{ marginHorizontal: 4 }} /> : null}
                        </View>
                      ))}
                    </View>
                    {summaryColor ? <SummaryLine label="Color" value={summaryColor} /> : null}
                    {summarySpecs ? <SummaryLine label={summarySpecsLabel} value={summarySpecs} /> : null}
                    {modelNumber ? <SummaryLine label="Model Number" value={modelNumber} /> : null}
                    {isCustomModel && !summaryColor && !summarySpecs ? (
                      <Text style={{ marginTop: 4, fontSize: rf(12), color: MUTED }} numberOfLines={2}>{customSummary}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* ── Pinned Next (the header arrow goes back): same onContinue and
            ready rule; Profile keeps its Save / Update wording. ─────────── */}
        <DPNextBar label={ctaLabel} onPress={onContinue} disabled={!ready} loading={saving} />
      </KeyboardAvoidingView>
    </View>
  );
}
