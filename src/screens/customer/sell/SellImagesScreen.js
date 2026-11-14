import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, Image, ActivityIndicator, TextInput, Platform, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image as ImageIcon, ShoppingBag, ShieldCheck, Zap, Package, Receipt } from 'lucide-react-native';
import { BookingSheet } from '../service-booking-customer/DeviceSecurityLockSheet';
import { notify } from '../../../components/confirm';
import colors from '../../../theme/colors';
import { Card, PrimaryButton, LabeledInput } from '../../../components/ui';
import { uploadMedia } from '../../../api/masterData';
import * as ImageManipulator from 'expo-image-manipulator';
import { rf, rlh } from '../../../utils/responsive';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
import { FlowCta, useHideStackHeader } from '../service-booking-customer/FlowChrome';
import { SellStepHeader, SellCard, EditBanner, TickBadge, SellStepBar } from './SellStepChrome';
import { MOBILE_ACCESSORIES, LAPTOP_ACCESSORIES, WARRANTY, NO_WARRANTY_KEYWORDS } from './SellAccessoriesWarrantyScreen';

// Sell step 2 — Accessories & Photos: accessories + warranty (formerly their own
// screen, same options and params) above the device photos and condition.
const ACC_ICON = { original_charger: Zap, original_box: Package, purchase_invoice: Receipt };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '46%', margin: '2%', height: 120, borderColor: '#9ABEC4', borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', overflow: 'hidden' },
  // StyleSheet.absoluteFillObject no longer exists in RN 0.88 — spreading it gave
  // {} and the photo rendered at 0×0 (blank box, no onLoad/onError).
  slotImg: { ...StyleSheet.absoluteFill },
  slotLabel: { fontSize: rf(13), fontWeight: '700', color: colors.text, marginTop: 6, textAlign: 'center' },
  slotLabelOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.92)', paddingVertical: 4, fontSize: rf(12), fontWeight: '700', color: BRAND.ink, textAlign: 'center' },
  removeBtn: { position: 'absolute', right: 4, top: 4, height: 22, width: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  editBanner: { backgroundColor: BRAND.yellowSoft, borderColor: BRAND.yellowLine, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  editBannerTitle: { fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.5 },
  editBannerText: { fontSize: rf(12), color: BRAND.ink, fontWeight: '600', marginTop: 2 },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: BRAND.line, borderTopWidth: 1 },
});

// key maps to the backend ImageBundle field (front/back/side/camera/other)
const SLOTS = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side & Frame' },
  { key: 'camera', label: 'Camera' },
  { key: 'other', label: 'Damage / Scratches' },
];
// Optional short video, sent as images.video (sell orders have no video field
// on the server yet, so it isn't stored until one is added).
const VIDEO_SLOT = { key: 'video', label: 'Video' };

// Photos survive Back → Next: going back pops this screen, so they're kept here
// keyed by the route BEFORE it (the same instance when the user comes forward
// again; a new sell flow has new route keys, so nothing stale leaks in).
const drafts = new Map();
const VALID_URI = /^(file|content|https?|data|blob|ph|assets-library):/i;
const toHttps = (u) => { const s = String(u || '').trim(); return s.startsWith('http://') ? `https://${s.slice(7)}` : s; };
const omit = (key) => (m) => { const n = { ...m }; delete n[key]; return n; };
const devLog = (...a) => { if (__DEV__) console.log('[SellImages]', ...a); };

// Gallery originals can be HEIC or a content:// URI, which <Image> on Android
// can render blank without ever calling onError. Re-encode to a JPEG file://
// copy — that same file is shown in the box AND uploaded. Max 1600 px keeps it
// well under the 5 MB limit.
async function toJpeg(asset) {
  const w = asset.width || 0;
  const h = asset.height || 0;
  const resize = Math.max(w, h) > 1600 ? [{ resize: w >= h ? { width: 1600 } : { height: 1600 } }] : [];
  try {
    const out = await ImageManipulator.manipulateAsync(asset.uri, resize, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: out.uri, mimeType: 'image/jpeg', fileName: 'photo.jpg' };
  } catch (e) {
    devLog('JPEG convert failed, sending original', asset.uri, e?.message);
    return { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName };
  }
}

export default function SellImagesScreen({ navigation, route }) {
  const params = route.params || {};
  useHideStackHeader(navigation);
  const { editSellOrderId, editHints } = params;
  const isEditing = !!editSellOrderId;

  const [draftKey] = useState(() => {
    try {
      const routes = navigation.getState()?.routes || [];
      const i = routes.findIndex((r) => r.key === route.key);
      return i > 0 ? routes[i - 1].key : null;
    } catch (_) { return null; }
  });
  const [draft] = useState(() => (draftKey ? drafts.get(draftKey) : null));

  // The owner listing flow (Partner) skips accessories / warranty and prices next.
  let hasOwnerRoute = false;
  try { hasOwnerRoute = navigation.getState()?.routeNames?.includes('OwnerSellGadgetPrice') === true; } catch (_) {}
  const ownerListing = hasOwnerRoute || params.flow === 'OWNER_LIST' || !!params.descriptionType;

  // Accessories & warranty — pre-seeded from the order when editing (code, else label).
  const categoryCode = String(params.device?.categoryCode || '').toUpperCase();
  const isLaptopLike = NO_WARRANTY_KEYWORDS.some((k) => categoryCode.includes(k));
  const ACCESSORIES = isLaptopLike ? LAPTOP_ACCESSORIES : MOBILE_ACCESSORIES;
  const initialAccessories = useMemo(() => {
    if (!isEditing) return [];
    const priorCodes = new Set();
    const priorLabels = new Set();
    (editHints?.accessories || []).forEach((a) => {
      if (a?.accessoryCode) priorCodes.add(String(a.accessoryCode).toLowerCase());
      if (a?.label) priorLabels.add(String(a.label).trim().toLowerCase());
    });
    return ACCESSORIES.filter((a) => priorCodes.has(a.id.toLowerCase()) || priorLabels.has(a.label.trim().toLowerCase())).map((a) => a.id);
  }, [isEditing, editHints, ACCESSORIES]);
  const [accessories, setAccessories] = useState(() => draft?.accessories ?? initialAccessories);
  const [warranty, setWarranty] = useState(() => draft?.warranty ?? (isEditing ? (editHints?.warrantyCode || null) : null));
  const toggleAcc = (id) => setAccessories((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const [condition, setCondition] = useState(() => draft?.condition ?? (isEditing ? (editHints?.deviceConditionSummary || 'Good') : 'Good'));
  // Seed photo slots from this flow's draft, else the order's saved image URLs when editing.
  const [images, setImages] = useState(() => {
    if (draft) return draft.images;
    const out = {};
    const src = (isEditing && editHints?.images) || {};
    SLOTS.forEach((s) => { const u = toHttps(src[s.key]); if (VALID_URI.test(u)) out[s.key] = u; });
    return out;
  }); // key -> uploaded url (what the backend gets)
  const [previews, setPreviews] = useState(() => draft?.previews || {}); // key -> local JPEG shown in the box
  const [pending, setPending] = useState({}); // key -> photo whose upload failed (tap to retry)
  const [broken, setBroken] = useState({}); // key -> true when the box's image failed to load
  const [reload, setReload] = useState({}); // key -> remount count for an image retry
  const [uploading, setUploading] = useState(null); // key currently uploading
  const [sheet, setSheet] = useState(null); // { type: 'slot', key } | { type: 'video' }

  useEffect(() => {
    if (!draftKey) return;
    drafts.delete(draftKey);
    drafts.set(draftKey, { images, previews, condition, accessories, warranty });
    if (drafts.size > 10) drafts.delete(drafts.keys().next().value);
  }, [draftKey, images, previews, condition, accessories, warranty]);

  const upload = async (key, photo) => {
    setUploading(key);
    setPreviews((m) => ({ ...m, [key]: photo.uri }));
    setBroken(omit(key));
    try {
      const url = toHttps(await uploadMedia(photo, 'sell'));
      if (!VALID_URI.test(url)) throw new Error('Upload returned no URL');
      setImages((m) => ({ ...m, [key]: url }));
      setPending(omit(key));
    } catch (e) {
      devLog('upload failed', key, e?.status, e?.message);
      // Keep the picked photo on screen with a retry; the slot stays unfilled
      // so Continue can't send an old or missing photo.
      setImages(omit(key));
      setPending((m) => ({ ...m, [key]: photo }));
      notify('Upload failed', e?.message || 'Tap the photo to try again.');
    } finally {
      setUploading(null);
    }
  };

  // Camera / Gallery (bulk) fill the empty slots in order; a slot's own sheet
  // then moves the photo to the right slot (the two swap), replaces or removes
  // it, or takes a photo straight into it.
  const askPermission = async (fromCamera, what) => {
    const { status } = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status === 'granted') return true;
    notify('Permission needed', fromCamera ? `Allow camera access to ${what === 'video' ? 'record a video' : 'take a photo'}.` : `Allow media library access to attach ${what === 'video' ? 'a video' : 'photos'}.`);
    return false;
  };
  const freeSlots = SLOTS.filter((s) => !images[s.key] && !pending[s.key]).map((s) => s.key);
  const pickBulk = async (source) => {
    if (uploading || !freeSlots.length) return;
    try {
      const fromCamera = source === 'camera';
      if (!(await askPermission(fromCamera, 'photo'))) return;
      const opts = { mediaTypes: ['images'], allowsEditing: false, quality: 0.7, ...(fromCamera ? null : { allowsMultipleSelection: freeSlots.length > 1, selectionLimit: freeSlots.length }) };
      const result = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.length) return;
      const slots = [...freeSlots];
      for (const asset of result.assets.slice(0, slots.length)) await upload(slots.shift(), await toJpeg(asset));
    } catch (e) {
      notify('Could not open photos', e?.message || 'Try again');
    }
  };
  // Straight into one slot (its sheet's Take Photo / Choose from Gallery).
  const pickInto = async (key, source) => {
    if (uploading) return;
    try {
      const fromCamera = source === 'camera';
      if (!(await askPermission(fromCamera, 'photo'))) return;
      const opts = { mediaTypes: ['images'], allowsEditing: false, quality: 0.7 };
      const result = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]) return;
      await upload(key, await toJpeg(result.assets[0]));
    } catch (e) {
      notify('Could not open photos', e?.message || 'Try again');
    }
  };
  // One short video (record or choose), uploaded like the photos.
  const pickVideo = async (source) => {
    if (uploading) return;
    try {
      const fromCamera = source === 'camera';
      if (!(await askPermission(fromCamera, 'video'))) return;
      const opts = { mediaTypes: ['videos'], allowsEditing: false, videoMaxDuration: 15, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium };
      const result = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const a = result.assets?.[0];
      if (result.canceled || !a) return;
      await upload('video', { uri: a.uri, mimeType: a.mimeType || 'video/mp4', fileName: a.fileName || 'video.mp4' });
    } catch (e) {
      notify('Could not open videos', e?.message || 'Try again');
    }
  };

  // Reassign a slot's photo to another slot (the two swap).
  const moveSlot = (from, to) => {
    const swap = (m) => {
      const n = { ...m };
      if (m[to]) n[from] = m[to]; else delete n[from];
      if (m[from]) n[to] = m[from]; else delete n[to];
      return n;
    };
    setImages(swap);
    setPreviews(swap);
    [setPending, setBroken].forEach((set) => set((m) => omit(to)(omit(from)(m))));
  };

  // Tap a tile: a failed image reloads, a failed upload retries, else its sheet.
  const onTile = (key) => {
    if (broken[key]) {
      setBroken(omit(key));
      setReload((m) => ({ ...m, [key]: (m[key] || 0) + 1 }));
    } else if (pending[key]) {
      upload(key, pending[key]);
    } else if (key !== VIDEO_SLOT.key) {
      setSheet({ type: 'slot', key });
    }
  };
  // Close the sheet first, then run the action (iOS won't present a picker
  // while a modal is still sliding out).
  const afterSheet = (fn) => {
    setSheet(null);
    setTimeout(fn, 320);
  };

  const remove = (key) => {
    [setImages, setPreviews, setPending, setBroken].forEach((set) => set(omit(key)));
  };

  // The owner stack is detected from the navigator's registered routes (above),
  // which survive even if a screen in the chain forgot to spread params.
  const onContinue = () => {
    if (ownerListing) {
      navigation.navigate('OwnerSellGadgetPrice', { ...params, flow: 'OWNER_LIST', deviceCondition: condition, images });
      return;
    }
    navigation.navigate('SellComplete', {
      ...params,
      accessories: accessories.map((id) => ({ accessoryCode: id, label: ACCESSORIES.find((a) => a.id === id)?.label })),
      warranty: isLaptopLike ? null : warranty,
      warrantyLabel: isLaptopLike ? null : WARRANTY.find((w) => w.id === warranty)?.label,
      deviceCondition: condition,
      images,
    });
  };

  // ---- presentation-only values ----
  const { width } = useWindowDimensions();
  const gap = 8;
  const tileW = Math.floor((Math.min(width, 640) - 24 - 24 - 2 - gap * 2) / 3); // screen − page pad − card pad − card border − gaps (3 per row)
  const tileH = Math.max(84, Math.min(116, Math.round(tileW * 0.92)));
  const missingCount = SLOTS.filter((s) => !images[s.key]).length; // every slot is required
  const filled = SLOTS.length - missingCount;
  const sheetTitle = { fontSize: rf(16), fontWeight: '800', color: BRAND.ink, marginBottom: 10 };
  const sheetLabel = { fontSize: rf(12), fontWeight: '700', color: BRAND.muted, marginTop: 10, marginBottom: 6 };
  const slotChip = { margin: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: BRAND.greenLine, backgroundColor: BRAND.greenSoft, justifyContent: 'center' };

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <SellStepHeader step={2} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
        {isEditing ? <EditBanner text="Your previous accessories, warranty and photos are kept — change any below." /> : null}

        {!ownerListing ? (
          <SellCard Icon={ShoppingBag} title="Accessories">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {ACCESSORIES.map((a) => {
                const active = accessories.includes(a.id);
                const AIcon = ACC_ICON[a.id] || ShoppingBag;
                return (
                  <View key={a.id} style={{ width: '33.333%', padding: 3 }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => toggleAcc(a.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      style={{ flex: 1, minHeight: 92, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? BRAND.greenSoft : '#F7F8FB', borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : '#ECEEF3' }}
                    >
                      <AIcon size={22} color={BRAND.green} strokeWidth={1.8} />
                      <Text style={{ marginTop: 7, fontSize: rf(11.5), lineHeight: rlh(15), fontWeight: active ? '800' : '700', color: BRAND.ink, textAlign: 'center' }}>{a.label}</Text>
                      {active ? <TickBadge /> : null}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </SellCard>
        ) : null}

        {!ownerListing && !isLaptopLike ? (
          <SellCard Icon={ShieldCheck} title="Warranty">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {WARRANTY.map((w) => {
                const active = warranty === w.id;
                return (
                  <View key={w.id} style={{ width: '50%', padding: 3 }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setWarranty(w.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={w.label}
                      style={{ flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 10, borderRadius: 10, backgroundColor: active ? BRAND.greenSoft : '#F7F8FB', borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : '#ECEEF3' }}
                    >
                      <View style={{ height: 18, width: 18, borderRadius: 9, borderWidth: 2, borderColor: active ? BRAND.green : BRAND.ring, alignItems: 'center', justifyContent: 'center' }}>
                        {active ? <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: BRAND.green }} /> : null}
                      </View>
                      <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontSize: rf(12.5), fontWeight: '700', color: BRAND.ink }}>{w.short}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </SellCard>
        ) : null}

        <SellCard
          Icon={ImageIcon}
          title="Upload for Device Images"
          subtitle="5 photos required, 1 video optional. Maximum file size: 5 MB."
          right={(
            <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: filled === SLOTS.length ? BRAND.greenSoft : BRAND.yellowSoft }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: filled === SLOTS.length ? BRAND.green : BRAND.ink }}>{filled}/{SLOTS.length}</Text>
            </View>
          )}
        >
          {/* Camera · Gallery (fill the empty slots) · Video */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { key: 'camera', label: 'Camera', icon: 'photo-camera', disabled: !!uploading || !freeSlots.length, onPress: () => pickBulk('camera') },
              { key: 'gallery', label: 'Gallery', icon: 'photo-library', disabled: !!uploading || !freeSlots.length, onPress: () => pickBulk('library') },
              { key: 'video', label: 'Video', icon: 'videocam', disabled: !!uploading || !!(images.video || pending.video), onPress: () => setSheet({ type: 'video' }) },
            ].map((b) => (
              <Pressable
                key={b.key}
                onPress={b.onPress}
                disabled={b.disabled}
                accessibilityRole="button"
                accessibilityLabel={`Add ${b.label.toLowerCase()}`}
                accessibilityState={{ disabled: b.disabled }}
                style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderColor: b.disabled ? '#E8EAEE' : BRAND.greenLine, backgroundColor: b.disabled ? BRAND.bg : BRAND.greenSoft, opacity: b.disabled ? 0.6 : 1 }}
              >
                <MaterialIcons name={b.icon} size={rf(19)} color={b.disabled ? BRAND.muted : BRAND.green} />
                <Text numberOfLines={1} style={{ marginLeft: 6, fontSize: rf(13), fontWeight: '700', color: b.disabled ? BRAND.muted : BRAND.green }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ marginTop: 8, fontSize: rf(11.5), color: BRAND.muted }}>Photos fill the empty slots in order — tap a slot to move, replace or remove its photo.</Text>

          {/* The 5 labeled slots (+ the video once added). */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, marginTop: 10 }}>
            {[...SLOTS, ...(previews.video || images.video || pending.video || uploading === VIDEO_SLOT.key ? [VIDEO_SLOT] : [])].map((s) => {
              // The local JPEG first (what was just picked), else the saved url.
              const shown = previews[s.key] || images[s.key];
              const uri = VALID_URI.test(shown || '') ? shown : null;
              const busy = uploading === s.key;
              const retry = broken[s.key] ? 'Image failed · Tap to retry' : pending[s.key] && !busy ? 'Upload failed · Tap to retry' : null;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => onTile(s.key)}
                  disabled={busy}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.label} photo${uri ? '' : ', empty'}`}
                  style={{
                    width: tileW, height: tileH, borderRadius: 12, overflow: 'hidden',
                    borderWidth: uri ? 1 : 1.5, borderStyle: uri ? 'solid' : 'dashed', borderColor: retry ? BRAND.red : uri ? BRAND.line : BRAND.greenLine,
                    backgroundColor: BRAND.bg, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {uri ? (
                    <>
                      {s.key === VIDEO_SLOT.key ? (
                        <View style={[styles.slotImg, { bottom: 22, backgroundColor: BRAND.ink, alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialIcons name="play-circle-filled" size={rf(34)} color="#FFFFFF" />
                        </View>
                      ) : (
                        <Image
                          key={`${s.key}-${reload[s.key] || 0}`}
                          source={{ uri }}
                          style={[styles.slotImg, { bottom: 22 }]}
                          resizeMode="cover"
                          onError={(e) => {
                            devLog('image failed', s.key, uri, e?.nativeEvent?.error);
                            setBroken((m) => ({ ...m, [s.key]: true }));
                          }}
                        />
                      )}
                      {busy || retry ? (
                        <View style={[styles.slotImg, { bottom: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                          {busy ? <ActivityIndicator color={BRAND.green} /> : (
                            <Text style={{ fontSize: rf(10.5), fontWeight: '700', color: BRAND.red, textAlign: 'center', paddingHorizontal: 6 }}>{retry}</Text>
                          )}
                        </View>
                      ) : null}
                      {!busy ? (
                        <TouchableOpacity style={styles.removeBtn} onPress={() => remove(s.key)} accessibilityLabel={`Remove ${s.label}`}>
                          <Ionicons name="close" size={13} color="#fff" />
                        </TouchableOpacity>
                      ) : null}
                      <Text style={styles.slotLabelOverlay} numberOfLines={1}>{s.label}</Text>
                    </>
                  ) : busy ? (
                    <ActivityIndicator color={BRAND.green} />
                  ) : (
                    <>
                      <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                        <MaterialIcons name="add-a-photo" size={rf(17)} color={BRAND.green} />
                      </View>
                      <Text style={{ fontSize: rf(11), fontWeight: '700', color: BRAND.ink, textAlign: 'center', paddingHorizontal: 4 }} numberOfLines={2}>{s.label}<Text style={{ color: BRAND.red }}> *</Text></Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {missingCount ? (
            <Text style={{ fontSize: rf(11), fontWeight: '600', color: BRAND.red, marginTop: 8 }}>
              Fill all {SLOTS.length} photo slots to continue ({missingCount} left).
            </Text>
          ) : null}


          {/* Device Condition — the same free-text field and state as before. */}
          <Text style={{ fontSize: rf(11.5), color: BRAND.muted, marginTop: 10, marginBottom: 6 }}>Device Condition</Text>
          <TextInput
            value={condition}
            onChangeText={setCondition}
            placeholder="Device Condition"
            placeholderTextColor={BRAND.muted}
            style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E8EAEE', backgroundColor: BRAND.bg, paddingHorizontal: 12, fontSize: rf(13.5), color: BRAND.ink, outlineStyle: 'none' }}
          />
        </SellCard>
      </ScrollView>
      <SellStepBar>
        <FlowCta palette={BRAND_FLOW} title="Continue" disabled={!!uploading || missingCount > 0 || (!ownerListing && !isLaptopLike && !warranty)} onPress={onContinue} />
      </SellStepBar>

      {/* Sheets: a slot (fill / replace / move / remove) and the video (record / choose). */}
      <BookingSheet visible={!!sheet} onClose={() => setSheet(null)} maxWidth={480}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BRAND.line, marginBottom: 12 }} />
        {sheet?.type === 'video' ? (
          <>
            <Text style={sheetTitle} numberOfLines={1}>Video</Text>
            {Platform.OS !== 'web' ? (
              <SheetOption icon="videocam" label="Record Video" onPress={() => afterSheet(() => pickVideo('camera'))} />
            ) : null}
            <SheetOption icon="video-library" label="Choose from Gallery" onPress={() => afterSheet(() => pickVideo('library'))} />
          </>
        ) : sheet?.type === 'slot' ? (
          <>
            <Text style={sheetTitle} numberOfLines={1}>{SLOTS.find((s) => s.key === sheet.key)?.label} photo</Text>
            {Platform.OS !== 'web' ? (
              <SheetOption icon="photo-camera" label={images[sheet.key] ? 'Retake Photo' : 'Take Photo'} onPress={() => { const k = sheet.key; afterSheet(() => pickInto(k, 'camera')); }} />
            ) : null}
            <SheetOption icon="photo-library" label={images[sheet.key] ? 'Replace from Gallery' : 'Choose from Gallery'} onPress={() => { const k = sheet.key; afterSheet(() => pickInto(k, 'library')); }} />
            {images[sheet.key] ? (
              <>
                <Text style={sheetLabel}>Move this photo to</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                  {SLOTS.filter((s) => s.key !== sheet.key).map((s) => (
                    <Pressable key={s.key} onPress={() => { moveSlot(sheet.key, s.key); setSheet(null); }} accessibilityRole="button" style={slotChip}>
                      <Text style={{ fontSize: rf(13), fontWeight: '700', color: BRAND.green }}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <SheetOption icon="delete-outline" label="Remove photo" onPress={() => { remove(sheet.key); setSheet(null); }} />
              </>
            ) : null}
          </>
        ) : null}
        <Pressable
          onPress={() => setSheet(null)}
          accessibilityRole="button"
          style={{ marginTop: 12, height: 46, borderRadius: 12, borderWidth: 1, borderColor: BRAND.line, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: rf(14), fontWeight: '700', color: BRAND.ink }}>Cancel</Text>
        </Pressable>
      </BookingSheet>
    </View>
  );
}

function SheetOption({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54 }}>
      <View style={{ height: 40, width: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.greenSoft }}>
        <MaterialIcons name={icon} size={rf(21)} color={BRAND.green} />
      </View>
      <Text style={{ flex: 1, marginLeft: 14, fontSize: rf(14.5), fontWeight: '600', color: BRAND.ink }}>{label}</Text>
    </Pressable>
  );
}
