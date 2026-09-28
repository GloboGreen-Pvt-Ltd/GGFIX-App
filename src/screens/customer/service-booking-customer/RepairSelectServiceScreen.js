import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Smartphone, Wrench, Search, Check, Plus, Minus, ArrowLeft, ChevronRight,
  Volume2, BatteryCharging, Shield, Power, Camera, Wifi, Cpu, Gauge, MoreHorizontal, Droplets, Pencil, Lock,
} from 'lucide-react-native';
import {
  BottomActionBar, EmptyState, Loader, Badge, Input, useBottomBarInset,
} from '../../../components/rnr';
import { getRepairServicesGrouped, getDeviceCategories, getRepairCategories } from '../../../api/masterData';
import { rf, rlh } from '../../../utils/responsive';
import { getRepairServiceIcon } from './repairServiceIcons';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEEP = '#004C40';
const PRIMARY = '#006B57';
const MINT = '#E8F7F2';
const SOFT_MINT = '#F4FBF8';
const BORDER = '#DCE7E2';
const INK = '#111827';
const MUTED = '#667085';

// Fallback icon per main category (used when an issue has no uploaded icon).
// Presentation only — order of the tests matters ("DIAGNOSIS" contains "OS").
function iconForGroup(code, name) {
  const s = `${code || ''} ${name || ''}`.toUpperCase();
  if (/\bOTHER\b|DIAGNOS/.test(s)) return MoreHorizontal;
  if (/AUDIO|MIC|SPEAKER|SOUND|RINGTONE/.test(s)) return Volume2;
  if (/DISPLAY|TOUCH|SCREEN|GLASS/.test(s)) return Smartphone;
  if (/POWER|CHARG|BATTERY/.test(s)) return BatteryCharging;
  if (/CAMERA|FLASH|LENS/.test(s)) return Camera;
  if (/NETWORK|SIM|WIFI|SIGNAL|BLUETOOTH|HOTSPOT|CONNECT/.test(s)) return Wifi;
  if (/MOTHERBOARD|\bIC\b|CHIP|BOARD/.test(s)) return Cpu;
  if (/PERFORMANCE|SOFTWARE|HANG|SLOW|UNLOCK|\bOS\b|BACKUP/.test(s)) return Gauge;
  if (/SECURITY|ACCOUNT|LOCK|PASSWORD/.test(s)) return Lock;
  if (/WATER|LIQUID/.test(s)) return Droplets;
  if (/BUTTON|PORT|FINGERPRINT|VIBRATION/.test(s)) return Power;
  if (/BODY|PHYSICAL|PANEL|FRAME|DAMAGE/.test(s)) return Shield;
  return Wrench;
}

function imgUri(item) {
  const b64 = item?.iconBase64 && String(item.iconBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item?.iconUrl && String(item.iconUrl).trim();
  return url || null;
}

// Shared row shell for every problem group (and the custom "Other issue"):
// mint icon tile · thin divider · title (+ caption) · mint +/− circle.
// NOTE: plain style objects only — NativeWind's cssInterop drops
// function-form `style={({ pressed }) => ...}` on native.
function GroupHeader({ Icon, title, caption, captionTone, open, done, onPress }) {
  return (
    <Pressable onPress={onPress} className="active:opacity-80" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, minHeight: 72 }}>
      <View style={{ height: 46, width: 46, borderRadius: 23, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={DEEP} />
      </View>
      <View style={{ width: 1, height: 26, backgroundColor: BORDER, marginHorizontal: 12 }} />
      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
        <Text style={{ fontSize: rf(15), fontWeight: '800', color: INK }} numberOfLines={2}>{title}</Text>
        {caption ? (
          <Text style={{ fontSize: rf(11), fontWeight: captionTone === 'primary' ? '700' : '400', color: captionTone === 'primary' ? PRIMARY : MUTED, marginTop: 2 }} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {done ? (
        <View style={{ height: 18, width: 18, borderRadius: 9, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
          <Check size={11} color="#fff" strokeWidth={2.5} />
        </View>
      ) : null}
      <View
        style={{
          height: 44, width: 44, borderRadius: 22,
          backgroundColor: open ? PRIMARY : MINT,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {open ? <Minus size={20} color="#fff" /> : <Plus size={20} color={DEEP} />}
      </View>
    </Pressable>
  );
}

const rowCard = (active) => ({
  marginBottom: 9, backgroundColor: active ? '#F7FCFA' : '#fff',
  borderWidth: 1, borderColor: active ? '#9AD8C0' : BORDER, borderRadius: 20, overflow: 'hidden',
  shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
});

export default function RepairSelectServiceScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  // This screen draws its own header (round back button + centred title), so
  // the stack's default header is hidden here. Route and title are unchanged.
  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);
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

  const issueCount = selectedCount + (hasOther ? 1 : 0);
  const canContinue = !(selectedCount === 0 && !hasOther);
  const specLine = [device.color, device.ramLabel, device.storageLabel].filter(Boolean).join(' · ');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F8FCFA' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header — round mint back button + centred title. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            className="active:opacity-80"
            style={{ height: 46, width: 46, borderRadius: 23, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={21} color={INK} />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: rf(17), fontWeight: '800', color: INK }}>
            Select Repair Service
          </Text>
          <View style={{ width: 46 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: bottomSpace }} keyboardShouldPersistTaps="handled">
        {/* Selected device summary */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: SOFT_MINT, borderWidth: 1, borderColor: '#D5EDE3', borderRadius: 22,
            paddingVertical: 12, paddingHorizontal: 14,
            shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1,
          }}
        >
          <View style={{ height: 64, width: 56, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            {device.imageUrl ? (
              <Image source={{ uri: device.imageUrl }} style={{ width: 56, height: 64 }} resizeMode="contain" />
            ) : (
              <View style={{ height: 52, width: 52, borderRadius: 16, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={24} color={DEEP} />
              </View>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(10.5), color: MUTED, letterSpacing: 1.4, fontWeight: '600' }}>YOUR DEVICE</Text>
            <Text style={{ fontSize: rf(18), fontWeight: '800', color: INK, marginTop: 2 }} numberOfLines={1}>{device.modelName || 'Device'}</Text>
            {specLine ? (
              <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 2 }} numberOfLines={1}>{specLine}</Text>
            ) : null}
          </View>
          {selectedCount > 0 ? <Badge variant="default">{selectedCount} SELECTED</Badge> : null}
        </View>

        <Text style={{ fontSize: rf(18), fontWeight: '800', color: INK, marginTop: 18 }}>Select the Problems</Text>
        <Text style={{ fontSize: rf(12.5), color: MUTED, marginTop: 2, marginBottom: 12 }}>Choose one or more issues to repair</Text>

        {groups.length === 0 ? (
          <EmptyState
            icon={<Search size={28} color={DEEP} />}
            title="No services found"
            description="No repair services configured for this device category."
          />
        ) : (
          groups.map((g) => {
            const open = !!expanded[g.id];
            const groupSelected = (g.issues || []).filter((s) => selectedIds.includes(s.id)).length;
            const FallbackIcon = iconForGroup(g.code, g.name);
            return (
              <View key={g.id} style={rowCard(groupSelected > 0 || open)}>
                <GroupHeader
                  Icon={FallbackIcon}
                  title={g.name}
                  caption={groupSelected > 0 ? `${groupSelected} selected` : null}
                  captionTone="primary"
                  open={open}
                  onPress={() => toggleGroup(g.id)}
                />

                {/* Issues as a compact icon-card grid */}
                {open ? (
                  <View style={{ paddingHorizontal: 6, paddingBottom: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: BORDER }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {(g.issues || []).map((s) => {
                        const checked = selectedIds.includes(s.id);
                        const uri = imgUri(s);
                        // Per-service icon (e.g. Mic, Ear, VolumeX); an uploaded
                        // admin icon still takes precedence.
                        const ServiceIcon = getRepairServiceIcon(s.name, g.code, g.name);
                        return (
                          <View key={s.id} style={{ width: `${100 / cols}%`, padding: 4 }}>
                            <Pressable
                              onPress={() => toggle(s.id)}
                              className="active:opacity-80"
                              style={{
                                minHeight: 88, borderRadius: 16, padding: 8, alignItems: 'center',
                                borderWidth: 1.5, borderColor: checked ? PRIMARY : BORDER,
                                backgroundColor: checked ? MINT : '#fff',
                              }}
                            >
                              {checked ? (
                                <View style={{ position: 'absolute', right: 6, top: 6, height: 18, width: 18, borderRadius: 9, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }}>
                                  <Check size={11} color="#fff" strokeWidth={2.5} />
                                </View>
                              ) : null}
                              <View style={{ height: 40, width: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden', backgroundColor: checked ? '#D3F0E3' : SOFT_MINT }}>
                                {uri ? (
                                  <Image source={{ uri }} style={{ width: 40, height: 40 }} resizeMode="cover" />
                                ) : (
                                  <ServiceIcon size={20} color={checked ? DEEP : '#64748B'} />
                                )}
                              </View>
                              <Text style={{ fontSize: rf(10.5), lineHeight: rlh(13.5), fontWeight: '700', textAlign: 'center', color: checked ? DEEP : INK }} numberOfLines={2}>
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
        <View style={rowCard(hasOther || otherOpen)}>
          <GroupHeader
            Icon={Pencil}
            title="Other issue"
            caption={hasOther
              ? `${otherCat ? `${otherCat.name} · ` : ''}${otherText.trim()}`
              : "Can't find your problem? Describe it here"}
            open={otherOpen}
            done={hasOther}
            onPress={() => setOtherOpen((v) => !v)}
          />

          {otherOpen ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: BORDER }}>
              {catOptions.length ? (
                <>
                  <Text style={{ fontSize: rf(11), fontWeight: '800', color: MUTED, letterSpacing: 1, marginTop: 10, marginBottom: 8 }}>SELECT REPAIR CATEGORY</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -2, marginBottom: 12 }}>
                    {catOptions.map((c) => {
                      const active = otherCat?.id === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setOtherCat(active ? null : c)}
                          className="active:opacity-80"
                          style={{
                            margin: 2, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
                            borderColor: active ? PRIMARY : BORDER, backgroundColor: active ? MINT : '#fff',
                          }}
                        >
                          <Text style={{ fontSize: rf(11), fontWeight: '700', color: active ? DEEP : INK }} numberOfLines={1}>{c.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <Text style={{ fontSize: rf(11), fontWeight: '800', color: MUTED, letterSpacing: 1, marginBottom: 6 }}>DESCRIBE THE ISSUE</Text>
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
          <View style={{ backgroundColor: SOFT_MINT, borderWidth: 1, borderColor: '#D5EDE3', borderRadius: 16, padding: 12, marginTop: 2, flexDirection: 'row', alignItems: 'center' }}>
            <Wrench size={14} color={DEEP} />
            <Text style={{ fontSize: rf(12), color: INK, marginLeft: 8, flex: 1 }}>
              You've added <Text style={{ fontWeight: '800', color: PRIMARY }}>{issueCount}</Text> issue{issueCount === 1 ? '' : 's'}.
              Next, you'll get a price estimate.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky bottom bar — selected count · divider · Continue. Same count,
          disabled rule and onContinue handler as before. */}
      <BottomActionBar>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ minWidth: 58, paddingRight: 12 }}>
            <Text style={{ fontSize: rf(11.5), color: MUTED }}>Selected</Text>
            <Text style={{ fontSize: rf(20), fontWeight: '800', color: INK, lineHeight: rf(24) }}>{issueCount}</Text>
            <Text style={{ fontSize: rf(11.5), color: MUTED }}>{`issue${issueCount === 1 ? '' : 's'}`}</Text>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: BORDER, marginRight: 14 }} />
          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            className={canContinue ? 'active:opacity-90' : ''}
            style={{
              flex: 1, height: 58, borderRadius: 26,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: canContinue ? PRIMARY : '#8FC5B8',
              shadowColor: DEEP, shadowOpacity: canContinue ? 0.2 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
              elevation: canContinue ? 3 : 0,
            }}
          >
            <Text style={{ color: canContinue ? '#fff' : 'rgba(255,255,255,0.85)', fontSize: rf(16), fontWeight: '800', marginRight: 6 }}>Continue</Text>
            <ChevronRight size={20} color={canContinue ? '#fff' : 'rgba(255,255,255,0.85)'} />
          </Pressable>
        </View>
      </BottomActionBar>
    </KeyboardAvoidingView>
  );
}
