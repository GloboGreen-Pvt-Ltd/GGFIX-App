import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, Pressable, Modal, BackHandler, Linking, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notify } from '../../../components/confirm';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  Camera, ClipboardList, Smartphone, BatteryCharging, Package, ShieldCheck, MapPin, Hand, TabletSmartphone, Frame, ClipboardCheck,
  Palette, Database, Barcode, ChevronDown, ChevronRight, X,
} from 'lucide-react-native';
import { FlowCta, useHideStackHeader } from '../service-booking-customer/FlowChrome';
import { AddAddressRow, AddressOptionCard } from '../../../components/AddressPick';
import { SellStepHeader, SellCard, SellStepBar } from './SellStepChrome';
import { normalizeDeviceImageUrl } from '../../../utils/images';
import { createSellOrder, updateSellOrder } from '../../../api/orders';
import { createListing } from '../../../api/marketplace';
import { getSession } from '../../../auth/session';
import { listAddresses } from '../../../api/customer';
import { rf, rlh } from '../../../utils/responsive';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
import { withTypedDevice } from '../../../utils/typedDevice';
import { useImeiApplies } from '../../../utils/imeiPolicy';
import SellSubmittedPopup, { SuccessTick, RequestIdChip, SubmittedActions } from './SellSubmittedPopup';

const LINE = '#E8EAEE';
const MUTED = '#606E87';
const shadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: LINE, padding: 14, marginBottom: 12, ...shadow },
  // Device
  deviceImgBox: { width: 92, height: 110, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modelName: { fontSize: rf(16.5), fontWeight: '800', color: BRAND.ink, marginRight: 8 },
  pill: { backgroundColor: BRAND.green, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  pillText: { fontSize: rf(11.5), fontWeight: '700', color: '#FFFFFF' },
  specRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  specText: { marginLeft: 9, fontSize: rf(13), color: BRAND.ink, flex: 1 },
  specLabel: { color: BRAND.body },
  // Card heading (icon + title + optional subtitle)
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headIcon: { height: 44, width: 44, borderRadius: 22, backgroundColor: BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardTitle: { fontSize: rf(16.5), fontWeight: '800', color: BRAND.ink },
  cardTitleGreen: { fontSize: rf(16.5), fontWeight: '800', color: BRAND.green, marginLeft: 10 },
  cardSub: { fontSize: rf(12), color: BRAND.green, marginTop: 2 },
  // Photos
  photoBox: { width: '100%', aspectRatio: 1.12, borderRadius: 14, overflow: 'hidden', backgroundColor: BRAND.bg },
  photoLabel: { fontSize: rf(13), fontWeight: '600', color: BRAND.green, textAlign: 'center', marginTop: 7 },
  // Summary sections
  section: { borderRadius: 14, borderWidth: 1, borderColor: LINE, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10, backgroundColor: '#FFFFFF' },
  sectionHead: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { flex: 1, marginLeft: 9, fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink },
  count: { fontSize: rf(14), fontWeight: '800', color: BRAND.green, marginRight: 8 },
  chev: { height: 24, width: 24, borderRadius: 12, backgroundColor: BRAND.bg, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  itemText: { marginLeft: 10, fontSize: rf(12.5), color: BRAND.ink, flex: 1, lineHeight: rlh(17) },
  // Customer
  custRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  custText: { marginLeft: 12, fontSize: rf(14), color: BRAND.ink, flex: 1, lineHeight: rlh(19) },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: LINE, borderTopWidth: 1 },
});

const PHOTO_SLOTS = [
  { key: 'front', label: 'Front Side' },
  { key: 'back', label: 'Backside' },
  { key: 'side', label: 'side and Center' },
  { key: 'camera', label: 'Camera' },
  { key: 'other', label: 'Damage / Scratches' },
];

function Check() {
  return <Ionicons name="checkmark-circle" size={rf(19)} color={BRAND.green} style={{ marginTop: -1 }} />;
}

function SpecRow({ Icon, label, value }) {
  return (
    <View style={styles.specRow}>
      <Icon size={17} color={BRAND.body} />
      <Text style={styles.specText} numberOfLines={1}><Text style={styles.specLabel}>{label} : </Text>{value}</Text>
    </View>
  );
}

const condIcon = (c) => {
  const n = `${c.groupName || ''} ${c.groupCode || ''}`.toLowerCase();
  if (n.includes('touch')) return Hand;
  if (n.includes('screen') || n.includes('display')) return Smartphone;
  if (n.includes('back') || n.includes('body')) return TabletSmartphone;
  if (n.includes('side') || n.includes('center') || n.includes('frame')) return Frame;
  if (/battery|power|charg|connect/.test(n)) return BatteryCharging;
  return ClipboardCheck;
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function SellCompleteScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const p = route.params || {};
  const device = p.device || {};
  const showImei = useImeiApplies(device);
  const images = p.images || {};
  const [saving, setSaving] = useState(false);
  // Set once the sale is created: the popup shows, then this page stays in its
  // submitted state (Track Request / Back to Home instead of Sell Now).
  const [submitted, setSubmitted] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  // The backend's sellNumber may already start with "#".
  const sellNo = submitted?.sellNumber ? String(submitted.sellNumber).replace(/^#+/, '') : null;
  // After submitting, Close / Back go Home — never back into the sell flow (no double submit).
  const goHome = useCallback(() => navigation.popToTop(), [navigation]);
  const track = () => { navigation.popToTop(); navigation.navigate('MyOrders', { initialTab: 'Sell' }); };
  useEffect(() => {
    if (!submitted) return undefined;
    navigation.setOptions({ headerBackAction: goHome, gestureEnabled: false });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goHome(); return true; });
    return () => sub.remove();
  }, [submitted, goHome]);
  useHideStackHeader(navigation);
  // Pickup address — picked here (formerly the Select Address screen): the
  // passed / default / first saved address, re-listed on focus so one added
  // via AddressForm shows up.
  const [addresses, setAddresses] = useState(null); // null while loading
  const [addressId, setAddressId] = useState(p.addressId || p.address?.id || null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    listAddresses()
      .then((list) => {
        if (!alive) return;
        const l = list || [];
        setAddresses(l);
        setAddressId((cur) => (cur && l.some((a) => a.id === cur) ? cur : (l.find((a) => a.isDefault) || l[0])?.id || null));
      })
      .catch(() => { if (alive) setAddresses((cur) => cur || []); });
    return () => { alive = false; };
  }, []));
  const addr = (addresses || []).find((a) => a.id === addressId) || (p.address?.id && p.address.id === addressId ? p.address : null);
  const address = addr || {};

  const storageLine = [device.ramLabel, device.storageLabel].filter(Boolean).join(' / ');
  const photos = PHOTO_SLOTS.filter((s) => images[s.key]);
  // ---- presentation-only values ----
  const { width: winW, height: winH } = useWindowDimensions();
  const [viewer, setViewer] = useState(null); // index into photos for the full-screen view
  const viewerRef = useRef(null);
  const [showAnswers, setShowAnswers] = useState(false); // screening answers expanded
  const deviceImg = normalizeDeviceImageUrl(device.imageUrl) || images.front || null;
  const brand = device.brandName && !String(device.modelName || '').toLowerCase().startsWith(String(device.brandName).toLowerCase()) ? device.brandName : '';
  const deviceTitle = [brand, device.modelName].filter(Boolean).join(' ') || 'Device';
  const conditionLabel = p.deviceCondition || (p.workingCondition === 'DEAD' ? 'Unknown' : 'Good');
  const conds = p.conditions || [];
  // Order summary rows: warranty, accessories, then each condition picked.
  const accessoryText = (p.accessories || []).map((a) => a.label || a.accessoryCode).filter(Boolean).join(', ');
  const summary = [
    p.warrantyLabel ? { Icon: ShieldCheck, label: 'Warranty', value: p.warrantyLabel } : null,
    accessoryText ? { Icon: Package, label: 'Accessories', value: accessoryText } : null,
    ...conds.map((c) => ({ Icon: condIcon(c), label: c.groupName || c.groupCode, value: c.optionLabel })),
  ].filter((r) => r && r.value);
  const answers = (p.screeningAnswers || []).map((a) => [a.answer, a.question].filter(Boolean).join(', '));

  const submitLock = useRef(false); // a fast double tap can't create two orders
  const submit = async () => {
    if (submitLock.current || submitted) return;
    submitLock.current = true;
    setSaving(true);
    try {
      const payload = {
        brandId: device.brandId,
        modelId: device.modelId,
        ramOptionId: device.ramOptionId,
        storageOptionId: device.storageOptionId,
        color: device.color,
        imei: device.imei,
        // An "Other" device (typed brand / model) has no catalogue ids: its
        // labels ride along, and the typed device is appended to the condition
        // summary, which is what the shop reads. Catalogue devices are unchanged.
        ...(device.customModel ? {
          brandName: device.brandName,
          modelName: device.modelName,
          ramLabel: device.ramLabel,
          storageLabel: device.storageLabel,
        } : {}),
        workingCondition: p.workingCondition,
        warrantyCode: p.warranty,
        addressId: addr?.id || addressId,
        screeningAnswers: p.screeningAnswers || [],
        conditions: p.conditions || [],
        issues: p.issues || [],
        accessories: p.accessories || [],
        // Previously collected but silently dropped on submit: the per-category
        // "Device Configuration" answers and the free-text condition summary.
        // Send them so the shop actually receives what the customer entered.
        deviceConfig: p.deviceConfig || [],
        deviceConditionSummary: device.customModel ? withTypedDevice(p.deviceCondition, device) : (p.deviceCondition || undefined),
        images,
      };

      // When the customer entered this flow via "Edit sell order", PUT the
      // existing order instead of creating a new one — and don't re-mirror to
      // the marketplace listing (the original listing already points at it).
      if (p.editSellOrderId) {
        const updated = await updateSellOrder(p.editSellOrderId, payload);
        // navigate() pops back to the existing SellOrderDetails route if it's
        // still on the stack; otherwise it pushes a fresh one. Either way the
        // customer lands on the details page, which refetches on focus.
        navigation.navigate('SellOrderDetails', { sellOrderId: p.editSellOrderId, sellOrder: updated });
        return;
      }

      const created = await createSellOrder(payload);

      // Mirror this sell-order onto the public Buy/Sell marketplace so nearby
      // shops can spot it from their Buy screen. Best-effort — never block the
      // success flow if the marketplace POST fails (e.g. service is down).
      try {
        const session = (await getSession()) || {};
        const lat = address.latitude != null ? Number(address.latitude) : null;
        const lng = address.longitude != null ? Number(address.longitude) : null;
        const conditionLabel = p.deviceCondition
          || (p.workingCondition === 'DEAD' ? 'Not working' : 'Used');
        const summary = [device.color, storageLine].filter(Boolean).join(' · ');
        if (session.userId && device.modelName) {
          // sellOrderId links the listing to this sell order, so a shop opens
          // its full details and quotes on it (servers without the field ignore it).
          await createListing({
            sellerType: 'CUSTOMER',
            sellerId: session.userId,
            sellOrderId: created?.id,
            // CreateListingRequest accepts categoryId (and ListingView returns
            // it), so shops can filter these by device category. Only a real
            // UUID — a category *code* string would fail the backend FK.
            categoryId: /^[0-9a-f-]{36}$/i.test(String(device.categoryId || '')) ? device.categoryId : undefined,
            brandId: device.brandId,
            modelId: device.modelId,
            productName: device.customModel ? [device.brandName, device.modelName].filter(Boolean).join(' ') : device.modelName,
            productImage: images.front || device.imageUrl,
            condition: conditionLabel,
            description: summary || undefined,
            expectedPrice: 0, // 0 = awaiting shop quotation
            latitude: lat,
            longitude: lng,
            address: address.addressLine,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
          });
        }
      } catch (_) { /* best-effort mirror */ }

      // Success stays on this page: the popup bursts in over it and stays until
      // Track Request / Back to Home (no separate success screen).
      setSubmitted(created || {});
      setPopupOpen(true);
    } catch (e) {
      submitLock.current = false; // failed — let the customer try again
      notify('Error', e.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <SellStepHeader step={3} onBack={submitted ? goHome : () => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}>
        {/* Submitted — what's left on the page once the popup has docked */}
        {submitted ? (
          <View style={[styles.card, { marginTop: 10, marginBottom: 0, alignItems: 'center', borderColor: 'rgba(96,145,56,0.35)' }]}>
            <SuccessTick size={52} />
            <Text style={{ marginTop: 10, fontSize: rf(13), color: BRAND.body, textAlign: 'center', lineHeight: rlh(19) }}>
              Your device sale request has been submitted successfully.
            </Text>
          </View>
        ) : null}

        {/* Select Address */}
        <SellCard Icon={MapPin} title="Select Address">
          {!submitted ? <AddAddressRow onPress={() => navigation.navigate('AddressForm', {})} subtitle="Save a new address for pickup" /> : null}
          {addresses == null ? (
            <Text style={{ fontSize: rf(12.5), color: MUTED, paddingVertical: 6 }}>Loading addresses…</Text>
          ) : !(addresses || []).length ? (
            <Text style={{ fontSize: rf(12.5), color: MUTED, paddingVertical: 6 }}>No saved addresses — add one for the pickup.</Text>
          ) : (
            (submitted ? addresses.filter((a) => a.id === addressId) : addresses).map((a) => (
              <AddressOptionCard key={a.id} a={a} active={addressId === a.id} onPress={submitted ? undefined : () => setAddressId(a.id)} />
            ))
          )}
        </SellCard>

        {/* Complete Order — device + what was selected */}
        <SellCard Icon={ClipboardList} title="Complete Order">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.deviceImgBox}>
              {deviceImg ? (
                <Image source={{ uri: deviceImg }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              ) : (
                <Smartphone size={36} color={MUTED} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={styles.modelName}>{deviceTitle}</Text>
                <View style={styles.pill}><Text style={styles.pillText}>{conditionLabel}</Text></View>
              </View>
              {device.color ? <SpecRow Icon={Palette} label="Color" value={device.color} /> : null}
              {storageLine ? <SpecRow Icon={Database} label="Storage" value={storageLine} /> : null}
              {showImei ? <SpecRow Icon={Barcode} label="IMEI" value={device.imei || '-'} /> : null}
            </View>
          </View>
          {summary.length ? (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F2F4' }}>
              {summary.map((r, i) => (
                <View key={`${r.label}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F2F4' }}>
                  <r.Icon size={17} color={BRAND.green} />
                  <Text numberOfLines={2} style={{ width: '42%', marginLeft: 9, fontSize: rf(12.5), color: BRAND.body }}>{r.label}</Text>
                  <Text style={{ fontSize: rf(12.5), color: BRAND.muted, marginHorizontal: 6 }}>:</Text>
                  <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '700', color: BRAND.ink }}>{r.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {answers.length ? (
            <View style={{ marginTop: 4 }}>
              <Pressable onPress={() => setShowAnswers((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showAnswers }} style={styles.sectionHead}>
                <ClipboardCheck size={17} color={BRAND.green} />
                <Text style={[styles.sectionTitle, { fontSize: rf(12.5), fontWeight: '700' }]}>Screening Questions</Text>
                <Text style={[styles.count, { fontSize: rf(12.5) }]}>{answers.length} / {answers.length}</Text>
                <View style={styles.chev}>
                  {showAnswers ? <ChevronDown size={16} color={BRAND.green} /> : <ChevronRight size={16} color={BRAND.green} />}
                </View>
              </Pressable>
              {showAnswers ? answers.map((t, i) => (
                <View key={i} style={styles.itemRow}>
                  <Check />
                  <Text style={styles.itemText}>{t}</Text>
                </View>
              )) : null}
            </View>
          ) : null}
        </SellCard>

        {/* Device Photos — tap for full screen */}
        {photos.length || images.video ? (
          <SellCard Icon={Camera} title={`Device Photos (${photos.length})${images.video ? ' · Video' : ''}`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {photos.map((s, i) => (
                <Pressable key={s.key} onPress={() => setViewer(i)} accessibilityRole="imagebutton" accessibilityLabel={`View ${cap(s.label)} photo`} style={{ width: '20%', padding: 3 }}>
                  <View style={{ width: '100%', aspectRatio: 0.9, borderRadius: 10, overflow: 'hidden', backgroundColor: BRAND.bg, borderWidth: 1, borderColor: LINE }}>
                    <Image source={{ uri: images[s.key] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                </Pressable>
              ))}
              {images.video ? (
                <Pressable onPress={() => Linking.openURL(images.video).catch(() => {})} accessibilityRole="button" accessibilityLabel="Play video" style={{ width: '20%', padding: 3 }}>
                  <View style={{ width: '100%', aspectRatio: 0.9, borderRadius: 10, backgroundColor: BRAND.ink, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play-circle" size={28} color="#FFFFFF" />
                  </View>
                </Pressable>
              ) : null}
            </View>
          </SellCard>
        ) : null}
      </ScrollView>
      <SellStepBar>
        {submitted ? (
          <SubmittedActions onTrack={track} onHome={goHome} />
        ) : (
          <FlowCta palette={BRAND_FLOW} title={p.editSellOrderId ? 'Update Order' : 'Sell Now'} onPress={submit} loading={saving} disabled={!addr} />
        )}
      </SellStepBar>

      {/* Tick + ribbon + message; closes itself after 2.5 s, revealing this page. */}
      <SellSubmittedPopup visible={popupOpen} onClose={() => setPopupOpen(false)} />

      {/* Full-screen photo view — swipe between the device photos. */}
      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.96)' }}>
          <ScrollView
            ref={viewerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewer || 0) * winW, y: 0 }}
            onLayout={() => viewerRef.current?.scrollTo({ x: (viewer || 0) * winW, animated: false })}
          >
            {photos.map((s) => (
              <View key={s.key} style={{ width: winW, height: winH, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={{ uri: images[s.key] }} style={{ width: winW - 24, height: winH * 0.7 }} resizeMode="contain" />
                <Text style={{ marginTop: 14, fontSize: rf(14), fontWeight: '700', color: '#FFFFFF' }}>{cap(s.label)}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => setViewer(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={{ position: 'absolute', top: insets.top + 12, right: 16, height: 42, width: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
