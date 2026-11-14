import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { Smartphone, Wrench, Search, ArrowRight, Sparkles, MessageSquarePlus, X, User, Pencil, Barcode, Hash, ChevronDown, Plus } from 'lucide-react-native';
import { BottomActionBar, Loader, useBottomBarInset } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { getRepairServices, getRepairServicesGrouped, getDeviceCategories, getRepairCategories } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { lockTypesFor, resolveSpecCategory } from '../../../utils/deviceSpecs';
import { useImeiApplies, cleanImei, isValidImei, imeiError, IMEI_LENGTH } from '../../../utils/imeiPolicy';
import { selectSession } from '../../../store/authSlice';
import { BookingHeader, useHideStackHeader } from './FlowChrome';
import RepairIssueGroups, { IssueGlyph, SelectedIssueRow } from './RepairIssueGroups';
import VoiceNoteRecorder from './VoiceNoteRecorder';
import DeviceSecurityLockSheet, { BookingSheet } from './DeviceSecurityLockSheet';
import BookingTimeSection from './BookingTimeSection';
import { getCartDevices, removeCartDevice, upsertCartDevice } from './bookingCart';
import { issueLabel } from './RepairIssueGroups';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Partner "Devices & Repair" palette.
const ACCENT = '#035C6C';
const MINT = '#E5F3F5';
const MINT_LINE = '#C7E6EA';
const INK = '#111111';
const MUTED = '#6B7280';
const PLACEHOLDER = '#9CA3AF';
const LINE = '#E5E7EB';
const RED_TEXT = '#D63232';
const PAGE_BG = '#F3F4F6';

// Device photos (optional, up to 5) + one optional video, as on Partner.
// Photo 1 / 2 become the booking's front / back images; the rest ride along
// in `media.more` (RepairCompleteOrder uploads them and lists the links).
const PHOTO_MAX = 5;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // master-data /media/upload limit
// Device Security options beside "None" (Partner LOCK_FIELD_OPTIONS).
const LOCK_FIELD_OPTIONS = [
  { key: 'PIN', label: 'PIN' },
  { key: 'PATTERN', label: 'Pattern' },
  { key: 'PASSWORD', label: 'Password' },
  { key: 'ACCOUNT', label: 'iCloud / Google Account' },
];

const card ={ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE };
const sectionTitle = { fontSize: rf(14), fontWeight: '700', color: INK, marginBottom: 8 };
const col = { width: '100%', maxWidth: 720, alignSelf: 'center' };

export default function RepairSelectServiceScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  // This screen draws its own header (BookingHeader), so the stack's default
  // header is hidden here. Route and title are unchanged.
  useHideStackHeader(navigation);
  const device = route?.params?.device || {};
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const [groups, setGroups] = useState([]);
  // true when `groups` is the catalogue fallback (grouped by repair category)
  // rather than the device category's own grouped services.
  const [fromCatalog, setFromCatalog] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  // "Other" custom issue — free-text description + optional repair category, for
  // problems the predefined list doesn't cover.
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [otherCat, setOtherCat] = useState(null);
  const [repairCats, setRepairCats] = useState([]);

  // ── Partner "Devices & Repair" extras (all optional). The booking API has no
  // columns for most of them, so RepairCompleteOrder writes them into the
  // issueSummary; photos / video map onto front / back / video.
  const session = useSelector(selectSession);
  const showImei = useImeiApplies(device); // mobile phones only; others get Serial Number
  const [voiceUri, setVoiceUri] = useState('');
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [photos, setPhotos] = useState([]); // image-picker assets, up to PHOTO_MAX
  const [video, setVideo] = useState(null);
  // Media sheet: { mode: 'add', kind: 'video' } | { mode: 'item' | 'replace', kind, index }.
  const [mediaSheet, setMediaSheet] = useState(null);
  const [accessories, setAccessories] = useState('');
  // Booking time (page opened) and expected delivery (default +2 hr).
  const [bookedAt] = useState(() => new Date());
  const [delivery, setDelivery] = useState(() => new Date(Date.now() + 2 * 60 * 60000));
  // This device's slot in the booking list ("Add Another Device").
  const entryIdRef = useRef(`dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [lockType, setLockType] = useState('NONE');
  const [lockValue, setLockValue] = useState('');
  const [lockOpen, setLockOpen] = useState(false);
  const [lockSheet, setLockSheet] = useState(null); // initialLock while the popup is open

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
        // Repair categories for the "Other" issue tag — used when the grouped
        // services are empty (nothing configured for this device category).
        const rc = await getRepairCategories().catch(() => []);
        let fallback = false;
        if (!g.length) {
          // Same fallback as the Partner app: the full repair-service catalogue,
          // grouped by repair category.
          const all = await getRepairServices().catch(() => []);
          const catById = {};
          (rc || []).forEach((c) => { catById[c.id] = c; });
          const byCat = new Map();
          (Array.isArray(all) ? all : []).forEach((s) => {
            if (!s?.id) return;
            const key = s.categoryId || '__ungrouped__';
            if (!byCat.has(key)) byCat.set(key, { id: key, name: catById[key]?.name || 'Other', code: catById[key]?.code, issues: [] });
            byCat.get(key).issues.push(s);
          });
          g = Array.from(byCat.values());
          fallback = g.length > 0;
        }
        if (!cancelled) {
          setGroups(g);
          setFromCatalog(fallback);
          setRepairCats(rc || []);
        }
      } catch (_) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [device.categoryId, device.categoryCode]);

  const toggle = (id) => setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const allIssues = useMemo(() => groups.flatMap((g) => g.issues || []), [groups]);
  // issue id → its group (for the selected rows' caption + icon).
  const groupOf = useMemo(() => {
    const m = {};
    groups.forEach((g) => (g.issues || []).forEach((s) => { if (!m[s.id]) m[s.id] = g; }));
    return m;
  }, [groups]);

  const hasOther = otherText.trim().length > 0;
  // Category chips for the "Other" issue — prefer the device-relevant grouped
  // categories, else the global repair-category master list.
  const catOptions = useMemo(
    () => (groups.length && !fromCatalog
      ? groups.map((g) => ({ id: g.id, name: g.name }))
      : (repairCats || []).map((c) => ({ id: c.id, name: c.name }))),
    [groups, fromCatalog, repairCats],
  );

  // Search found nothing → the typed text becomes (or extends) the Other issue.
  const addTypedOther = (text) => {
    setOtherText((p) => (p.trim() ? `${p.trim()}, ${text}` : text));
    setOtherOpen(true);
  };
  const clearOther = () => { setOtherText(''); setOtherCat(null); setOtherOpen(false); };

  // ── Device Photo or Video (Partner pickMedia): straight to camera / gallery.
  // kind: 'photo' | 'video'; target.index replaces that photo, else appends.
  const pickMedia = async (kind, fromCamera, target = {}) => {
    const isVideo = kind === 'video';
    // Web has no native camera picker — use the file dialog.
    const useCamera = fromCamera && Platform.OS !== 'web';
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        notify('Permission needed', useCamera
          ? 'Allow camera access to add device photos or video.'
          : 'Allow media library access to add device photos or video.');
        return;
      }
      const opts = isVideo
        ? { mediaTypes: 'videos', allowsEditing: false, videoMaxDuration: 15, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium }
        : { mediaTypes: 'images', allowsEditing: false, quality: 0.7 };
      const result = useCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_MEDIA_BYTES) {
        notify(isVideo ? 'Video too large' : 'Photo too large', isVideo
          ? 'The limit is 10 MB. Choose a shorter clip (about 5–8 seconds).'
          : 'The limit is 10 MB. Choose a smaller photo and try again.');
        return;
      }
      if (isVideo) setVideo(asset);
      else if (typeof target.index === 'number') setPhotos((list) => list.map((a, n) => (n === target.index ? asset : a)));
      else setPhotos((list) => (list.length >= PHOTO_MAX ? list : [...list, asset]));
    } catch (e) {
      notify('Couldn\'t pick media', e?.message || 'Try again');
    }
  };
  // Close the sheet first, then open the picker — presenting a picker while a
  // modal is still sliding out is unreliable on iOS.
  const chooseMedia = (kind, fromCamera, target) => {
    setMediaSheet(null);
    setTimeout(() => pickMedia(kind, fromCamera, target), 320);
  };
  const removeMedia = (kind, index) => {
    if (kind === 'video') setVideo(null);
    else setPhotos((list) => list.filter((_, n) => n !== index));
  };

  // ── Device Security (Partner): lock types this device can have.
  const specCategory = resolveSpecCategory(device.deviceCategory, device.categoryCode, device.categoryName);
  const lockTypes = lockTypesFor(specCategory);
  const lockOptions = [{ key: 'NONE', label: 'None' }, ...LOCK_FIELD_OPTIONS.filter((o) =>
    (o.key === 'ACCOUNT' ? lockTypes.includes('PATTERN') : lockTypes.includes(o.key)))];
  const pickLock = (key) => {
    if (key === 'NONE') { setLockType('NONE'); setLockValue(''); return; }
    setLockSheet({ type: key, value: lockType === key ? lockValue : '' });
  };
  // IMEI is optional: empty is fine; a number that IS typed must be 14–17 digits.
  const imeiDigits = cleanImei(imei);
  const imeiValid = isValidImei(imeiDigits);
  const imeiOk = !showImei || imeiDigits.length === 0 || imeiValid;

  // This device's booking entry — picked issues, media and extras.
  const buildEntry = () => {
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
    // Photos / video are captured right here (Partner), so the separate
    // RepairReview photos page is skipped: go straight on to Service Options
    // with the same `media` shape it used to pass (front / back / video).
    const media = { front: photos[0] || null, back: photos[1] || null, video: video || null, more: photos.slice(2) };
    // Optional Partner fields — RepairCompleteOrder folds them into issueSummary.
    const bookingExtras = {
      voiceNoteUri: voiceUri || undefined,
      imei: showImei ? (imeiDigits || undefined) : undefined,
      serialNumber: showImei ? undefined : (serialNumber.trim() || undefined),
      accessories: accessories.trim() || undefined,
      lock: lockOptions.length > 1 && lockType !== 'NONE' ? { type: lockType, value: lockValue.trim() } : undefined,
      bookingTime: bookedAt.toISOString(),
      expectedDelivery: delivery.toISOString(),
      customerApproved: true, // the customer is booking it themselves
    };
    return { entryId: entryIdRef.current, device, services: [...chosen, ...custom], media, bookingExtras };
  };
  // Save & Continue: this device goes on as the current one (not in the list).
  const onContinue = () => {
    const { entryId, ...entry } = buildEntry();
    removeCartDevice(entryId);
    navigation.navigate('RepairServiceOptions', entry);
  };
  // Add Another Device: keep this device in the booking, pick the next one.
  const onAddAnother = () => {
    upsertCartDevice(buildEntry());
    navigation.navigate('DeviceDetails', { flow: 'REPAIR' });
  };

  if (loading) return <Loader label="Loading services..." />;

  const selectedCount = selectedIds.length;

  const issueCount = selectedCount + (hasOther ? 1 : 0);
  // A typed IMEI must be valid; a voice note still recording must be stopped.
  const canContinue = !(selectedCount === 0 && !hasOther) && imeiOk && !voiceRecording;
  // Devices already added to this booking (not this one).
  const otherDevices = getCartDevices().filter((e) => e.entryId !== entryIdRef.current);
  // Customer card — the signed-in customer (session).
  const customerName = session?.fullName || '';
  const customerPhone = session?.mobile || '';
  // Photo / video thumbnails (Partner mediaItems).
  const mediaItems = [
    ...photos.map((a, i) => ({ kind: 'photo', uri: a.uri, index: i, label: `Photo ${i + 1}` })),
    ...(video ? [{ kind: 'video', uri: video.uri, index: 0, label: 'Video' }] : []),
  ];
  const canAddPhoto = photos.length < PHOTO_MAX;
  // 3 thumbnails per row on phones, 5 on tablets (a hair under, so rounding never wraps).
  const mediaPct = `${(100 / (isTablet ? 5 : 3)) - 0.1}%`;
  const lockLabel = (lockOptions.find((o) => o.key === lockType) || {}).label || 'None';
  // Never the secret itself on this summary — only that one is set.
  const lockSummary = lockType === 'PIN' ? (lockValue ? `PIN set · ${lockValue.length} digits` : '')
    : lockType === 'PASSWORD' ? (lockValue ? 'Password set' : '')
    : lockType === 'PATTERN' ? lockValue.split(',').filter(Boolean).join(' → ')
    : lockType === 'ACCOUNT' ? (lockValue ? 'Account noted' : '')
    : '';
  const specLine = [[device.ramLabel, device.storageLabel].filter(Boolean).join(' / '), device.color].filter(Boolean).join(' · ');
  const brandPrefix = device.brandName && !String(device.modelName || '').toLowerCase().startsWith(String(device.brandName).toLowerCase())
    ? device.brandName : null;
  const deviceTitle = [brandPrefix, device.modelName].filter(Boolean).join(' ') || 'Device';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <BookingHeader title="Devices & Repair" subtitle="Add device and repair details" navigation={navigation} step={1} />

      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} keyboardShouldPersistTaps="handled">
        <View style={[col, { paddingHorizontal: 16 }]}>
          {/* ── Customer (the signed-in customer) — pencil opens Edit Profile ── */}
          <View style={{ paddingTop: 12 }}>
            <View style={[card, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9 }]}>
              <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
                <User size={rf(16)} color={ACCENT} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text style={{ fontSize: rf(11), color: MUTED }}>Customer</Text>
                <Text style={{ fontSize: rf(14), fontWeight: '800', color: INK }} numberOfLines={1}>
                  {customerName || '—'}
                  {customerPhone ? <Text style={{ fontWeight: '500', color: MUTED }}>{`  ·  ${customerPhone}`}</Text> : null}
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('EditProfile')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Edit customer"
                className="active:opacity-70"
                style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: PAGE_BG, alignItems: 'center', justifyContent: 'center' }}
              >
                <Pencil size={rf(15)} color={ACCENT} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* ── Device Information ── */}
          <View style={{ paddingTop: 14 }}>
            <Text style={sectionTitle}>Device Information</Text>
            <View style={[card, { flexDirection: 'row', alignItems: 'center', padding: 10 }]}>
              <View style={{ height: 64, width: 64, borderRadius: 12, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {device.imageUrl ? (
                  <Image source={{ uri: device.imageUrl }} style={{ width: '88%', height: '88%' }} resizeMode="contain" />
                ) : (
                  <Smartphone size={26} color={ACCENT} strokeWidth={1.75} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text style={{ fontSize: rf(14), fontWeight: '800', color: INK }} numberOfLines={2}>{deviceTitle}</Text>
                {specLine ? <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 1 }} numberOfLines={1}>{specLine}</Text> : null}
                {device.modelNumber ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }} numberOfLines={1}>{device.modelNumber}</Text> : null}
              </View>
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Change device"
                className="active:opacity-70"
                style={{ marginLeft: 8, minHeight: 32, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: ACCENT, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: ACCENT }}>Change</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Repair Issues — search, issue groups, then the picked issues ── */}
          <View style={{ paddingTop: 16 }}>
            <Text style={sectionTitle}>
              Repair Issues<Text style={{ color: RED_TEXT }}> *</Text>
            </Text>

            {groups.length === 0 ? (
              <View style={[card, { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8 }]}>
                <View style={{ height: 36, width: 36, borderRadius: 18, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={18} color={ACCENT} />
                </View>
                <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <Text style={{ fontSize: rf(13), fontWeight: '800', color: INK }}>No services found</Text>
                  <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }}>No repair services configured for this device category.</Text>
                </View>
              </View>
            ) : null}

            <RepairIssueGroups
              groups={groups}
              selectedIds={selectedIds}
              onToggle={toggle}
              otherPicked={hasOther}
              otherOpen={otherOpen}
              onOtherPress={() => setOtherOpen((v) => !v)}
              onAddTypedOther={addTypedOther}
              isTablet={isTablet}
            />

            {/* Other / custom issue — for problems not in the list. Optionally tag a
                repair category, then describe the issue in free text. */}
            {otherOpen ? (
              <View style={[card, { padding: 12, marginTop: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <MessageSquarePlus size={20} color={INK} strokeWidth={1.75} />
                  <Text style={{ flex: 1, marginLeft: 10, fontSize: rf(14), fontWeight: '800', color: INK }}>Other Issue</Text>
                  <Pressable onPress={() => setOtherOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close other issue">
                    <X size={18} color={MUTED} />
                  </Pressable>
                </View>
                {catOptions.length ? (
                  <>
                    <Text style={{ fontSize: rf(12), fontWeight: '700', color: MUTED, marginBottom: 6 }}>Select repair category</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -3, marginBottom: 9 }}>
                      {catOptions.map((c) => {
                        const active = otherCat?.id === c.id;
                        return (
                          <Pressable
                            key={c.id}
                            onPress={() => setOtherCat(active ? null : c)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            className="active:opacity-80"
                            style={{
                              margin: 3, minHeight: 34, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 12,
                              borderWidth: active ? 1.5 : 1, borderColor: active ? ACCENT : LINE, backgroundColor: active ? MINT : '#FFFFFF',
                            }}
                          >
                            <Text style={{ fontSize: rf(12), fontWeight: active ? '700' : '500', color: active ? ACCENT : INK }} numberOfLines={1}>{c.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                <Text style={{ fontSize: rf(12), fontWeight: '700', color: MUTED, marginBottom: 6 }}>Describe the issue</Text>
                <TextInput
                  placeholder="E.g. Phone restarts randomly, back glass cracked…"
                  placeholderTextColor={PLACEHOLDER}
                  value={otherText}
                  onChangeText={setOtherText}
                  multiline
                  cursorColor={ACCENT}
                  accessibilityLabel="Describe the issue"
                  style={{
                    minHeight: 88, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#F9FAFB',
                    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: rf(13), color: INK, textAlignVertical: 'top',
                  }}
                />
              </View>
            ) : null}

            {/* Selected services — no price / warranty here (the shop prices). */}
            {issueCount > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: INK, marginBottom: 8 }}>Selected Services ({issueCount})</Text>
                {selectedIds.map((id) => {
                  const s = allIssues.find((x) => x.id === id);
                  if (!s) return null;
                  const g = groupOf[id];
                  return (
                    <SelectedIssueRow
                      key={id}
                      name={s.name}
                      sub={g?.name}
                      glyph={<IssueGlyph item={s} groupCode={g?.code} groupName={g?.name} size={18} color={ACCENT} />}
                      onRemove={() => toggle(id)}
                    />
                  );
                })}
                {hasOther ? (
                  <SelectedIssueRow
                    name={otherText.trim()}
                    sub={otherCat ? `Other Issue · ${otherCat.name}` : 'Other Issue'}
                    glyph={<Sparkles size={18} color={ACCENT} />}
                    onRemove={clearOther}
                  />
                ) : null}
                <View style={{ backgroundColor: MINT, borderWidth: 1, borderColor: MINT_LINE, borderRadius: 12, padding: 10, marginTop: 2, flexDirection: 'row', alignItems: 'center' }}>
                  <Wrench size={14} color={ACCENT} />
                  <Text style={{ fontSize: rf(12), color: INK, marginLeft: 8, flex: 1 }}>
                    You've added <Text style={{ fontWeight: '800', color: ACCENT }}>{issueCount}</Text> issue{issueCount === 1 ? '' : 's'}.
                    Next, you'll get a price estimate.
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* ── Record Voice Note (optional) ── */}
          <View style={{ marginTop: 12 }}>
            <VoiceNoteRecorder uri={voiceUri} onChange={setVoiceUri} onRecordingChange={setVoiceRecording} />
          </View>

          {/* ── IMEI (mobile phones) / Serial Number (other devices) — optional ── */}
          {showImei ? (
            <View style={{ paddingTop: 16 }}>
              <Text style={sectionTitle}>
                IMEI Number<Text style={{ fontWeight: '400', color: MUTED }}> (Optional)</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 46, borderWidth: 1, borderColor: LINE, borderRadius: 12, backgroundColor: '#FFFFFF', paddingLeft: 12, paddingRight: 6 }}>
                <Barcode size={rf(20)} color={INK} strokeWidth={1.75} />
                <TextInput
                  placeholder="Enter 15-digit IMEI"
                  placeholderTextColor={PLACEHOLDER}
                  value={imei}
                  onChangeText={(t) => setImei(cleanImei(t))}
                  keyboardType="number-pad"
                  maxLength={IMEI_LENGTH}
                  cursorColor={ACCENT}
                  accessibilityLabel="IMEI number"
                  style={{ flex: 1, marginLeft: 10, paddingVertical: 0, fontSize: rf(14), color: INK }}
                />
              </View>
              {imeiDigits.length > 0 && !imeiValid ? (
                <Text style={{ fontSize: rf(11.5), color: RED_TEXT, marginTop: 5 }}>
                  {imeiError(imeiDigits)}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ paddingTop: 16 }}>
              <Text style={sectionTitle}>
                Serial Number<Text style={{ fontWeight: '400', color: MUTED }}> (Optional)</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 46, borderWidth: 1, borderColor: LINE, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12 }}>
                <Hash size={rf(19)} color={INK} strokeWidth={1.75} />
                <TextInput
                  placeholder="Enter serial number"
                  placeholderTextColor={PLACEHOLDER}
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={40}
                  cursorColor={ACCENT}
                  accessibilityLabel="Serial number"
                  style={{ flex: 1, marginLeft: 10, paddingVertical: 0, fontSize: rf(14), color: INK }}
                />
              </View>
            </View>
          )}

          {/* ── Device Photo or Video — optional (up to 5 photos and one video).
              Tap a thumbnail to replace / remove it. ── */}
          <View style={{ paddingTop: 16 }}>
            <Text style={sectionTitle}>
              Device Photo or Video<Text style={{ fontWeight: '400', color: MUTED }}> (Optional)</Text>
            </Text>
            {/* Camera · Gallery · Video — straight to the source. */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {[
                { key: 'camera', label: 'Take Photo', icon: 'photo-camera', disabled: !canAddPhoto, onPress: () => setMediaSheet({ mode: 'add', kind: 'photo' }) },
                { key: 'video', label: 'Video', icon: 'videocam', disabled: !!video, onPress: () => setMediaSheet({ mode: 'add', kind: 'video' }) },
              ].map((b) => (
                <Pressable
                  key={b.key}
                  onPress={b.disabled ? undefined : b.onPress}
                  disabled={b.disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${b.label.toLowerCase()}`}
                  accessibilityState={{ disabled: b.disabled }}
                  className="active:opacity-80"
                  style={{
                    flex: 1, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    borderColor: b.disabled ? LINE : MINT_LINE, backgroundColor: b.disabled ? PAGE_BG : MINT, opacity: b.disabled ? 0.6 : 1,
                  }}
                >
                  <MaterialIcons name={b.icon} size={rf(19)} color={b.disabled ? MUTED : ACCENT} />
                  <Text style={{ marginLeft: 6, fontSize: rf(13), fontWeight: '700', color: b.disabled ? MUTED : ACCENT }} numberOfLines={1}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {mediaItems.map((m) => (
                <View key={`${m.kind}-${m.index}-${m.uri}`} style={{ width: mediaPct, padding: 4 }}>
                  <Pressable
                    onPress={() => setMediaSheet({ mode: 'item', kind: m.kind, index: m.index })}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.label} options`}
                    className="active:opacity-85"
                    style={{ aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: PAGE_BG, overflow: 'hidden' }}
                  >
                    {m.kind === 'photo' ? (
                      <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name="play-circle-filled" size={rf(38)} color="#FFFFFF" />
                      </View>
                    )}
                    <Pressable
                      onPress={() => removeMedia(m.kind, m.index)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.label}`}
                      style={{ position: 'absolute', top: 5, right: 5, height: 22, width: 22, borderRadius: 11, backgroundColor: 'rgba(17,17,17,0.7)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MaterialIcons name="close" size={rf(14)} color="#FFFFFF" />
                    </Pressable>
                  </Pressable>
                  <Text style={{ marginTop: 4, fontSize: rf(11.5), fontWeight: '600', color: MUTED, textAlign: 'center' }} numberOfLines={1}>
                    {m.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Device Additional Accessories (optional) ── */}
          <View style={{ paddingTop: 16 }}>
            <Text style={sectionTitle}>
              Device Additional Accessories<Text style={{ fontWeight: '400', color: MUTED }}> (Optional)</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 46, borderWidth: 1, borderColor: LINE, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12 }}>
              <MaterialIcons name="devices-other" size={rf(20)} color={INK} />
              <TextInput
                value={accessories}
                onChangeText={setAccessories}
                placeholder="Enter charger, case, SIM tray, etc."
                placeholderTextColor={PLACEHOLDER}
                maxLength={200}
                cursorColor={ACCENT}
                accessibilityLabel="Device additional accessories"
                style={{ flex: 1, marginLeft: 10, paddingVertical: 0, fontSize: rf(14), color: INK }}
              />
            </View>
          </View>

          {/* ── More Device Details — Device Security, optional and folded;
              its value stays when folded. ── */}
          {lockOptions.length > 1 ? (
            <View style={{ paddingTop: 16 }}>
              <Text style={sectionTitle}>More Device Details</Text>
              <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                {lockOptions.length > 1 ? (
                  <>
                    <Pressable
                      onPress={() => setLockOpen((v) => !v)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: lockOpen }}
                      accessibilityLabel={`Device security, ${lockLabel}`}
                      className="active:opacity-80"
                      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 12 }}
                    >
                      <Text style={{ flex: 1, fontSize: rf(13.5), fontWeight: '700', color: INK }} numberOfLines={1}>
                        Device Security<Text style={{ fontWeight: '400', color: MUTED }}> (Optional)</Text>
                      </Text>
                      <Text style={{ fontSize: rf(12), fontWeight: '700', color: lockType === 'NONE' ? MUTED : ACCENT, marginRight: 6, maxWidth: '40%' }} numberOfLines={1}>
                        {lockType === 'NONE' ? 'None' : (lockSummary || lockLabel)}
                      </Text>
                      <ChevronDown size={rf(18)} color={INK} strokeWidth={2} style={{ transform: [{ rotate: lockOpen ? '180deg' : '0deg' }] }} />
                    </Pressable>
                    {lockOpen ? (
                      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                        {lockOptions.map((o) => {
                          const on = lockType === o.key;
                          return (
                            <Pressable
                              key={o.key}
                              onPress={() => pickLock(o.key)}
                              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingVertical: 6 }}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={o.label}
                            >
                              <View
                                style={{
                                  height: 20, width: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                                  backgroundColor: on ? ACCENT : '#FFFFFF', borderWidth: on ? 0 : 1.5, borderColor: '#B8B8B8',
                                }}
                              >
                                {on ? <MaterialIcons name="check" size={rf(14)} color="#FFFFFF" /> : null}
                              </View>
                              <Text style={{ flex: 1, marginLeft: 10, fontSize: rf(14), color: INK }} numberOfLines={1}>{o.label}</Text>
                              {on && o.key !== 'NONE' ? (
                                <Text style={{ fontSize: rf(12.5), color: MUTED, marginLeft: 8, maxWidth: '45%' }} numberOfLines={1}>
                                  {lockSummary}  <Text style={{ color: ACCENT, fontWeight: '700' }}>Edit</Text>
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Booking Time · Estimated & Delivery Time. */}
          <BookingTimeSection
            now={bookedAt}
            delivery={delivery}
            onChangeDelivery={setDelivery}
          />

          {/* Devices already added to this booking with "Add Another Device". */}
          {otherDevices.length ? (
            <View style={{ paddingTop: 16 }}>
              <Text style={sectionTitle}>Devices in this booking ({otherDevices.length + 1})</Text>
              {otherDevices.map((e) => (
                <View key={e.entryId} style={[card, { padding: 12, marginBottom: 8 }]}>
                  <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: INK }} numberOfLines={1}>
                    {[e.device?.brandName, e.device?.modelName].filter(Boolean).join(' ') || 'Device'}
                  </Text>
                  <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 2 }} numberOfLines={2}>
                    {(e.services || []).map(issueLabel).join(', ')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky bottom bar — Add Another Device · Save & Continue (Partner). */}
      <BottomActionBar>
        <View style={[col, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Pressable
            onPress={onAddAnother}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityLabel="Add Another Device"
            accessibilityState={{ disabled: !canContinue }}
            className={canContinue ? 'active:opacity-85' : ''}
            style={{
              flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: ACCENT, backgroundColor: '#FFFFFF', opacity: canContinue ? 1 : 0.45,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
            }}
          >
            <Plus size={18} color={ACCENT} strokeWidth={2.25} />
            <Text style={{ marginLeft: 6, color: ACCENT, fontSize: rf(14), fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Add Another Device</Text>
          </Pressable>
          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            className={canContinue ? 'active:opacity-85' : ''}
            style={{
              flex: 1, height: 52, borderRadius: 14, backgroundColor: ACCENT, opacity: canContinue ? 1 : 0.45,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: rf(15), fontWeight: '800' }}>Save &amp; Continue</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.25} style={{ marginLeft: 6 }} />
          </Pressable>
        </View>
        {issueCount === 0 ? (
          <Text style={[col, { marginTop: 8, fontSize: rf(12.5), color: MUTED, textAlign: 'center' }]}>
            Select at least one repair issue.
          </Text>
        ) : null}
      </BottomActionBar>

      {/* Device Security entry popup (PIN / Pattern / Password / Account). */}
      {lockOptions.length > 1 ? (
        <DeviceSecurityLockSheet
          visible={!!lockSheet}
          types={lockOptions.map((o) => o.key)}
          initialLock={lockSheet}
          showProgress={false}
          entryOnly
          onConfirm={(l) => { setLockType(l.type); setLockValue(l.value || ''); setLockSheet(null); }}
          onClose={() => setLockSheet(null)}
        />
      ) : null}

      {/* Device media sheet — Add Video (gallery / record), or a thumbnail's
          Replace / Remove, then where the replacement comes from. */}
      <BookingSheet visible={!!mediaSheet} onClose={() => setMediaSheet(null)} maxWidth={480}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: LINE, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          {mediaSheet?.mode === 'replace' ? (
            <Pressable
              onPress={() => setMediaSheet({ ...mediaSheet, mode: 'item' })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="active:opacity-70"
              style={{ height: 32, width: 32, borderRadius: 16, marginRight: 8, backgroundColor: PAGE_BG, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="arrow-back" size={rf(20)} color={INK} />
            </Pressable>
          ) : null}
          <Text style={{ flex: 1, fontSize: rf(16), fontWeight: '800', color: INK }} numberOfLines={1}>
            {mediaSheet?.mode === 'item'
              ? (mediaSheet.kind === 'video' ? 'Video' : `Photo ${mediaSheet.index + 1}`)
              : mediaSheet?.mode === 'replace'
                ? (mediaSheet.kind === 'video' ? 'Replace Video' : `Replace Photo ${mediaSheet.index + 1}`)
                : (mediaSheet?.kind === 'video' ? 'Add Video' : 'Add Photo')}
          </Text>
        </View>

        {mediaSheet?.mode === 'item' ? (
          <>
            <SheetOption icon="autorenew" label="Replace" onPress={() => setMediaSheet({ ...mediaSheet, mode: 'replace' })} />
            <SheetOption icon="delete-outline" label="Remove" danger onPress={() => { removeMedia(mediaSheet.kind, mediaSheet.index); setMediaSheet(null); }} />
          </>
        ) : mediaSheet ? (
          <>
            <SheetOption
              icon="photo-library"
              label="Choose from Gallery"
              onPress={() => chooseMedia(mediaSheet.kind, false, mediaSheet.mode === 'replace' ? { index: mediaSheet.index } : {})}
            />
            {Platform.OS !== 'web' ? (
              <SheetOption
                icon={mediaSheet.kind === 'video' ? 'videocam' : 'photo-camera'}
                label={mediaSheet.kind === 'video' ? 'Record Video' : 'Take Photo'}
                onPress={() => chooseMedia(mediaSheet.kind, true, mediaSheet.mode === 'replace' ? { index: mediaSheet.index } : {})}
              />
            ) : null}
          </>
        ) : null}

        <Pressable
          onPress={() => setMediaSheet(null)}
          accessibilityRole="button"
          className="active:opacity-80"
          style={{ marginTop: 12, height: 46, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: rf(14), fontWeight: '700', color: INK }}>Cancel</Text>
        </Pressable>
      </BookingSheet>
    </KeyboardAvoidingView>
  );
}

/** One row of the media bottom sheet: Material icon in a tinted circle + label (Partner SheetOption). */
function SheetOption({ icon, label, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="active:opacity-70"
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54 }}
    >
      <View style={{ height: 40, width: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? 'rgba(220, 38, 38, 0.10)' : MINT }}>
        <MaterialIcons name={icon} size={rf(21)} color={danger ? '#DC2626' : ACCENT} />
      </View>
      <Text style={{ flex: 1, marginLeft: 14, fontSize: rf(14.5), fontWeight: '600', color: danger ? '#DC2626' : INK }}>{label}</Text>
    </Pressable>
  );
}
