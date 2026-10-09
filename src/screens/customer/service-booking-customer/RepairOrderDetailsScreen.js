import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createAudioPlayer } from 'expo-audio';
import {
  CalendarClock,
  Smartphone,
  MapPin,
  Store,
  Phone,
  Camera,
  ShieldCheck,
  Video,
  FileText,
  Play,
  Pause,
  Wrench,
  IndianRupee,
} from 'lucide-react-native';
import {
  Card,
  CardTitle,
  Loader,
  Badge,
  EmptyState,
} from '../../../components/rnr';
import { getRepairBooking } from '../../../api/orders';
import { useFocusPolling } from '../../../hooks/useFocusPolling';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { getShop } from '../../../api/shops';
import { listAddresses } from '../../../api/customer';
import { parsePickupMeta } from '../../../utils/pickupEstimateMeta';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

const fmtDateTime = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Card rendered on the customer's order detail when the booking's events
// include the technician's compliance / issue-verified note. Wraps an
// optional voice-note player + image thumbnails so the customer can review
// what the technician verified. Returns null when no such event exists.
function ComplianceNoteCard({ event }) {
  const audioUrl = event?.audioUrl;
  const imageUrls = Array.isArray(event?.imageUrls) ? event.imageUrls : [];
  const noteText = event?.note;

  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Release the player on unmount so the next visit can re-acquire it.
  useEffect(() => () => {
    try { soundRef.current?.remove?.(); } catch (_) {}
  }, []);

  // Early return must stay below the hooks so the hook count never changes.
  if (!event) return null;

  const togglePlay = async () => {
    try {
      if (playing && soundRef.current) {
        soundRef.current.pause();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        try { soundRef.current.remove(); } catch (_) {}
        soundRef.current = null;
      }
      const player = createAudioPlayer(audioUrl);
      soundRef.current = player;
      player.addListener('playbackStatusUpdate', (s) => {
        if (s?.didJustFinish) setPlaying(false);
      });
      player.play();
      setPlaying(true);
    } catch (_) { /* best-effort playback */ }
  };

  const hasAudio = !!audioUrl;
  const hasImages = imageUrls.length > 0;
  const attachmentCount = (hasAudio ? 1 : 0) + imageUrls.length;

  return (
    <Card className="rounded-2xl" style={card}>
      {/* Header: amber icon chip + title + "Verified" pill on the right */}
      <View className="flex-row items-center mb-3">
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
          style={{ backgroundColor: YELLOW_SOFT }}
        >
          <FileText size={14} color={BRAND.yellow} />
        </View>
        <View className="flex-1">
          <Text className="font-extrabold tracking-widest" style={{ fontSize: rf(10), color: BRAND.ink, letterSpacing: 1.2 }}>
            ISSUE VERIFIED & UPDATED
          </Text>
          <Text className="font-extrabold text-text mt-0.5" style={{ fontSize: rf(13) }}>
            By your technician
          </Text>
        </View>
        <View
          className="flex-row items-center rounded-full px-2 py-0.5"
          style={{ backgroundColor: MINT }}
        >
          <ShieldCheck size={11} color={GREEN_TEXT} />
          <Text className="font-extrabold ml-1" style={{ fontSize: rf(9), color: GREEN_TEXT }}>VERIFIED</Text>
        </View>
      </View>

      {/* Body — left amber accent bar + content stack */}
      <View className="flex-row">
        <View
          style={{ width: 3, borderRadius: 2, backgroundColor: BRAND.yellow, marginRight: 12, alignSelf: 'stretch' }}
        />
        <View className="flex-1">
          {noteText ? (
            <Text className="text-text leading-5" style={{ fontSize: rf(13) }}>{noteText}</Text>
          ) : (
            <Text className="italic text-text-muted" style={{ fontSize: rf(12) }}>No additional notes.</Text>
          )}

          {hasAudio ? (
            <TouchableOpacity
              onPress={togglePlay}
              className="flex-row items-center rounded-full self-start mt-3 px-3 py-2"
              style={{ backgroundColor: playing ? YELLOW_SOFT : YELLOW_FAINT, borderWidth: 1, borderColor: BRAND.yellow }}
            >
              {playing
                ? <Pause size={13} color={BRAND.ink} />
                : <Play size={13} color={BRAND.ink} />}
              <Text className="font-extrabold ml-1.5" style={{ fontSize: rf(11), color: BRAND.ink }}>
                {playing ? 'Pause voice note' : 'Play voice note'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {hasImages ? (
            <View className="mt-3">
              <Text className="font-bold text-text-muted uppercase mb-1.5" style={{ fontSize: rf(10), letterSpacing: 0.8 }}>
                Photos ({imageUrls.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row">
                  {imageUrls.map((u, i) => (
                    <Image
                      key={i}
                      source={{ uri: u }}
                      style={{
                        width: 84, height: 84, borderRadius: 10, marginRight: 8,
                        backgroundColor: BRAND.line,
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      {/* Footer caption */}
      {event.createdAt ? (
        <View
          className="flex-row items-center mt-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: BRAND.line }}
        >
          <CalendarClock size={11} color={MUTED} />
          <Text className="text-text-muted ml-1.5" style={{ fontSize: rf(10) }}>
            Verified on {fmtDateTime(event.createdAt)}
          </Text>
          {attachmentCount > 0 ? (
            <Text className="text-text-muted ml-auto" style={{ fontSize: rf(10) }}>
              {attachmentCount} {attachmentCount === 1 ? 'attachment' : 'attachments'}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

// Brand palette (09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141).
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const MINT = '#EAF8EC';
const SOFT_MINT = '#F4FBF5';
const GREEN_LINE = 'rgba(9,173,42,0.45)';
const YELLOW_SOFT = '#FEF6DA';
const YELLOW_FAINT = '#FFFCF3';
const RED_SOFT = '#FEECEC';
const LINE = '#E6E6E6';
const MUTED = '#6B6B6B';
const card = {
  backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE,
  padding: 12, marginBottom: 10,
  shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
};

// "2026-10-05" -> "Mon, 05 Oct 2026" (falls back to the raw value).
const fmtDay = (v) => {
  if (!v) return null;
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

// Status pill tones (palette): cancelled red, done green, waiting yellow, else neutral.
function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (/CANCEL|REJECT|FAIL/.test(s)) return { bg: RED_SOFT, fg: BRAND.red };
  if (/COMPLETE|DELIVER|READY|DONE|APPROVED|ACCEPT/.test(s)) return { bg: MINT, fg: GREEN_TEXT };
  if (/PENDING|REQUEST|WAIT|PLACED|CREATED|ESTIMATE/.test(s)) return { bg: YELLOW_SOFT, fg: BRAND.ink };
  return { bg: BRAND.line, fg: BRAND.ink };
}
function Pill({ tone, children, style }) {
  return (
    <View style={[{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: tone.bg, flexShrink: 1 }, style]}>
      <Text numberOfLines={1} style={{ fontSize: rf(10), fontWeight: '800', letterSpacing: 0.4, color: tone.fg, textTransform: 'uppercase' }}>{children}</Text>
    </View>
  );
}

// Section card with a tinted icon chip + title (same pattern as the ticket screen).
function Section({ icon: Icon, tint = MINT, color = GREEN_TEXT, title, right, children }) {
  return (
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
        {Icon ? (
          <View style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
            <Icon size={14} color={color} />
          </View>
        ) : null}
        <Text style={{ flex: 1, fontSize: rf(13), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

// Photo tile: fills the box, and shows a clear placeholder (never a blank box)
// when there is no photo or the image fails to load.
function PhotoTile({ uri, video, label, height = 84 }) {
  const [failed, setFailed] = useState(false);
  const show = !!uri && !video && !failed;
  return (
    <View style={{ flex: 1, paddingHorizontal: 3 }}>
      <View
        style={{
          height, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          backgroundColor: show ? BRAND.line : SOFT_MINT,
          borderWidth: show ? 1 : 1.5, borderStyle: show ? 'solid' : 'dashed', borderColor: show ? LINE : GREEN_LINE,
        }}
      >
        {show ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setFailed(true)} />
        ) : uri && video ? (
          <>
            <Video size={20} color={BRAND.green} />
            <Text style={{ fontSize: rf(9), fontWeight: '700', color: GREEN_TEXT, marginTop: 3 }}>Video added</Text>
          </>
        ) : (
          <>
            <Camera size={18} color={uri ? BRAND.yellow : BRAND.green} />
            <Text style={{ fontSize: rf(9), color: MUTED, marginTop: 3, textAlign: 'center' }}>{uri ? 'Preview unavailable' : 'Not added'}</Text>
          </>
        )}
      </View>
      {label ? <Text style={{ fontSize: rf(10), fontWeight: '700', color: BRAND.body, textAlign: 'center', marginTop: 4 }} numberOfLines={1}>{label}</Text> : null}
    </View>
  );
}

function DetailLine({ label, value, pill }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BRAND.line }}>
      <Text style={{ fontSize: rf(11), color: MUTED, width: '48%' }}>{label}</Text>
      {pill ? (
        <Pill tone={pill}>{value || '-'}</Pill>
      ) : (
        <Text style={{ flex: 1, fontSize: rf(11.5), fontWeight: '700', color: BRAND.ink }}>{value || '-'}</Text>
      )}
    </View>
  );
}

export default function RepairOrderDetailsScreen({ navigation, route }) {
  const { bookingId, fromOrders } = route.params || {};
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  // Device details resolved from the booking's IDs (the booking record doesn't
  // store the model name/specs).
  const [dev, setDev] = useState({});
  const [shop, setShop] = useState(null);
  const [addr, setAddr] = useState(null);

  const goHome = useCallback(() => {
    // From My Orders: go back to that list. From the booking confirmation (a
    // dead-end), the wizard screens are behind us, so jump to the root tabs.
    if (fromOrders && navigation.canGoBack()) navigation.goBack();
    else navigation.popToTop();
  }, [navigation, fromOrders]);

  // Override the stack header's back button: it should always go Home, not
  // backwards through the booking wizard.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackAction: goHome,
    });
  }, [navigation, goHome]);

  // Reload on focus, then poll, so the timeline picks up shop status updates.
  const reload = useCallback(async () => {
    try {
      const next = await getRepairBooking(bookingId);
      // Keep identity when unchanged so the [b] effects don't refetch per tick.
      setB((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch (_) {}
  }, [bookingId]);
  useFocusEffect(useCallback(() => {
    (async () => { await reload(); setLoading(false); })();
  }, [reload]));
  useFocusPolling(reload);

  // Resolve device name / image / specs from the booking's IDs.
  useEffect(() => {
    if (!b) return;
    let cancelled = false;
    (async () => {
      const [brands, models, rams, storages] = await Promise.all([
        getBrands().catch(() => []),
        b.brandId ? getModelsByBrand(b.brandId).catch(() => []) : [],
        getRamOptions().catch(() => []),
        getStorageOptions().catch(() => []),
      ]);
      if (cancelled) return;
      const model = (models || []).find((m) => m.id === b.modelId);
      const brandName = (brands || []).find((x) => x.id === b.brandId)?.name;
      const ramLabel = (rams || []).find((r) => r.id === b.ramOptionId)?.label;
      const storageLabel = (storages || []).find((s) => s.id === b.storageOptionId)?.label;
      const image = model?.imageUrl
        || (model?.imageBase64 ? `data:image/png;base64,${model.imageBase64}` : null);
      setDev({
        name: b.modelName || model?.name || (brandName ? `${brandName} device` : 'Device'),
        image,
        specs: [brandName, b.color, [ramLabel, storageLabel].filter(Boolean).join(' / ')].filter(Boolean).join(' · '),
      });
    })();
    return () => { cancelled = true; };
  }, [b]);

  // Resolve shop + pickup address from the booking's IDs.
  useEffect(() => {
    if (!b) return;
    let cancelled = false;
    (async () => {
      const [shopRes, addrs] = await Promise.all([
        b.shopId ? getShop(b.shopId).catch(() => null) : null,
        listAddresses().catch(() => []),
      ]);
      if (cancelled) return;
      setShop(shopRes || b.shop || null);
      setAddr((addrs || []).find((a) => a.id === b.pickupAddressId) || b.address || null);
    })();
    return () => { cancelled = true; };
  }, [b]);

  if (loading) return <Loader label="Loading order..." />;
  if (!b) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <EmptyState
          accent={BRAND.green}
          accentSoft={MINT}
          title="Booking not found"
          description="We couldn't load this order."
          actionLabel="Go home"
          onAction={goHome}
        />
      </View>
    );
  }

  const { clean: cleanIssue, meta } = parsePickupMeta(b.issueSummary);
  // Prefer real columns; fall back to meta when the pickup-estimate appendix
  // is the only place a field actually lives.
  const metaServices = (meta?.services || []).map((s) => ({
    serviceName: s.name || s.serviceName || s.code,
    estimatedPrice: Number(s.price) || 0,
  })).filter((s) => s.serviceName);
  const bookingServices = b.services || [];
  const bookingServiceTotal = bookingServices.reduce((s, x) => s + Number(x.estimatedPrice || 0), 0);
  // If the booking's per-service rows have no prices (the submitPickupRepairEstimate
  // endpoint only updates estimateAmount, not service line prices) but the meta
  // carries them, render the meta lines instead so the price summary isn't all ₹0.
  const displayServices = (bookingServices.length && bookingServiceTotal > 0)
    ? bookingServices
    : (metaServices.length ? metaServices : bookingServices);
  const serviceNames = displayServices.map((s) => s.serviceName).join(', ');
  const priceTotal = b.estimateAmount != null
    ? Number(b.estimateAmount)
    : displayServices.reduce((s, x) => s + Number(x.estimatedPrice || 0), 0);
  // Producer key today is estimatedReadyAt; older rows used estimatedPickupAt.
  const readyAt = b.estimatedReadyAt || meta?.estimatedReadyAt || meta?.estimatedPickupAt || null;
  const deliveryAt = b.estimatedDeliveryAt || meta?.estimatedDeliveryAt || null;
  const estTimeText = readyAt
    ? `${fmtDateTime(readyAt)}${b.estimatedDurationHours ? `, ${b.estimatedDurationHours}Hr` : ''}`
    : '-';
  const approvalDone = (b.customerApproval || '').toUpperCase() === 'DONE' || meta?.customerApproved === true;
  const approvalText = approvalDone ? 'Done' : (b.customerApproval || 'Pending');
  const hasDevicePhotos = !!(b.frontImageUrl || b.backImageUrl || b.videoUrl);
  const bookingNo = b.bookingNumber
    ? (String(b.bookingNumber).startsWith('#') ? b.bookingNumber : `#${b.bookingNumber}`)
    : null;
  const centered = { width: '100%', maxWidth: 600, alignSelf: 'center' };

  const slotText = b.pickupSlotStart && b.pickupSlotEnd
    ? `${String(b.pickupSlotStart).slice(0, 5)} - ${String(b.pickupSlotEnd).slice(0, 5)}`
    : null;
  const statusText = b.status ? String(b.status).replace(/_/g, ' ') : null;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
       <View style={centered}>
        {/* Arriving banner (pickup bookings only) */}
        {b.pickupDate ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: MINT, borderWidth: 1, borderColor: GREEN_LINE, borderRadius: 14, padding: 10, marginBottom: 10 }}>
            <View style={{ height: 36, width: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <CalendarClock size={17} color={BRAND.green} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: GREEN_TEXT }} numberOfLines={1}>
                Arriving on {fmtDay(b.pickupDate)}
              </Text>
              {slotText ? (
                <Text style={{ fontSize: rf(12), fontWeight: '800', color: BRAND.ink, marginTop: 1 }}>{slotText}</Text>
              ) : null}
              <Text style={{ fontSize: rf(10.5), color: MUTED, marginTop: 2 }}>
                Pickup confirmed! Our pickup partner will contact you shortly.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Hero device card */}
        <View style={card}>
          {(bookingNo || statusText) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
                <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: GREEN_TEXT, letterSpacing: 1 }}>BOOKING</Text>
                <Text style={{ fontSize: rf(12), fontWeight: '800', color: BRAND.ink, marginLeft: 6, flexShrink: 1 }} numberOfLines={1} selectable>{bookingNo}</Text>
              </View>
              {statusText ? <Pill tone={statusTone(b.status)} style={{ maxWidth: '52%' }}>{statusText}</Pill> : null}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 60, height: 72, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.line }}>
              {dev.image ? (
                <Image source={{ uri: dev.image }} style={{ width: '92%', height: '92%' }} resizeMode="contain" />
              ) : (
                <Smartphone size={24} color={BRAND.green} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 11 }}>
              <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={2}>
                {dev.name || b.modelName || 'Device'}
              </Text>
              {dev.specs ? (
                <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 2 }} numberOfLines={2}>{dev.specs}</Text>
              ) : null}
              {displayServices.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                  {displayServices.slice(0, 3).map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginRight: 5, marginTop: 4, backgroundColor: MINT, maxWidth: '100%' }}>
                      <Wrench size={10} color={GREEN_TEXT} />
                      <Text style={{ fontSize: rf(10), fontWeight: '800', color: GREEN_TEXT, marginLeft: 4, flexShrink: 1 }} numberOfLines={1}>{s.serviceName}</Text>
                    </View>
                  ))}
                  {displayServices.length > 3 ? (
                    <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, backgroundColor: BRAND.line }}>
                      <Text style={{ fontSize: rf(10), fontWeight: '800', color: BRAND.ink }}>+{displayServices.length - 3}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Device Photos */}
        {hasDevicePhotos ? (
          <Section icon={Camera} tint={YELLOW_SOFT} color={BRAND.yellow} title="Device Photos">
            <View style={{ flexDirection: 'row', marginHorizontal: -3 }}>
              <PhotoTile uri={b.frontImageUrl} label="Front Side" />
              <PhotoTile uri={b.backImageUrl} label="Back Side" />
              <PhotoTile uri={b.videoUrl} video label="Full Coverage Video" />
            </View>
          </Section>
        ) : null}

        {/* Price Summary */}
        {(displayServices.length || b.estimateAmount != null) ? (
          <Section icon={IndianRupee} title="Price Summary">
            {displayServices.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                <View style={{ height: 18, width: 18, borderRadius: 9, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                  <Text style={{ fontSize: rf(9), fontWeight: '800', color: GREEN_TEXT }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: rf(12), color: BRAND.ink, paddingRight: 8 }} numberOfLines={1}>{s.serviceName}</Text>
                <Text style={{ fontSize: rf(12), fontWeight: '800', color: BRAND.ink }}>₹{Number(s.estimatedPrice || 0).toLocaleString('en-IN')}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: BRAND.line }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>Estimated Repair Amount</Text>
              <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: MINT }}>
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: GREEN_TEXT }}>₹{Number(priceTotal).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </Section>
        ) : null}

        {/* Repair Details */}
        <Section icon={FileText} tint={BRAND.line} color={BRAND.ink} title="Repair Details">
          <DetailLine label="Complaint Issue" value={cleanIssue} />
          <DetailLine label="Estimated Approximate Time" value={estTimeText} />
          <DetailLine label="Estimated Delivery Date" value={fmtDateTime(deliveryAt)} />
          <DetailLine
            label="Customer Repair Approval"
            value={approvalText}
            pill={approvalDone ? { bg: MINT, fg: GREEN_TEXT } : { bg: YELLOW_SOFT, fg: BRAND.ink }}
          />
        </Section>

        {/* Device Security */}
        <Section icon={ShieldCheck} title="Device Security">
          <DetailLine
            label="PIN / Pattern"
            value={b.devicePin
              ? (b.deviceSecurityType ? `${b.deviceSecurityType} - ${b.devicePin}` : b.devicePin)
              : null}
          />
          <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 8 }}>Device Missing / Damage Parts</Text>
          {b.missingDamageParts ? (
            <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 4, backgroundColor: RED_SOFT }}>
              <Text style={{ fontSize: rf(11), fontWeight: '800', color: BRAND.red }}>{b.missingDamageParts}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: rf(11.5), fontWeight: '700', color: BRAND.ink, marginTop: 2 }}>Nil</Text>
          )}
        </Section>

        {/* Technician uploaded photos */}
        {(b.technicianName || b.technicianCode || b.technicianPhotos?.length) ? (
          <Section icon={Camera} title="Technician Photos">
            {(b.technicianName || b.technicianCode) ? (
              <Text style={{ fontSize: rf(11), color: MUTED, marginBottom: 8 }}>
                {[b.technicianName, b.technicianCode].filter(Boolean).join(' — ')}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', marginHorizontal: -3 }}>
              {(b.technicianPhotos?.length ? b.technicianPhotos.slice(0, 3) : [null, null, null]).map((uri, i) => (
                <PhotoTile key={i} uri={uri} height={78} />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Technician Issue Verified & Updated — pulled from the booking's
            events list. The customer-facing event row carries the optional
            audio + image attachments the technician submitted with the note
            (after ticket-service writes them on the
            TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED step event). */}
        <ComplianceNoteCard
          event={(b.events || []).find(
            (e) => (e?.status || '').toUpperCase() === 'TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED',
          )}
        />

        {/* Pickup Address */}
        {addr ? (
          <Section icon={MapPin} tint={RED_SOFT} color={BRAND.red} title="Pickup Address">
            <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>
              {addr.fullName}{addr.mobile ? ` · ${addr.mobile}` : ''}
            </Text>
            <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2, lineHeight: rf(16) }}>
              {[addr.addressLine, addr.locality, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
            </Text>
          </Section>
        ) : null}

        {/* Shop & Schedule */}
        {shop ? (
          <Section icon={Store} title="Shop & Schedule">
            <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>{shop.name}</Text>
            {shop.address ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2, lineHeight: rf(16) }}>{shop.address}</Text> : null}
            {(shop.mobile || shop.phone) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Phone size={12} color={GREEN_TEXT} />
                <Text style={{ fontSize: rf(11.5), color: MUTED, marginLeft: 5 }}>{shop.mobile || shop.phone}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: MINT, borderRadius: 11, marginTop: 9, paddingHorizontal: 10, paddingVertical: 7 }}>
              <CalendarClock size={14} color={BRAND.green} />
              <Text style={{ fontSize: rf(12), fontWeight: '800', color: GREEN_TEXT, marginLeft: 7 }}>
                {fmtDay(b.pickupDate) || '-'}
                {slotText ? ` · ${slotText}` : ''}
              </Text>
            </View>
          </Section>
        ) : null}

       </View>
      </ScrollView>
    </View>
  );
}
