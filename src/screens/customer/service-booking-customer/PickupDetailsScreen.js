import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ImageViewerModal from '../../../components/ImageViewerModal';
import { normalizeDeviceImageUrl } from '../../../utils/images';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
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
  User,
  Barcode,
  Headphones,
  CalendarDays,
  Clock,
  Tag,
  Banknote,
} from 'lucide-react-native';
import {
  Card,
  CardTitle,
  Loader,
  Badge,
  EmptyState,
} from '../../../components/rnr';
import { getRepairBooking, getRepairDeliveryForCustomer, getServiceTicket, updateRepairBookingMedia } from '../../../api/orders';
import { uploadMedia } from '../../../api/masterData';
import * as ImagePicker from 'expo-image-picker';
import { BookingSheet } from './DeviceSecurityLockSheet';
import { notify } from '../../../components/confirm';
import { PickupHorizontalCard, buildPickupTimeline } from './pickupTimeline';
import { useFocusPolling } from '../../../hooks/useFocusPolling';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { getShop } from '../../../api/shops';
import { listAddresses } from '../../../api/customer';
import { parsePickupMeta } from '../../../utils/pickupEstimateMeta';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { selectSession } from '../../../store/authSlice';

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
    <View style={SUB}>
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
    </View>
  );
}

// Brand palette (035C6C · 111111 · F3F4F6 · F3F4F6 · FAA700 · F32C26).
const GREEN_TEXT = '#035C6C'; // #035C6C shaded for text on white
const MINT = '#E5F3F5';
const SOFT_MINT = '#F0F8F9';
const GREEN_LINE = 'rgba(3,92,108,0.45)';
const YELLOW_SOFT = '#FFF4D6';
const YELLOW_FAINT = '#FFF4D6';
const RED_SOFT = '#FEEBEA';
const LINE = '#E8EAEE';
const MUTED = '#606E87';
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
// Partner "Pickup Details" design: tinted disc + spaced caps label + rule.
function RefSection({ icon: Icon, tint, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
      <View style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color="#FFFFFF" />
      </View>
      <Text style={{ marginLeft: 9, fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink, letterSpacing: 1.6 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: LINE, marginLeft: 9 }} />
    </View>
  );
}
function RefRow({ icon: Icon, tint, label, value, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <View style={{ height: 32, width: 32, borderRadius: 9, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
        <Icon size={15} color="#FFFFFF" />
      </View>
      <Text style={{ width: 104, paddingRight: 6, fontSize: rf(12), color: MUTED }}>{label}</Text>
      {children || <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={3}>{value}</Text>}
    </View>
  );
}

// Divided block inside the single View Details summary card.
const SUB = { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: LINE };
function Section({ icon: Icon, tint = MINT, color = GREEN_TEXT, title, right, children }) {
  return (
    <View style={SUB}>
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
function PhotoTile({ uri: rawUri, video, label, height = 84, onPress, onLongPress, busy, square }) {
  // 0 = normalised URL, 1 = raw stored URL (retry), 2 = both failed.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setAttempt(0); }, [rawUri]);
  const norm = video ? rawUri : normalizeDeviceImageUrl(rawUri);
  const uri = attempt === 1 && rawUri ? String(rawUri) : norm;
  const failed = attempt >= 2;
  const show = !!uri && !video && !failed;
  // Explicit numeric size for the image layer (same as the working full-screen
  // viewer). An absolute-fill-only <Image> can render at 0×0 on Android.
  const [box, setBox] = useState(null);
  return (
    <TouchableOpacity activeOpacity={0.8} disabled={(!onPress && !onLongPress) || busy} onPress={() => onPress?.(uri)} onLongPress={onLongPress} delayLongPress={350} style={{ flex: 1, paddingHorizontal: 3 }}>
      <View
        style={{
          ...(square ? { aspectRatio: 1 } : { height }), minHeight: 40, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 1.5, borderStyle: show || (uri && video) ? 'solid' : 'dashed', borderColor: show || (uri && video) ? '#035C6C' : '#E4CDC2',
        }}
        onLayout={(e) => { const { width: w, height: h } = e.nativeEvent.layout; if (w > 0 && h > 0) setBox({ w, h }); }}
      >
        {busy ? (
          <ActivityIndicator color="#035C6C" />
        ) : show ? (
          <Image key={uri} source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, width: box?.w || 104, height: box?.h || height || 104 }} resizeMode="cover" resizeMethod="resize" onError={() => setAttempt((a) => (a === 0 && rawUri && String(rawUri) !== norm ? 1 : 2))} />
        ) : uri && video ? (
          <>
            <Video size={20} color="#035C6C" />
            <Text style={{ fontSize: rf(9), fontWeight: '700', color: '#035C6C', marginTop: 3 }}>Video added</Text>
          </>
        ) : (
          <>
            {video && !uri ? <Video size={18} color="#035C6C" /> : <Camera size={18} color={uri ? '#F09406' : '#035C6C'} />}
            <Text style={{ fontSize: rf(9), color: '#035C6C', marginTop: 3, textAlign: 'center' }}>{uri ? 'Preview unavailable' : 'Not added'}</Text>
          </>
        )}
      </View>
      {label ? <Text style={{ fontSize: rf(10), fontWeight: '700', color: BRAND.body, textAlign: 'center', marginTop: 4 }} numberOfLines={1}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

// "02 Nov 2026, 3:15 PM" (falls back to the raw text).
const fmtStamp = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${date}, ${h}:${m} ${ap}`;
};
const inr2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// A labelled line from the booking text the app writes ("Accessories: …").
const noteLine = (text, label) => {
  const m = new RegExp(`^${label}:\\s*(.+)$`, 'im').exec(String(text || ''));
  return m ? m[1].trim() : null;
};

// Receipt section: teal bar + title, hairline, then icon · label · value rows.
function ReceiptSection({ title, children }) {
  return (
    <View style={{ marginTop: 6, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: LINE }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: GREEN_TEXT, marginRight: 8 }} />
        <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
function ReceiptRow({ icon: Icon, label, value, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Icon size={15} color={MUTED} strokeWidth={1.75} />
      <Text style={{ width: '42%', marginLeft: 8, fontSize: rf(12.5), color: MUTED }} numberOfLines={2}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {children || <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: BRAND.ink, textAlign: 'right' }} numberOfLines={2}>{value || '-'}</Text>}
      </View>
    </View>
  );
}

// Label (left, muted) · value (right, bold, wraps) on a hairline row.
function DetailLine({ label, value, pill }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BRAND.line }}>
      <Text style={{ width: '42%', paddingRight: 10, fontSize: rf(12), lineHeight: rf(17), color: MUTED }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {pill ? (
          <Pill tone={pill}>{value || '-'}</Pill>
        ) : (
          <Text style={{ fontSize: rf(12), lineHeight: rf(17), fontWeight: '700', color: BRAND.ink, textAlign: 'right' }}>{value || '-'}</Text>
        )}
      </View>
    </View>
  );
}

// The booking text the app writes: the complaint first, then labelled lines
// ("Contact: …", "Expected delivery: …"). Split so each shows as its own row.
const NOTE_LABELS = {
  'contact': 'Contact',
  'alternative mobile': 'Alternate Number',
  'email': 'Email',
  'address': 'Address',
  'imei': 'IMEI',
  'serial number': 'Serial Number',
  'accessories': 'Accessories',
  'missing/damaged parts': 'Missing / Damaged Parts',
  'device security': 'Device Security',
  'payment': 'Payment',
  'voice note': 'Voice Note',
  'more photos': 'More Photos',
  'booking time': 'Booking Time',
  'expected delivery': 'Expected Delivery Time',
  'whatsapp updates': 'WhatsApp Updates',
};
// Shown right after Complaint Issue; Booking Time · Expected Delivery Time ·
// WhatsApp Updates follow in their own order.
const NOTE_ROWS_TOP = ['contact', 'alternative mobile', 'email', 'address', 'imei', 'serial number', 'accessories', 'missing/damaged parts', 'device security', 'payment', 'voice note', 'more photos'];
function splitBookingNotes(text) {
  const complaint = [];
  const rows = {};
  let approved = false;
  String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    if (i > 0 && /^customer approved the booking/i.test(line)) { approved = true; return; }
    const m = i > 0 ? /^([^:]{2,40}):\s*(.+)$/.exec(line) : null;
    const key = m ? m[1].trim().toLowerCase() : null;
    if (key && NOTE_LABELS[key]) rows[key] = m[2].trim();
    else complaint.push(line);
  });
  return { complaint: complaint.join('\n'), rows, approved };
}

export default function PickupDetailsScreen({ navigation, route }) {
  const { bookingId, fromOrders } = route.params || {};
  const session = useSelector(selectSession);
  const [b, setB] = useState(null);
  const [allPickupUpdates, setAllPickupUpdates] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);
  // Device Photos slot sheet: { slot: 'front'|'back'|'video', has: bool }.
  const [mediaSlot, setMediaSlot] = useState(null);
  const [mediaBusy, setMediaBusy] = useState(null); // slot being uploaded
  // Linked service ticket: technician photos live on it (as on Service View Details).
  const [ticketPhotos, setTicketPhotos] = useState([]);
  const ticketId = b?.ticketId;
  useEffect(() => {
    if (!ticketId) { setTicketPhotos([]); return undefined; }
    let alive = true;
    getServiceTicket(ticketId).then((t) => {
      if (!alive) return;
      let arr = t?.technicianPhotosJson;
      try { if (typeof arr === 'string') arr = JSON.parse(arr); } catch (_) { arr = []; }
      setTicketPhotos((Array.isArray(arr) ? arr : [])
        .map((it) => (typeof it === 'string' ? it : (it?.url || it?.uri || it?.imageUrl || null))).filter(Boolean));
    }).catch(() => {});
    return () => { alive = false; };
  }, [ticketId]);
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

  const [delivery, setDelivery] = useState(null);
  // Reload on focus, then poll, so the timeline picks up shop status updates.
  const [syncError, setSyncError] = useState(false);
  const inFlight = useRef(false);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (inFlight.current) return; // no overlapping requests
    inFlight.current = true;
    const my = ++seq.current;
    try {
      const next = await getRepairBooking(bookingId);
      let d;
      let dGone = false;
      // Delivery back to the customer (same sync, so its steps join the timeline as they happen).
      if (next?.ticketId) {
        try { d = await getRepairDeliveryForCustomer(next.ticketId); } catch (e) {
          const s = e?.response?.status ?? e?.status;
          if ([401, 403, 404].includes(s)) dGone = true; else throw e;
        }
      }
      if (my !== seq.current) return; // a newer sync already landed
      // Keep identity when unchanged so the [b] effects don't refetch per tick.
      setB((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      if (dGone || !next?.ticketId) setDelivery(null);
      else setDelivery((prev) => (JSON.stringify(prev) === JSON.stringify(d) ? prev : d || null));
      setSyncError(false);
    } catch (_) {
      // Keep the last good data; flag the failed sync.
      if (my === seq.current) setSyncError(true);
    } finally {
      inFlight.current = false;
    }
  }, [bookingId]);
  useFocusEffect(useCallback(() => {
    (async () => { await reload(); setLoading(false); })();
    // Back from the background → refresh at once.
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') reload(); });
    return () => sub.remove();
  }, [reload]));
  // Live sync with the Partner / Employee apps every 15 s while focused and foregrounded.
  useFocusPolling(reload, 15000);
  // Pull-to-refresh: booking + the delivery card.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    await reload();
    setRefreshing(false);
  }, [reload]);

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
        brand: brandName || null,
        modelNumber: String(model?.modelNumber || '').split(/[,/]/)[0].trim() || null,
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
  // Repair Details rows from the booking text. Expected delivery: the booking
  // API's own time first, then the time asked for at booking.
  const notes = splitBookingNotes(cleanIssue);
  const expectedDeliveryText = (deliveryAt || readyAt) ? fmtStamp(deliveryAt || readyAt) : (notes.rows['expected delivery'] || null);
  const approvalDone = (b.customerApproval || '').toUpperCase() === 'DONE' || meta?.customerApproved === true;
  const approvalText = approvalDone ? 'Done' : (b.customerApproval || 'Pending');
  const hasDevicePhotos = !!(b.frontImageUrl || b.backImageUrl || b.videoUrl);
  const techPhotos = b.technicianPhotos?.length ? b.technicianPhotos : ticketPhotos;
  const photoItems = [[b.frontImageUrl, 'Front Side'], [b.backImageUrl, 'Back Side']]
    .filter(([u]) => u).map(([u, label]) => ({ uri: normalizeDeviceImageUrl(u), label }));
  const openPhotos = (index) => { if (photoItems.length) setPhotoViewer({ index }); };
  const MEDIA_KEY = { front: 'frontImageUrl', back: 'backImageUrl', video: 'videoUrl' };
  // Save one slot on the booking, then reload so the screen shows what's stored.
  const saveSlot = async (slot, url) => {
    const next = await updateRepairBookingMedia(b.id, { [MEDIA_KEY[slot]]: url || '' });
    setB(next && next.id ? next : await getRepairBooking(b.id));
  };
  const pickSlot = async (slot, fromCamera) => {
    setMediaSlot(null);
    await new Promise((r) => setTimeout(r, 320)); // let the sheet close first
    const isVideo = slot === 'video';
    try {
      const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { notify('Permission needed', fromCamera ? 'Allow camera access in Settings.' : 'Allow photo library access in Settings.'); return; }
      const opts = isVideo ? { mediaTypes: 'videos', videoMaxDuration: 15, quality: 0.7 } : { mediaTypes: 'images', quality: 0.7 };
      const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const asset = !res.canceled && res.assets?.[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) { notify('File too large', 'The limit is 10 MB.'); return; }
      setMediaBusy(slot);
      const url = await uploadMedia(asset, 'repair-bookings', { slot });
      if (!url) throw new Error('Upload failed');
      await saveSlot(slot, url);
    } catch (e) {
      notify("Couldn't save media", e?.message || 'Try again');
    } finally { setMediaBusy(null); }
  };
  const viewSlot = (slot) => {
    setMediaSlot(null);
    if (slot === 'video') { Linking.openURL(b.videoUrl).catch(() => {}); return; }
    openPhotos(slot === 'back' && b.frontImageUrl ? 1 : 0);
  };
  const deleteSlot = async (slot) => {
    setMediaSlot(null);
    setMediaBusy(slot);
    try { await saveSlot(slot, ''); } catch (e) { notify("Couldn't delete", e?.message || 'Try again'); } finally { setMediaBusy(null); }
  };
  const bookingNo = b.bookingNumber
    ? (String(b.bookingNumber).startsWith('#') ? b.bookingNumber : `#${b.bookingNumber}`)
    : null;
  const centered = { width: '100%', maxWidth: 600, alignSelf: 'center' };

  const slotText = b.pickupSlotStart && b.pickupSlotEnd
    ? `${String(b.pickupSlotStart).slice(0, 5)} - ${String(b.pickupSlotEnd).slice(0, 5)}`
    : null;
  const statusText = b.status ? String(b.status).replace(/_/g, ' ') : null;

  // ── Receipt (Partner Booking Receipt): customer, device & repair, service.
  const contactLine = noteLine(b.issueSummary, 'Contact');
  const [contactName, contactMobile] = contactLine ? contactLine.split('·').map((x) => x.trim()) : [];
  const rcName = contactName || session?.fullName || addr?.fullName || null;
  const rcMobile = contactMobile || session?.mobile || addr?.mobile || null;
  const rcAlt = noteLine(b.issueSummary, 'Alternative mobile');
  const rcAddress = noteLine(b.issueSummary, 'Address')
    || [addr?.city || addr?.locality, addr?.state].filter(Boolean).join(', ') || null;
  const rcDevice = [dev.brand, dev.name || b.modelName].filter(Boolean).join(' · ') || null;
  const rcAccessories = noteLine(b.issueSummary, 'Accessories') || 'None';
  const rcBooked = noteLine(b.issueSummary, 'Booking time') || fmtStamp(b.createdAt);
  const rcEstimated = expectedDeliveryText;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#035C6C" colors={['#035C6C']} />}>
       <View style={centered}>
        {/* ONE summary card (Partner "Pickup Details" design). */}
        <View style={card}>
          {/* Device header — image only when one exists. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            {(dev.image || b.frontImageUrl) ? (
              <View style={{ width: 64, height: 76, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.line, marginRight: 11 }}>
                <Image source={{ uri: dev.image || normalizeDeviceImageUrl(b.frontImageUrl) }} style={{ width: '92%', height: '92%' }} resizeMode={dev.image ? 'contain' : 'cover'} />
              </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(15), fontWeight: '800', color: BRAND.ink }} numberOfLines={2}>{dev.name || b.modelName || 'Device'}</Text>
              {dev.specs ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 3 }} numberOfLines={2}>{dev.specs}</Text> : null}
            </View>
            {b.pickupDate ? (
              <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                <Text style={{ fontSize: rf(10.5), color: MUTED }}>Pickup on</Text>
                <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink, marginTop: 2 }}>{fmtDay(b.pickupDate)}</Text>
              </View>
            ) : null}
          </View>
          {statusText ? <Pill tone={statusTone(b.status)} style={{ alignSelf: 'flex-start', marginTop: 10 }}>{statusText}</Pill> : null}

          {/* Live Pickup Status (completed Partner updates only). */}
          {(b.pickupDate || String(b.serviceMode || '').toUpperCase() === 'PICKUP')
            && (() => { const pt = buildPickupTimeline(b); return pt.terminal || pt.rescheduled || pt.rows.some((r) => r.state === 'done'); })() ? (
              <View style={{ marginTop: 12, borderWidth: 1, borderColor: BRAND.line, borderRadius: 14, padding: 12 }}>
                <PickupHorizontalCard b={b} delivery={delivery} expanded={allPickupUpdates} onToggle={() => setAllPickupUpdates((v) => !v)} />
                {syncError ? (
                  <TouchableOpacity onPress={reload} accessibilityRole='button' style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: rf(11.5), color: '#B45309' }}>Couldn’t refresh — showing last known status. Tap to retry.</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

          {/* Price summary */}
          <RefSection icon={Banknote} tint="#F59E0B" label="PRICE SUMMARY" />
          {displayServices.length ? displayServices.map((sv, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
              <View style={{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: MINT, marginRight: 10 }}>
                <Text style={{ fontSize: rf(11), fontWeight: '800', color: GREEN_TEXT }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '600', color: BRAND.ink }} numberOfLines={1}>{sv.serviceName}</Text>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>{inr2(sv.estimatedPrice)}</Text>
            </View>
          )) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10, marginTop: 4 }}>
            <Text style={{ flex: 1, fontSize: rf(13), fontWeight: '800', color: BRAND.ink }}>Estimated Total</Text>
            <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#609138' }}>{inr2(priceTotal)}</Text>
          </View>

          {/* Complaint issue */}
          <RefSection icon={FileText} tint="#3B9BD9" label="COMPLAINT ISSUE" />
          <RefRow icon={FileText} tint="#3B9BD9" label="Issue" value={serviceNames || cleanIssue || '-'} />
          <RefRow icon={Clock} tint="#F59E0B" label="Booking Date & Time" value={rcBooked || '-'} />

          {/* Customer & pickup */}
          <RefSection icon={User} tint={GREEN_TEXT} label="CUSTOMER & PICKUP" />
          {rcName ? <RefRow icon={User} tint={GREEN_TEXT} label="Name" value={rcName} /> : null}
          {rcMobile ? <RefRow icon={Phone} tint="#3B9BD9" label="Mobile" value={rcMobile} /> : null}
          {b.pickupDate ? <RefRow icon={CalendarDays} tint="#7FA65A" label="Pickup Date" value={fmtDay(b.pickupDate)} /> : null}
          {slotText ? <RefRow icon={Clock} tint="#F59E0B" label="Pickup Slot" value={slotText} /> : null}
          {(addr || rcAddress) ? (
            <RefRow
              icon={MapPin}
              tint="#3F4A63"
              label={addr?.label ? `Address (${addr.label})` : 'Address'}
              value={addr ? [addr.addressLine, addr.locality, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : rcAddress}
            />
          ) : null}

          {/* Shop & pickup schedule — shop name + mobile, then the pickup person once assigned. */}
          {(shop || b.pickupPersonName) ? (
            <>
              <RefSection icon={Store} tint="#3F4A63" label="SHOP & PICKUP SCHEDULE" />
              {shop?.name ? <RefRow icon={Store} tint={GREEN_TEXT} label="Shop" value={shop.name} /> : null}
              {(shop?.mobile || shop?.phone) ? (
                <RefRow icon={Phone} tint="#3B9BD9" label="Shop Mobile">
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${shop.mobile || shop.phone}`).catch(() => {})} style={{ flex: 1 }}>
                    <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: GREEN_TEXT }}>{shop.mobile || shop.phone}</Text>
                  </TouchableOpacity>
                </RefRow>
              ) : null}
              {b.pickupPersonName ? <RefRow icon={User} tint="#3F4A63" label="Pickup Person" value={b.pickupPersonName} /> : null}
              {b.pickupPersonPhone ? (
                <RefRow icon={Phone} tint="#3B9BD9" label="Mobile">
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.pickupPersonPhone}`).catch(() => {})} style={{ flex: 1 }}>
                    <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: GREEN_TEXT }}>{b.pickupPersonPhone}</Text>
                  </TouchableOpacity>
                </RefRow>
              ) : null}
            </>
          ) : null}

          {/* Device photos — the booking's own Front / Back / Video (pickup-person uploads).
              Tap a photo → full-screen zoom; tap the video → player; long-press → Take Photo /
              Gallery / Record / Replace / Delete. Empty slot shows "Not added" (tap to add). */}
          {/* Whole section hidden when no Front / Back / Video was uploaded. */}
          {hasDevicePhotos ? (<>
          <RefSection icon={Camera} tint={GREEN_TEXT} label="DEVICE PHOTOS" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
            {[
              { slot: 'front', url: b.frontImageUrl, label: 'Front Side' },
              { slot: 'back', url: b.backImageUrl, label: 'Back Side' },
              { slot: 'video', url: b.videoUrl, label: 'Full Coverage Video', video: true },
            ].filter((m) => m.slot !== 'video' || m.url).map((m) => ( // video slot only when uploaded
              <View key={m.slot} style={{ width: 112 }}>
                <PhotoTile
                  height={104}
                  uri={m.url}
                  video={m.video}
                  label={m.label}
                  busy={mediaBusy === m.slot}
                  onPress={() => (m.url ? viewSlot(m.slot) : setMediaSlot({ slot: m.slot, has: false }))}
                  onLongPress={() => setMediaSlot({ slot: m.slot, has: !!m.url })}
                />
              </View>
            ))}
          </View>
          </>) : null}

          {/* Technician photos — only when uploaded. */}
          {techPhotos.length ? (
            <>
              <RefSection icon={Camera} tint={GREEN_TEXT} label="TECHNICIAN PHOTOS" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
                {techPhotos.map((uri, i) => (
                  <View key={i} style={{ width: 112, marginBottom: 6 }}>
                    <PhotoTile uri={uri} height={104} onPress={() => setPhotoViewer({ items: techPhotos.map((u, n) => ({ uri: normalizeDeviceImageUrl(u), label: `Technician Photo ${n + 1}` })), index: i })} />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <ComplianceNoteCard
            event={(b.events || []).find(
              (e) => (e?.status || '').toUpperCase() === 'TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED',
            )}
          />
        </View>
       </View>
      </ScrollView>
      <BookingSheet visible={!!mediaSlot} onClose={() => setMediaSlot(null)} maxWidth={480}>
        <Text style={{ fontSize: rf(16), fontWeight: '800', color: BRAND.ink, marginBottom: 10 }}>
          {mediaSlot?.slot === 'video' ? 'Full Coverage Video' : mediaSlot?.slot === 'back' ? 'Back Side' : 'Front Side'}
        </Text>
        {(mediaSlot?.has
          ? [
            { k: 'view', label: 'View', icon: Camera, color: '#035C6C', on: () => viewSlot(mediaSlot.slot) },
            { k: 'replace', label: 'Replace', icon: Camera, color: '#F09406', on: () => setMediaSlot({ ...mediaSlot, has: false, replace: true }) },
            { k: 'delete', label: 'Delete', icon: Camera, color: '#DC2626', on: () => deleteSlot(mediaSlot.slot) },
          ]
          : mediaSlot?.slot === 'video'
            ? [
              { k: 'rec', label: 'Record Video', icon: Video, color: '#F09406', on: () => pickSlot('video', true) },
              { k: 'gal', label: 'Choose Video from Gallery', icon: Video, color: '#035C6C', on: () => pickSlot('video', false) },
            ]
            : [
              { k: 'cam', label: 'Take Photo', icon: Camera, color: '#035C6C', on: () => pickSlot(mediaSlot?.slot, true) },
              { k: 'gal', label: 'Choose from Gallery', icon: Camera, color: '#035C6C', on: () => pickSlot(mediaSlot?.slot, false) },
            ]
        ).map((o) => (
          <TouchableOpacity key={o.k} onPress={o.on} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <View style={{ height: 34, width: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4CDC2' }}>
              <o.icon size={17} color={o.color} />
            </View>
            <Text style={{ marginLeft: 12, fontSize: rf(14), fontWeight: '700', color: o.k === 'delete' ? '#DC2626' : BRAND.ink }}>{o.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setMediaSlot(null)} activeOpacity={0.8} style={{ marginTop: 12, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: rf(14), fontWeight: '700', color: BRAND.ink }}>Cancel</Text>
        </TouchableOpacity>
      </BookingSheet>
      <ImageViewerModal visible={!!photoViewer} images={photoViewer?.items || photoItems} index={photoViewer?.index || 0} onClose={() => setPhotoViewer(null)} />
    </View>
  );
}
