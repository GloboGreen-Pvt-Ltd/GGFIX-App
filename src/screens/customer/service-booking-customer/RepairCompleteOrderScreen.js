import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Smartphone, MapPin, Store, Calendar, Wrench, Tag, Phone, Camera, Video, User, Home, ReceiptText, Send, CircleCheck, Lock, Headphones, Mic, CalendarClock, Wallet, ChevronDown, Check } from 'lucide-react-native';
import { notify } from '../../../components/confirm';
import { Loader, useBottomBarInset } from '../../../components/rnr';
import { createRepairBooking } from '../../../api/orders';
import { TYPED_DEVICE_TAG, typedDeviceLine } from '../../../utils/typedDevice';
import { listAddresses } from '../../../api/customer';
import { getShop } from '../../../api/shops';
import { uploadMedia } from '../../../api/masterData';
import { selectSession } from '../../../store/authSlice';
import { getBookingContact, setBookingContact } from './bookingContact';
import { issueLabel } from './RepairIssueGroups';
import { clearCartDevices, getCartDevices, removeCartDevice } from './bookingCart';
import { formatDate as fmtDay, formatTime as fmtClock } from './BookingTimeSection';
import { BookingHeader, useHideStackHeader } from './FlowChrome';
import { BookingSheet } from './DeviceSecurityLockSheet';

// Device Security as written into issueSummary ("PIN 1234", "Pattern 1>2>3>5").
const LOCK_NAMES = { PIN: 'PIN', PASSWORD: 'Password', PATTERN: 'Pattern', ACCOUNT: 'iCloud / Google Account' };
function lockLine(lock) {
  if (!lock?.type || lock.type === 'NONE') return '';
  const name = LOCK_NAMES[lock.type] || lock.type;
  const v = String(lock.value || '').trim();
  if (lock.type === 'PATTERN') return v ? `${name} ${v.split(',').filter(Boolean).join('>')}` : name;
  if (lock.type === 'ACCOUNT') return v ? `${name}: ${v}` : name;
  return v ? `${name} ${v}` : name;
}
// On-screen summary — never the PIN / password itself (as Partner).
function lockSummary(lock) {
  if (!lock?.type || lock.type === 'NONE') return '';
  const v = String(lock.value || '');
  if (lock.type === 'PIN') return v ? `PIN set · ${v.length} digits` : 'PIN';
  if (lock.type === 'PASSWORD') return v ? 'Password set' : 'Password';
  if (lock.type === 'PATTERN') return `Pattern · ${v.split(',').filter(Boolean).join(' → ')}`;
  return v ? `Account · ${v}` : 'iCloud / Google Account';
}

// Partner "Review & Confirm" palette.
const ACCENT = '#035C6C';     // teal — icons, totals, CTA bar
const INK = '#111111';
const MUTED = '#6B7280';
const MINT = '#E5F3F5';
const MINT_LINE = '#C7E6EA';
const BORDER = '#E5E7EB';
const HAIR = '#F3F4F6';       // card hairline on the grey page
const PAGE = '#F3F4F6';
const GREEN = '#609138';      // FREE
const COL = { width: '100%', maxWidth: 720, alignSelf: 'center' };
const cardShadow = { shadowColor: INK, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };
const whiteCard = { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: HAIR, ...cardShadow };

function formatTime(t) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

// Partner "Payment" modes; the customer's pick rides along in the booking notes.
const PAYMENT_MODES = ['Cash', 'UPI', 'Card'];
// "02 Nov, 3:03 PM" — Delivery Details rows.
const fmtStamp = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${fmtClock(d)}`;
};

const formatINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Section rail: small teal icon + UPPERCASE letter-spaced label, optional right slot.
function SectionLabel({ Icon, label, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 6 }}>
      <Icon size={14} color={ACCENT} strokeWidth={2} />
      <Text style={{ color: INK, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginLeft: 6 }}>{label}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

// Label/value block inside the device card: hairline on top, 20pt teal icon
// column, UPPERCASE label, optional value on the right, details underneath.
function DetailRow({ Icon, label, value, valueColor = INK, children }) {
  return (
    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: HAIR }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 20, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={ACCENT} strokeWidth={2} />
        </View>
        <Text style={{ flex: 1, color: INK, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }} numberOfLines={2}>{label}</Text>
        {value != null ? (
          <Text style={{ flexShrink: 1, maxWidth: '62%', textAlign: 'right', color: valueColor, fontSize: 13, fontWeight: '800', marginLeft: 8 }} numberOfLines={2}>{value}</Text>
        ) : null}
      </View>
      {children ? <View style={{ paddingLeft: 28, marginTop: 6 }}>{children}</View> : null}
    </View>
  );
}

// Muted icon + text line (address, phone, notes).
function InfoLine({ Icon, children, bold, color = MUTED, first }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: first ? 0 : 4 }}>
      <Icon size={12} color={color === MUTED ? ACCENT : color} strokeWidth={2} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, marginLeft: 6, fontSize: 12, lineHeight: 17, color: bold ? INK : color, fontWeight: bold ? '700' : '400' }}>{children}</Text>
    </View>
  );
}

// Bill line: "• label …… amount".
function BillLine({ label, value, valueColor = MUTED, bold }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
      <Text style={{ flex: 1, fontSize: 11.5, color: MUTED }} numberOfLines={2}>• {label}</Text>
      <Text style={{ fontSize: 11.5, color: valueColor, fontWeight: bold ? '800' : '400', marginLeft: 8 }}>{value}</Text>
    </View>
  );
}

export default function RepairCompleteOrderScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const insets = useSafeAreaInsets();
  // Customer's own name / phone from the signed-in session (no extra call).
  const session = useSelector(selectSession);
  const p = route.params || {};
  useHideStackHeader(navigation);
  const [shop, setShop] = useState(null);
  const [addr, setAddr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Payment (optional).
  const [payMode, setPayMode] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, addrs] = await Promise.all([
          p.shopId ? getShop(p.shopId).catch(() => null) : null,
          listAddresses().catch(() => []),
        ]);
        setShop(s);
        setAddr(addrs.find((a) => a.id === p.addressId) || addrs[0]);
      } finally { setLoading(false); }
    })();
  }, [p.shopId, p.addressId]);

  // One device's booking: { device, services, media, bookingExtras }.
  const bookOne = async (e) => {
    const m = e.media || {};
    // Optional Devices & Repair extras (voice note, IMEI, accessories, …).
    const x = e.bookingExtras || {};
    const morePhotos = (Array.isArray(m.more) ? m.more : []).filter((a) => a?.uri);
    // The voice note is a local recording; upload it like the photos.
    const voiceExt = x.voiceNoteUri ? ((String(x.voiceNoteUri).split('?')[0].split('.').pop() || 'm4a').toLowerCase()) : '';
    const voiceAsset = x.voiceNoteUri
      ? { uri: x.voiceNoteUri, fileName: `voice-note-${Date.now()}.${voiceExt}`, mimeType: `audio/${voiceExt === 'mp3' ? 'mpeg' : voiceExt}` }
      : null;
    // 'repair-bookings' routes these to S3 under media.ggfix.in/Devicefiles/;
    // the slot becomes the filename stem (front-…, back-…, video-…).
    // Front / Back / Video MUST reach the booking: retry once, and if a picked
    // file still can't be uploaded, stop with a clear error instead of silently
    // creating the booking without it (the root cause of photos missing in View Details).
    const mustUpload = async (asset, slot, label) => {
      if (!asset?.uri) return null;
      let lastErr = null;
      for (let i = 0; i < 2; i += 1) {
        try {
          const url = await uploadMedia(asset, 'repair-bookings', { slot });
          if (url) return url;
          lastErr = new Error('no URL returned');
        } catch (err) { lastErr = err; }
      }
      throw new Error(`Couldn't upload the ${label}. Check your connection and try again. (${lastErr?.message || 'upload failed'})`);
    };
    const [frontImageUrl, backImageUrl, videoUrl, voiceNoteUrl, ...morePhotoUrls] = await Promise.all([
      mustUpload(m.front, 'front', 'Front Side photo'),
      mustUpload(m.back, 'back', 'Back Side photo'),
      mustUpload(m.video, 'video', 'Full Coverage Video'),
      voiceAsset ? uploadMedia(voiceAsset, 'repair-bookings', { slot: 'voice' }).catch(() => null) : null,
      ...morePhotos.map((a, i) => uploadMedia(a, 'repair-bookings', { slot: `photo${i + 3}` }).catch(() => null)),
    ]);
    // The booking API has no columns for these, so they follow the issue
    // text as labelled lines the shop reads.
    const moreUrls = morePhotoUrls.filter(Boolean);
    const lockText = lockLine(x.lock);
    // Customer Details step: a contact other than the account, plus the
    // optional alternative number / email / address.
    const c = getBookingContact() || {};
    const otherContact = (c.name && c.name !== (session?.fullName || '')) || (c.mobile && c.mobile !== (session?.mobile || ''));
    const extraLines = [
      otherContact ? `Contact: ${[c.name, c.mobile].filter(Boolean).join(' · ')}` : null,
      c.altMobile ? `Alternative mobile: ${c.altMobile}` : null,
      c.email ? `Email: ${c.email}` : null,
      c.address ? `Address: ${c.address}` : null,
      x.imei ? `IMEI: ${x.imei}` : null,
      x.serialNumber ? `Serial number: ${x.serialNumber}` : null,
      x.accessories ? `Accessories: ${x.accessories}` : null,
      lockText ? `Device security: ${lockText}` : null,
      voiceNoteUrl ? `Voice note: ${voiceNoteUrl}` : null,
      moreUrls.length ? `More photos: ${moreUrls.join(', ')}` : null,
    x.bookingTime ? `Booking time: ${fmtDay(new Date(x.bookingTime))} · ${fmtClock(new Date(x.bookingTime))}` : null,
    x.expectedDelivery ? `Expected delivery: ${fmtDay(new Date(x.expectedDelivery))} · ${fmtClock(new Date(x.expectedDelivery))}` : null,
    x.customerApproved ? 'Customer approved the booking details, estimated cost and expected completion time' : null,
    payMode ? `Payment: ${payMode}${payAmount ? ` · ₹${payAmount}` : ''}` : null,
    ].filter(Boolean);
    // A custom "Other" issue has no real repairServiceId (its id is 'OTHER'),
    // so it must NOT go into the backend services[] rows. It's folded into the
    // free-text issueSummary instead; predefined issues become service rows.
    const allSvcs = e.services || [];
    const realSvcs = allSvcs.filter((s) => !s.custom);
    const customSvcs = allSvcs.filter((s) => s.custom);
    // An "Other" device (typed brand / model) has no catalogue ids, so its
    // typed names ride along as labels and lead the free-text issueSummary,
    // which is what the shop reads. Catalogue devices send exactly as before.
    const d = e.device || {};
    const typedDevice = typedDeviceLine(d);
    const payload = {
      shopId: p.shopId,
      brandId: e.device?.brandId,
      modelId: e.device?.modelId,
      ramOptionId: e.device?.ramOptionId,
      storageOptionId: e.device?.storageOptionId,
      color: e.device?.color,
      ...(d.customModel ? {
        brandName: d.brandName,
        modelName: d.modelName,
        ramLabel: d.ramLabel,
        storageLabel: d.storageLabel,
      } : {}),
      serviceMode: 'PICKUP',
      issueSummary: [
        [
          typedDevice ? `${TYPED_DEVICE_TAG}${typedDevice}` : null,
          realSvcs.map(issueLabel).join(', '),
          ...customSvcs.map((s) => `Other${s.categoryName ? ` (${s.categoryName})` : ''}: ${s.name}`),
          e.device?.dead ? "Device reported dead / won't power on" : null,
        ].filter(Boolean).join(' · '),
        ...extraLines,
      ].filter(Boolean).join('\n'),
      // The service row's name carries the typed note in brackets, so the
      // shop's lists, receipts and invoices show it (column is 255 chars).
      services: realSvcs.map((s) => ({ repairServiceId: s.id, serviceCode: s.code, serviceName: issueLabel(s).slice(0, 255) })),
      pickupAddressId: p.addressId,
      pickupDate: p.pickupDate,
      pickupSlotStart: p.pickupSlotStart,
      pickupSlotEnd: p.pickupSlotEnd,
      frontImageUrl,
      backImageUrl,
      videoUrl,
    };
    return createRepairBooking(payload);
  };

  const book = async () => {
    setSaving(true);
    try {
      // Devices added with "Add Another Device" first, then this one — same
      // shop, address and pickup slot. Each booked device leaves the list, so
      // a retry after a failure never books one twice.
      const others = getCartDevices();
      for (const e of others) {
        await bookOne(e);
        removeCartDevice(e.entryId);
      }
      const created = await bookOne({ device: p.device, services: p.services, media: p.media, bookingExtras: p.bookingExtras });
      setBookingContact(null);
      clearCartDevices();
      navigation.reset({
        index: 1,
        routes: [
          { name: 'CustomerTabs' },
          {
            name: 'RepairConfirmation',
            params: {
              booking: created, device: p.device, shop, address: addr,
              services: [...others.flatMap((e) => e.services || []), ...(p.services || [])],
            },
          },
        ],
      });
    } catch (e) {
      notify('Error', e.message);
    } finally { setSaving(false); }
  };

  if (loading) return <Loader label="Preparing your booking..." />;

  const dev = p.device || {};
  const services = p.services || [];
  // Devices added earlier with "Add Another Device" (booked together).
  const others = getCartDevices();
  const deviceCount = others.length + 1;
  const sumPrices = (list) => (list || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const servicesTotal = sumPrices(services) + others.reduce((sum, e) => sum + sumPrices(e.services), 0);
  const total = servicesTotal;

  // ---- presentation data (visual only) ----
  const addrRest = addr ? [addr.locality, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : '';
  const media = p.media || {};
  // Photo 1 / 2 = front / back, then any extra photos, then the video.
  const photoSlots = [
    { key: 'front', label: 'Photo 1', asset: media.front },
    { key: 'back', label: 'Photo 2', asset: media.back },
    ...(Array.isArray(media.more) ? media.more : []).map((a, i) => ({ key: `more-${i}`, label: `Photo ${i + 3}`, asset: a })),
    ...(media.video?.uri ? [{ key: 'video', label: 'Video', asset: media.video, isVideo: true }] : []),
  ].filter((m) => m.asset?.uri);
  // Optional Devices & Repair extras.
  const extras = p.bookingExtras || {};
  const lockText = lockSummary(extras.lock);
  const idLine = extras.imei ? `IMEI: ${extras.imei}` : extras.serialNumber ? `Serial No: ${extras.serialNumber}` : '';
  // "Brand · Model" and "storage · colour · model number" (Partner).
  const modelName = dev.modelName || 'Device';
  const deviceTitle = dev.brandName ? `${dev.brandName} · ${modelName}` : modelName;
  const specLine = [[dev.ramLabel, dev.storageLabel].filter(Boolean).join(' / '), dev.color, dev.modelNumber].filter(Boolean).join(' · ');
  const contact = getBookingContact();
  const customerName = contact?.name || session?.fullName || addr?.fullName || '';
  const customerPhone = contact?.mobile || session?.mobile || addr?.mobile || '';
  const customerAlt = contact?.altMobile || '';
  // Short location under the customer (city, state), as Partner.
  const customerPlace = [addr?.city || addr?.locality, addr?.state].filter(Boolean).join(', ');
  const initials = customerName.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <BookingHeader title="Review & Confirm" subtitle="Check the devices, services and payment" navigation={navigation} step={2} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomSpace }}>
        <View style={COL}>
          {/* Customer details — the signed-in customer (session), mint card. */}
          {customerName || customerPhone ? (
            <>
              <SectionLabel Icon={Phone} label="CUSTOMER DETAILS" />
              <View style={{ borderRadius: 16, backgroundColor: MINT, borderWidth: 1, borderColor: MINT_LINE, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ height: 40, width: 40, borderRadius: 20, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  {initials ? (
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>{initials}</Text>
                  ) : (
                    <User size={18} color="#FFFFFF" strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: INK, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{customerName || 'You'}</Text>
                  {customerPhone ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Phone size={11} color={MUTED} strokeWidth={2} />
                      <Text style={{ fontSize: 11, color: MUTED, marginLeft: 4 }} numberOfLines={1}>{customerPhone}</Text>
                    </View>
                  ) : null}
                  {customerAlt ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Phone size={11} color={MUTED} strokeWidth={2} />
                      <Text style={{ fontSize: 11, color: MUTED, marginLeft: 4 }} numberOfLines={1}>Alternate: {customerAlt}</Text>
                    </View>
                  ) : null}
                  {customerPlace ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <MapPin size={11} color={MUTED} strokeWidth={2} />
                      <Text style={{ flex: 1, fontSize: 11, color: MUTED, marginLeft: 4 }} numberOfLines={1}>{customerPlace}</Text>
                    </View>
                  ) : null}
                </View>
                {/* Signed-in (OTP-verified) customer — Partner's "Verified" pill. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FFFFFF' }}>
                  <CircleCheck size={11} color={ACCENT} strokeWidth={2} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: ACCENT, marginLeft: 3 }}>Verified</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* Device details — one card: device head, then label/value rows. */}
          <SectionLabel
            Icon={ReceiptText}
            label="DEVICE DETAILS"
            right={(
              <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: MINT }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: ACCENT }}>{deviceCount} Device{deviceCount === 1 ? '' : 's'}</Text>
              </View>
            )}
          />
          <View style={[whiteCard, { padding: 10 }]}>
            {/* Device head */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ height: 50, width: 46, borderRadius: 12, marginRight: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: HAIR, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {dev.imageUrl ? (
                  <Image source={{ uri: dev.imageUrl }} style={{ width: 38, height: 44 }} resizeMode="contain" />
                ) : (
                  <Smartphone size={21} color={ACCENT} strokeWidth={2} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: INK, fontSize: 13, fontWeight: '800' }} numberOfLines={2}>{deviceTitle}</Text>
                {specLine ? (
                  <Text style={{ fontSize: 11, color: MUTED, marginTop: 1 }} numberOfLines={2}>{specLine}</Text>
                ) : null}
                {idLine ? (
                  <Text style={{ fontSize: 11, color: MUTED, marginTop: 1 }} numberOfLines={1}>{idLine}</Text>
                ) : null}
              </View>
            </View>

            {/* Repair services — numbered mint badges */}
            <DetailRow Icon={Wrench} label="SERVICE DETAILS">
              {services.length ? services.map((s, idx) => (
                <View key={s.id || idx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: idx ? 7 : 0, marginLeft: -28 }}>
                  <View style={{ height: 20, width: 20, borderRadius: 7, marginRight: 8, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: ACCENT }}>{idx + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, color: INK, fontSize: 12, fontWeight: '600' }} numberOfLines={3}>{issueLabel(s)}</Text>
                  {s.price != null ? (
                    <Text style={{ color: INK, fontSize: 12, fontWeight: '800', marginLeft: 8 }}>₹{formatINR(s.price)}</Text>
                  ) : null}
                </View>
              )) : (
                <Text style={{ fontSize: 12, color: MUTED }}>No services selected</Text>
              )}
              {extras.voiceNoteUri ? (
                <View style={{ marginTop: 7, marginLeft: -28 }}>
                  <InfoLine Icon={Mic} first>Voice note attached</InfoLine>
                </View>
              ) : null}
            </DetailRow>

            {/* Estimated cost (services subtotal) */}
            <DetailRow Icon={Tag} label="ESTIMATED COST" value={`₹${formatINR(servicesTotal)}`} valueColor={ACCENT} />

            {/* Device security — never the PIN / password itself. */}
            <DetailRow Icon={Lock} label="DEVICE SECURITY" value={lockText || 'None'} valueColor={lockText ? INK : MUTED} />

            {/* Device photos — the captured images from Review (display only). */}
            <DetailRow Icon={Camera} label="DEVICE PHOTOS" value={photoSlots.length ? null : 'None'}>
              {photoSlots.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {photoSlots.map((m) => (
                    <View key={m.key} style={{ alignItems: 'center' }}>
                      <View style={{ height: 56, width: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: INK, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                        {m.isVideo ? (
                          <Video size={20} color="#FFFFFF" />
                        ) : (
                          <Image source={{ uri: m.asset.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        )}
                      </View>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: MUTED, marginTop: 3 }}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </DetailRow>

            {/* Accessories handed over — "None" when nothing was given. */}
            <DetailRow Icon={Headphones} label="ACCESSORIES" value={extras.accessories || 'None'} valueColor={extras.accessories ? INK : MUTED} />

            {/* Delivery details — booking time and the expected delivery. */}
            {extras.bookingTime || extras.expectedDelivery ? (
              <DetailRow Icon={CalendarClock} label="DELIVERY DETAILS">
                {extras.bookingTime ? (
                  <Text style={{ fontSize: 12, color: MUTED }}>Booking Time: <Text style={{ color: INK, fontWeight: '700' }}>{fmtStamp(extras.bookingTime)}</Text></Text>
                ) : null}
                {extras.expectedDelivery ? (
                  <Text style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Estimated Delivery: <Text style={{ color: INK, fontWeight: '700' }}>{fmtStamp(extras.expectedDelivery)}</Text></Text>
                ) : null}
              </DetailRow>
            ) : null}

            {/* Pickup address */}
            <DetailRow Icon={MapPin} label="PICKUP ADDRESS">
              {addr ? (
                <>
                  <InfoLine Icon={User} bold first>{addr.fullName} · {addr.mobile}</InfoLine>
                  {addr.addressLine ? <InfoLine Icon={Home}>{addr.addressLine}</InfoLine> : null}
                  {addrRest ? <InfoLine Icon={MapPin}>{addrRest}</InfoLine> : null}
                </>
              ) : (
                <Text style={{ fontSize: 12, color: MUTED }}>No address selected</Text>
              )}
            </DetailRow>

            {/* Shop & schedule */}
            <DetailRow Icon={Store} label="SHOP & SCHEDULE">
              {shop ? (
                <>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: INK }} numberOfLines={2}>{shop.name}</Text>
                  {shop.address ? <InfoLine Icon={MapPin}>{shop.address}</InfoLine> : null}
                  {(shop.mobile || shop.phone) ? <InfoLine Icon={Phone}>{shop.mobile || shop.phone}</InfoLine> : null}
                </>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: MINT, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 10, marginTop: shop ? 8 : 0 }}>
                <Calendar size={16} color={ACCENT} strokeWidth={2} />
                <View style={{ marginLeft: 9, flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 10.5, color: MUTED }}>Scheduled Date & Time</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: ACCENT, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {p.pickupDate} · {formatTime(p.pickupSlotStart)} - {formatTime(p.pickupSlotEnd)}
                  </Text>
                </View>
              </View>
            </DetailRow>
          </View>

          {/* Bill summary — same amounts as before (services, pickup, coupon, total). */}
          <SectionLabel Icon={ReceiptText} label="BILL SUMMARY" />
          <View style={[whiteCard, { padding: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: INK, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{modelName}</Text>
              <Text style={{ color: INK, fontSize: 13, fontWeight: '800', marginLeft: 8 }}>₹{formatINR(sumPrices(services))}</Text>
            </View>
            {services.map((s, idx) => (
              <BillLine key={s.id || idx} label={issueLabel(s)} value={s.price != null ? `₹${formatINR(s.price)}` : ''} />
            ))}
            {others.map((e) => (
              <View key={e.entryId} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: INK, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                    {[e.device?.brandName, e.device?.modelName].filter(Boolean).join(' ') || 'Device'}
                  </Text>
                  <Text style={{ color: INK, fontSize: 13, fontWeight: '800', marginLeft: 8 }}>₹{formatINR(sumPrices(e.services))}</Text>
                </View>
                {(e.services || []).map((s, idx) => (
                  <BillLine key={s.id || idx} label={issueLabel(s)} value={s.price != null ? `₹${formatINR(s.price)}` : ''} />
                ))}
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderColor: BORDER, borderStyle: 'dashed', marginTop: 8, marginBottom: 8 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: INK, fontSize: 13, fontWeight: '800' }}>Grand Total</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: ACCENT }}>₹{formatINR(total)}</Text>
            </View>
            <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>Final amount may vary slightly based on parts availability.</Text>
          </View>

          {/* Payment (optional) — how the customer will pay; noted on the booking. */}
          <SectionLabel Icon={Wallet} label="PAYMENT" right={<Text style={{ fontSize: 10, fontWeight: '800', color: MUTED, letterSpacing: 0.5 }}>OPTIONAL</Text>} />
          <View style={[whiteCard, { padding: 12 }]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setPayOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={payMode ? `Payment mode ${payMode}. Change.` : 'Choose payment mode'}
                className="active:opacity-80"
                style={{ flex: 1.4, height: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F9FAFB', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={{ flex: 1, fontSize: 13, fontWeight: payMode ? '700' : '500', color: payMode ? INK : '#9CA3AF' }} numberOfLines={1}>{payMode || 'Payment mode'}</Text>
                <ChevronDown size={16} color={MUTED} />
              </Pressable>
              <View style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>₹</Text>
                <TextInput
                  value={payAmount}
                  onChangeText={(v) => setPayAmount(v.replace(/[^\d]/g, '').slice(0, 7))}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  cursorColor={ACCENT}
                  accessibilityLabel="Payment amount"
                  style={{ flex: 1, marginLeft: 6, paddingVertical: 0, fontSize: 13, color: INK }}
                />
              </View>
            </View>
            <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
              Pick how you'll pay. Leave it blank to pay on delivery.
            </Text>
          </View>
        </View>
      </ScrollView>

      <BookingSheet visible={payOpen} onClose={() => setPayOpen(false)} maxWidth={420}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: INK, marginBottom: 8 }}>Payment mode</Text>
        {[...PAYMENT_MODES, ''].map((m) => (
          <Pressable
            key={m || 'none'}
            onPress={() => { setPayMode(m); setPayOpen(false); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: payMode === m }}
            className="active:opacity-80"
            style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: HAIR }}
          >
            <Text style={{ flex: 1, fontSize: 14, fontWeight: payMode === m ? '800' : '500', color: m ? INK : MUTED }}>{m || 'Pay on delivery (no mode)'}</Text>
            {payMode === m ? <Check size={16} color={ACCENT} strokeWidth={3} /> : null}
          </Pressable>
        ))}
      </BookingSheet>

      {/* Sticky total + Submit Booking — same total, book() and saving loader. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12, paddingHorizontal: 12 }}>
        <View
          style={[COL, {
            flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9,
            backgroundColor: saving ? '#B8B8B8' : ACCENT,
            shadowColor: ACCENT, shadowOpacity: saving ? 0 : 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: saving ? 0 : 3,
          }]}
        >
          <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }} numberOfLines={1}>
              GRAND TOTAL · {deviceCount} DEVICE{deviceCount === 1 ? '' : 'S'}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit>
              ₹{formatINR(total)}
            </Text>
          </View>
          <Pressable
            onPress={book}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            className={saving ? '' : 'active:opacity-80'}
            style={{ minHeight: 44, minWidth: 120, borderRadius: 999, paddingHorizontal: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            {saving ? (
              <ActivityIndicator color={ACCENT} />
            ) : (
              <>
                <Text style={{ fontSize: 13, fontWeight: '800', color: ACCENT }}>Submit Booking</Text>
                <Send size={15} color={ACCENT} strokeWidth={2} style={{ marginLeft: 6 }} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
