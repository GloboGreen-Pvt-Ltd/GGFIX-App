import React, { useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  Smartphone, Wrench, Search, Check, Plus, Minus,
  Volume2, Zap, Aperture, Wifi, Cpu, Droplets, LayoutGrid, Pencil,
} from 'lucide-react-native';
import {
  BottomActionBar, EmptyState, Loader, Badge, Input, useBottomBarInset,
} from '../../../components/rnr';
import { getRepairServicesGrouped, getDeviceCategories, getRepairCategories } from '../../../api/masterData';
import { rf, rlh } from '../../../utils/responsive';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fallback icon per main category (used when an issue has no uploaded icon).
function iconForGroup(code, name) {
  const s = `${code || ''} ${name || ''}`.toUpperCase();
  if (/AUDIO|MIC|SPEAKER|SOUND|RINGTONE/.test(s)) return Volume2;
  if (/DISPLAY|TOUCH|SCREEN|GLASS/.test(s)) return Smartphone;
  if (/POWER|CHARG|BATTERY/.test(s)) return Zap;
  if (/CAMERA|FLASH|LENS/.test(s)) return Aperture;
  if (/NETWORK|SIM|WIFI|SIGNAL|BLUETOOTH|HOTSPOT/.test(s)) return Wifi;
  if (/SOFTWARE|HANG|SLOW|UNLOCK|OS|FLASH|BACKUP/.test(s)) return Cpu;
  if (/WATER|LIQUID/.test(s)) return Droplets;
  if (/BODY|BUTTON|FINGERPRINT|PANEL|FRAME|VIBRATION/.test(s)) return LayoutGrid;
  return Wrench;
}

function imgUri(item) {
  const b64 = item?.iconBase64 && String(item.iconBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item?.iconUrl && String(item.iconUrl).trim();
  return url || null;
}

export default function RepairSelectServiceScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const device = route?.params?.device || {};
  const { width } = useWindowDimensions();
  const cols = width >= 1024 ? 5 : width >= 700 ? 4 : 3;
  const [groups, setGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  // "Other" custom issue — free-text description + optional repair category, for
  // problems the predefined list doesn't cover.
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [otherCat, setOtherCat] = useState(null);
  const [repairCats, setRepairCats] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let catId = UUID_RE.test(String(device.categoryId || '')) ? device.categoryId : null;
        if (!catId && device.categoryCode) {
          const cats = await getDeviceCategories().catch(() => []);
          const m = (cats || []).find((c) => (c.code || '').toUpperCase() === String(device.categoryCode).toUpperCase());
          catId = m?.id || null;
        }
        let g = catId ? await getRepairServicesGrouped(catId) : [];
        g = (g || []).filter((x) => (x.issues || []).length > 0);
        if (!cancelled) setGroups(g);
        // Repair categories for the "Other" issue tag — used when the grouped
        // services are empty (nothing configured for this device category).
        const rc = await getRepairCategories().catch(() => []);
        if (!cancelled) setRepairCats(rc || []);
      } catch (_) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [device.categoryId, device.categoryCode]);

  const toggle = (id) => setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleGroup = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const allIssues = useMemo(() => groups.flatMap((g) => g.issues || []), [groups]);

  const hasOther = otherText.trim().length > 0;
  // Category chips for the "Other" issue — prefer the device-relevant grouped
  // categories, else the global repair-category master list.
  const catOptions = useMemo(
    () => (groups.length
      ? groups.map((g) => ({ id: g.id, name: g.name }))
      : (repairCats || []).map((c) => ({ id: c.id, name: c.name }))),
    [groups, repairCats],
  );

  const onContinue = () => {
    const chosen = allIssues.filter((s) => selectedIds.includes(s.id));
    // A custom "Other" issue is carried as a non-priced service flagged
    // `custom: true`. Downstream, RepairCompleteOrder keeps it OUT of the
    // backend services[] (its id isn't a real UUID) and folds the text into the
    // booking's issueSummary instead.
    const custom = hasOther
      ? [{
          id: 'OTHER',
          custom: true,
          code: 'OTHER',
          name: otherText.trim(),
          categoryId: otherCat?.id,
          categoryName: otherCat?.name,
          price: null,
        }]
      : [];
    navigation.navigate('RepairReview', { device, services: [...chosen, ...custom] });
  };

  if (loading) return <Loader label="Loading services..." />;

  const selectedCount = selectedIds.length;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      {/* Device summary + search */}
      <View className="bg-card border-b border-border px-4 pt-3 pb-3">
        <View className="flex-row items-center mb-3">
          <View className="h-11 w-11 rounded-2xl bg-primary/10 items-center justify-center mr-3 overflow-hidden">
            {device.imageUrl ? (
              <Image source={{ uri: device.imageUrl }} style={{ width: 44, height: 44 }} resizeMode="cover" />
            ) : (
              <Smartphone size={20} color="#00008B" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-text-muted uppercase tracking-widest" style={{ fontSize: rf(10) }}>Your Device</Text>
            <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{device.modelName || 'Device'}</Text>
            <View className="flex-row items-center mt-0.5 flex-wrap">
              {device.color ? <Text className="text-text-muted" style={{ fontSize: rf(10) }}>{device.color}</Text> : null}
              {device.ramLabel ? <Text className="text-text-muted" style={{ fontSize: rf(10) }}> · {device.ramLabel}</Text> : null}
              {device.storageLabel ? <Text className="text-text-muted" style={{ fontSize: rf(10) }}> · {device.storageLabel}</Text> : null}
            </View>
          </View>
          {selectedCount > 0 ? <Badge variant="default">{selectedCount} SELECTED</Badge> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }} keyboardShouldPersistTaps="handled">
        <Text className="font-extrabold text-text-muted tracking-widest mb-3" style={{ fontSize: rf(11) }}>SELECT THE PROBLEMS</Text>

        {groups.length === 0 ? (
          <EmptyState
            icon={<Search size={28} color="#00008B" />}
            title="No services found"
            description="No repair services configured for this device category."
          />
        ) : (
          groups.map((g) => {
            const open = !!expanded[g.id];
            const groupSelected = (g.issues || []).filter((s) => selectedIds.includes(s.id)).length;
            const FallbackIcon = iconForGroup(g.code, g.name);
            return (
              <View
                key={g.id}
                className="mb-2.5 bg-card border border-border rounded-2xl overflow-hidden"
                style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
              >
                {/* Main category header — title + circular +/- toggle */}
                <Pressable onPress={() => toggleGroup(g.id)} className="flex-row items-center px-3.5 py-3 active:opacity-80">
                  <View className="flex-1 pr-3">
                    <Text className="font-extrabold text-text leading-5" style={{ fontSize: rf(14) }}>{g.name}</Text>
                    {groupSelected > 0 ? (
                      <Text className="font-bold text-primary mt-0.5" style={{ fontSize: rf(10) }}>{groupSelected} selected</Text>
                    ) : null}
                  </View>
                  <View className={`h-7 w-7 rounded-full border items-center justify-center ${open ? 'border-primary bg-primary/5' : 'border-text-muted/40'}`}>
                    {open ? <Minus size={14} color="#00008B" /> : <Plus size={14} color="#0F172A" />}
                  </View>
                </Pressable>

                {/* Issues as a compact icon-card grid */}
                {open ? (
                  <View className="px-1.5 pb-2 pt-1 border-t border-border">
                    <View className="flex-row flex-wrap">
                      {(g.issues || []).map((s) => {
                        const checked = selectedIds.includes(s.id);
                        const uri = imgUri(s);
                        return (
                          <View key={s.id} style={{ width: `${100 / cols}%` }} className="p-1">
                            <Pressable
                              onPress={() => toggle(s.id)}
                              className={`rounded-xl border p-2 items-center active:opacity-80 ${checked ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                              style={{ minHeight: 84 }}
                            >
                              {checked ? (
                                <View className="absolute right-1.5 top-1.5 h-4 w-4 rounded-full bg-primary items-center justify-center">
                                  <Check size={10} color="#fff" strokeWidth={2} />
                                </View>
                              ) : null}
                              <View className={`h-10 w-10 rounded-xl items-center justify-center mb-1.5 overflow-hidden ${checked ? 'bg-primary/10' : 'bg-background'}`}>
                                {uri ? (
                                  <Image source={{ uri }} style={{ width: 40, height: 40 }} resizeMode="cover" />
                                ) : (
                                  <FallbackIcon size={20} color={checked ? '#00008B' : '#64748B'} />
                                )}
                              </View>
                              <Text className={` font-bold text-center ${checked ? 'text-primary' : 'text-text'}`} style={{ fontSize: rf(10), lineHeight: rlh(13) }} numberOfLines={2}>
                                {s.name}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {/* Other / custom issue — for problems not in the list. Optionally tag a
            repair category, then describe the issue in free text. */}
        <View
          className="mb-2.5 bg-card border border-border rounded-2xl overflow-hidden"
          style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
        >
          <Pressable onPress={() => setOtherOpen((v) => !v)} className="flex-row items-center px-3.5 py-3 active:opacity-80">
            <View className="h-9 w-9 rounded-xl bg-primary/10 items-center justify-center mr-3">
              <Pencil size={16} color="#00008B" />
            </View>
            <View className="flex-1 pr-2">
              <Text className="font-extrabold text-text leading-5" style={{ fontSize: rf(14) }}>Other issue</Text>
              <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }} numberOfLines={1}>
                {hasOther
                  ? `${otherCat ? `${otherCat.name} · ` : ''}${otherText.trim()}`
                  : "Can't find your problem? Describe it here"}
              </Text>
            </View>
            {hasOther ? (
              <View className="h-4 w-4 rounded-full bg-primary items-center justify-center mr-2">
                <Check size={10} color="#fff" strokeWidth={2} />
              </View>
            ) : null}
            <View className={`h-7 w-7 rounded-full border items-center justify-center ${otherOpen ? 'border-primary bg-primary/5' : 'border-text-muted/40'}`}>
              {otherOpen ? <Minus size={14} color="#00008B" /> : <Plus size={14} color="#0F172A" />}
            </View>
          </Pressable>

          {otherOpen ? (
            <View className="px-3.5 pb-3.5 pt-1 border-t border-border">
              {catOptions.length ? (
                <>
                  <Text className="font-extrabold text-text-muted tracking-wider mt-2.5 mb-2" style={{ fontSize: rf(11) }}>SELECT REPAIR CATEGORY</Text>
                  <View className="flex-row flex-wrap -m-0.5 mb-3">
                    {catOptions.map((c) => {
                      const active = otherCat?.id === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setOtherCat(active ? null : c)}
                          className={`m-0.5 rounded-full border px-3 py-1.5 active:opacity-80 ${active ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                        >
                          <Text className={` font-bold ${active ? 'text-primary' : 'text-text'}`} style={{ fontSize: rf(11) }} numberOfLines={1}>{c.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <Text className="font-extrabold text-text-muted tracking-wider mb-1.5" style={{ fontSize: rf(11) }}>DESCRIBE THE ISSUE</Text>
              <Input
                placeholder="E.g. Phone restarts randomly, back glass cracked…"
                value={otherText}
                onChangeText={setOtherText}
                multiline
                style={{ fontSize: rf(13), minHeight: 76, textAlignVertical: 'top' }}
              />
            </View>
          ) : null}
        </View>

        {selectedCount > 0 || hasOther ? (
          <View className="bg-primary/5 border border-primary/10 rounded-2xl p-3 mt-1 flex-row items-center">
            <Wrench size={14} color="#00008B" />
            <Text className="text-text ml-2 flex-1" style={{ fontSize: rf(12) }}>
              You've added <Text className="font-extrabold text-primary">{selectedCount + (hasOther ? 1 : 0)}</Text> issue{selectedCount + (hasOther ? 1 : 0) === 1 ? '' : 's'}.
              Next, you'll get a price estimate.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomActionBar
        priceCaption="Selected"
        priceValue={`${selectedCount + (hasOther ? 1 : 0)}`}
        priceLabel={`issue${selectedCount + (hasOther ? 1 : 0) === 1 ? '' : 's'}`}
        title="Continue"
        onPress={onContinue}
        disabled={selectedCount === 0 && !hasOther}
      />
    </KeyboardAvoidingView>
  );
}
