import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createAudioPlayer } from 'expo-audio';
import {
  CalendarClock,
  IndianRupee,
  FileText,
  Camera,
  ShieldCheck,
  Wrench,
  UserCog,
  PackageX,
  Play,
  Pause,
  Clock,
  CalendarDays,
  ScanLine,
  Lock,
  CheckCircle2,
} from 'lucide-react-native';
import {
  Card,
  Loader,
  Badge,
  EmptyState,
} from '../../../components/rnr';
import { getServiceTicket, getRepairBooking } from '../../../api/orders';
import ServiceHistoryCard from './ServiceHistoryCard';
import InvoiceCard from './InvoiceCard';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

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

const fmtDateTime = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const fmtMoney = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `₹${n.toLocaleString()}`;
};

// repair_status_colors per spec. Status keys here are upper-snake to match the
// values written by ticket-service + repair-bookings mirror.
const STATUS_VARIANT = {
  CREATED: 'softWarning',
  ORDER_PLACED: 'softWarning',
  PICKUP_PRESENT: 'softWarning',
  REPAIR_DEVICE_RECEIVED: 'softSecondary',
  IN_DIAGNOSIS: 'softSecondary',
  SHOP_SERVICE_ACCEPTED: 'softSuccess',
  ASSIGN_TECHNICIAN: 'softPrimary',
  TECHNICIAN_ASSIGNED: 'softPrimary',
  QUOTED: 'softPrimary',
  APPROVED: 'softSuccess',
  IN_REPAIR: 'softWarning',
  READY: 'softSuccess',
  // Billing + handover substages between READY and DELIVERED. Rendered
  // with the same warning tone the customer sees during In Repair so it's
  // clear the booking is mid-flow — only DELIVERED stays softSuccess.
  INVOICE_GENERATED: 'softWarning',
  INVOICE_READY: 'softWarning',
  DELIVERED_PROCESSING: 'softWarning',
  COMPLETED: 'softSuccess',
  DELIVERED: 'softSuccess',
  CANCELLED: 'softDanger',
};

// Palette pill for the STATUS_VARIANT tones (replaces the theme Badge colours).
const PILL_TONE = {
  softSuccess:   { bg: MINT,        fg: GREEN_TEXT },
  softWarning:   { bg: YELLOW_SOFT, fg: BRAND.ink },
  softDanger:    { bg: RED_SOFT,    fg: BRAND.red },
  softPrimary:   { bg: BRAND.line,  fg: BRAND.ink },
  softSecondary: { bg: BRAND.line,  fg: BRAND.ink },
};
function StatusPill({ variant, children }) {
  const t = PILL_TONE[variant] || PILL_TONE.softPrimary;
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: t.bg }}>
      <Text style={{ fontSize: rf(10), fontWeight: '800', letterSpacing: 0.4, color: t.fg, textTransform: 'uppercase' }}>{children}</Text>
    </View>
  );
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}

// technicianPhotosJson is always a flat URL array (employee app submits it that
// way). Items can be strings or { url } objects; normalize to a string[].
function parseTechnicianPhotos(raw) {
  const arr = parseJsonSafe(raw, []);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it) => (typeof it === 'string' ? it : (it?.url || it?.uri || it?.imageUrl || null)))
    .filter(Boolean);
}

// "Technician Issue Verified & Updated" card for the customer-side ticket
// detail. Reads from the flat compliance fields the ticket-service ships on
// the customer ticket response (complianceNote / complianceAudioUrl /
// complianceImageUrls / complianceVerifiedAt) so the customer can review
// what the technician verified without a second API call. Returns null when
// the technician hasn't submitted a customer-visible note yet.
function ComplianceNoteCard({ ticket, embedded }) {
  const noteText = ticket?.complianceNote || null;
  const audioUrl = ticket?.complianceAudioUrl || null;
  const imageUrls = Array.isArray(ticket?.complianceImageUrls) ? ticket.complianceImageUrls : [];
  const verifiedAt = ticket?.complianceVerifiedAt || null;

  const hasAudio = !!audioUrl;
  const hasImages = imageUrls.length > 0;
  const attachmentCount = (hasAudio ? 1 : 0) + imageUrls.length;

  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    try { soundRef.current?.remove?.(); } catch (_) {}
  }, []);

  // Early return must stay below the hooks so the hook count never changes.
  if (!noteText && !audioUrl && imageUrls.length === 0) return null;

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
      player.addListener('playbackStatusUpdate', (s) => { if (s?.didJustFinish) setPlaying(false); });
      player.play();
      setPlaying(true);
    } catch (_) { /* best-effort playback */ }
  };

  // Embedded inside Technician Details → plain block; otherwise its own card.
  const Wrap = embedded ? View : Card;
  const wrapProps = embedded ? { style: { marginTop: 4 } } : { className: 'rounded-2xl', style: { padding: 12, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: LINE } };

  return (
    <Wrap {...wrapProps}>
      <View className="flex-row items-center mb-3">
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
          style={{ backgroundColor: YELLOW_SOFT }}
        >
          <FileText size={14} color={BRAND.ink} />
        </View>
        <View className="flex-1">
          <Text
            className="font-extrabold tracking-widest"
            style={{ fontSize: rf(10), color: BRAND.ink, letterSpacing: 1.2 }}
          >
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

      {verifiedAt ? (
        <View
          className="flex-row items-center mt-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: BRAND.line }}
        >
          <CalendarClock size={11} color={MUTED} />
          <Text className="text-text-muted ml-1.5" style={{ fontSize: rf(10) }}>
            Verified on {fmtDateTime(verifiedAt)}
          </Text>
          {attachmentCount > 0 ? (
            <Text className="text-text-muted ml-auto" style={{ fontSize: rf(10) }}>
              {attachmentCount} {attachmentCount === 1 ? 'attachment' : 'attachments'}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Wrap>
  );
}

function PriceLine({ index, label, amount }) {
  return (
    <View className="flex-row items-center py-1.5">
      <View
        className="h-5 w-5 rounded-full items-center justify-center mr-2.5"
        style={{ backgroundColor: MINT }}
      >
        <Text className="font-extrabold" style={{ fontSize: rf(10), color: GREEN_TEXT }}>{index}</Text>
      </View>
      <Text className="text-text flex-1" style={{ fontSize: rf(12.5) }} numberOfLines={1}>{label || 'Item'}</Text>
      <Text className="font-extrabold text-text" style={{ fontSize: rf(12.5) }}>{fmtMoney(amount) || '-'}</Text>
    </View>
  );
}

// Brand-green primary used throughout the screen. Variant tints keep the
// section icons distinguishable while every "primary" emphasis (CTAs,
// money, accents) lands on the same green so the screen reads as one app.
const BRAND_GREEN = BRAND.green;
const BRAND_GREEN_DARK = GREEN_TEXT;

// Swiggy/Zomato-style section card: tinted icon chip on the left + bold
// title. Caller passes the accent (icon color); the tint is derived from
// the same hex so the chip always feels coherent with the icon.
// Partner booking-details style: icon disc + spaced caps label + rule.
const REF_SHADOW = { shadowColor: '#111111', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };
function RefSection({ icon: Icon, label }) {
  return (
    <View className="flex-row items-center pt-2 pb-2">
      <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: BRAND_GREEN_DARK }}>
        <Icon size={14} color="#FFFFFF" />
      </View>
      <Text className="text-text font-extrabold ml-2" style={{ fontSize: rf(12.5), letterSpacing: 1.6 }}>{label}</Text>
      <View className="flex-1 h-px ml-2" style={{ backgroundColor: '#E5E7EB' }} />
    </View>
  );
}
function RefRow({ icon: Icon, tint, label, value, children }) {
  return (
    <View className="flex-row items-center py-1.5">
      <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: tint }}>
        <Icon size={15} color="#FFFFFF" />
      </View>
      <Text className="text-text-muted" style={{ fontSize: rf(12), width: 104, paddingRight: 6 }}>{label}</Text>
      {children || <Text className="flex-1 text-text font-bold" style={{ fontSize: rf(13) }} numberOfLines={2}>{value}</Text>}
    </View>
  );
}

function SectionCard({ icon: Icon, color, title, children, subtitle, right }) {
  const accent = color || BRAND_GREEN;
  const tint = accent + '1A'; // 10% alpha tint for the icon-chip background
  return (
    <Card
      className="rounded-2xl"
      style={{
        padding: 12, marginBottom: 10, borderRadius: 16,
        borderWidth: 1, borderColor: LINE,
        shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 1,
      }}
    >
      <View className="flex-row items-center" style={{ marginBottom: 9 }}>
        {Icon ? (
          <View
            className="rounded-full items-center justify-center mr-2.5"
            style={{ height: 30, width: 30, backgroundColor: tint }}
          >
            <Icon size={14} color={accent} />
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="font-extrabold" style={{ fontSize: rf(13), color: BRAND.ink }} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10.5) }} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </Card>
  );
}

export default function ServiceTicketDetailsScreen({ navigation, route }) {
  const { ticketId, fromOrders, bookingId } = route.params || {};
  const [t, setT] = useState(null);
  const [booking, setBooking] = useState(null); // events for the Service History card
  const [loading, setLoading] = useState(true);

  const goHome = useCallback(() => {
    if (fromOrders && navigation.canGoBack()) navigation.goBack();
    else navigation.popToTop();
  }, [navigation, fromOrders]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Booking Details',
      headerBackAction: goHome,
    });
  }, [navigation, goHome]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const [resp, bk] = await Promise.all([
          getServiceTicket(ticketId),
          bookingId ? getRepairBooking(bookingId).catch(() => null) : Promise.resolve(null),
        ]);
        if (!cancelled) { setT(resp); setBooking(bk); }
      } catch (_) {
        if (!cancelled) setT(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // Live sync with the Partner App: re-read the booking events (and ticket)
    // every 10 s while this screen is open — new completed steps appear by themselves.
    const live = setInterval(async () => {
      const [resp, bk] = await Promise.all([
        getServiceTicket(ticketId).catch(() => null),
        bookingId ? getRepairBooking(bookingId).catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (resp) setT(resp);
      if (bk) setBooking(bk);
    }, 10000);
    return () => { cancelled = true; clearInterval(live); };
  }, [ticketId, bookingId]));

  // Pull-to-refresh: re-read ticket + booking and the delivery card.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    const [resp, bk] = await Promise.all([
      getServiceTicket(ticketId).catch(() => null),
      bookingId ? getRepairBooking(bookingId).catch(() => null) : Promise.resolve(null),
    ]);
    if (resp) setT(resp);
    if (bk) setBooking(bk);
    setRefreshing(false);
  }, [ticketId, bookingId]);

  if (loading) return <Loader label="Loading order..." />;
  if (!t) {
    return (
      <View className="flex-1" style={{ backgroundColor: BRAND.bg }}>
        <EmptyState
          accent={BRAND_GREEN}
          accentSoft={MINT}
          title="Ticket not found"
          description="We couldn't load this service order."
          actionLabel="Go home"
          onAction={goHome}
        />
      </View>
    );
  }

  const tracking = t.trackingId ? (String(t.trackingId).startsWith('#') ? t.trackingId : `#${t.trackingId}`) : null;
  // Dedupe by (repairServiceId || label) — historical bookings carried
  // duplicate rows when the pickup-person estimate re-submitted services that
  // already lived in repair_booking_services; that bled into priceItemsJson
  // via syncTicketFromBookingEdit and showed each issue twice on this card.
  const priceItems = (() => {
    const raw = parseJsonSafe(t.priceItemsJson, []);
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const it of raw) {
      const key = String(it?.repairServiceId || it?.id || it?.code || it?.label || it?.name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  })();
  const photos = parseJsonSafe(t.devicePhotosJson, {}) || {};
  const technicianPhotos = parseTechnicianPhotos(t.technicianPhotosJson);
  const missingPartsArr = parseJsonSafe(t.missingPartsJson, []) || [];
  const missingPartsLabels = (Array.isArray(missingPartsArr) ? missingPartsArr : [])
    .map((it) => (it && typeof it === 'object' ? (it.label || it.name) : String(it)))
    .filter(Boolean);
  const variant = STATUS_VARIANT[String(t.status || '').toUpperCase()] || 'softPrimary';
  const priceTotal = t.finalPrice != null ? Number(t.finalPrice)
    : t.estimatedPrice != null ? Number(t.estimatedPrice)
    : (Array.isArray(priceItems) ? priceItems : []).reduce((s, it) => {
        const a = Number(it?.amount);
        return s + (Number.isFinite(a) ? a : 0);
      }, 0);
  const approvalDone = String(t.customerApproval).toLowerCase() === 'true'
    || String(t.customerApproval).toUpperCase() === 'DONE';
  const centered = { width: '100%', maxWidth: 600, alignSelf: 'center' };

  return (
    <View className="flex-1" style={{ backgroundColor: BRAND.bg }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#035C6C" colors={['#035C6C']} />}>
        <View style={centered}>
          {/* Hero device card — left green accent bar, 72×90 thumbnail,
              tracking pill, big device name, color + status chips. The
              shadow is a hair stronger here so the hero sits visually
              above the section cards below. */}
          <Card
            className="rounded-2xl"
            style={{
              padding: 12, marginBottom: 10, borderRadius: 16,
              borderWidth: 1, borderColor: LINE,
              shadowColor: BRAND.ink, shadowOpacity: 0.06, shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 }, elevation: 2,
            }}
          >
            <View className="flex-row items-center">
              <View
                style={{ width: 3, borderRadius: 2, backgroundColor: BRAND_GREEN, marginRight: 10, alignSelf: 'stretch' }}
              />
              <View
                className="rounded-2xl overflow-hidden items-center justify-center"
                style={{ width: 60, height: 72, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.line }}
              >
                {t.deviceImageUrl ? (
                  <Image source={{ uri: t.deviceImageUrl }} style={{ width: '92%', height: '92%' }} resizeMode="contain" />
                ) : (
                  <Wrench size={30} color={BRAND_GREEN} />
                )}
              </View>
              <View className="flex-1 ml-3">
                {tracking ? (
                  <View
                    className="flex-row items-center self-start rounded-full px-2 py-0.5"
                    style={{ backgroundColor: MINT }}
                  >
                    <Text
                      className="uppercase font-extrabold"
                      style={{ fontSize: rf(9.5), letterSpacing: 1, color: BRAND_GREEN_DARK }}
                    >
                      Tracking
                    </Text>
                    <Text className="font-extrabold ml-1.5" style={{ fontSize: rf(11), color: BRAND_GREEN_DARK }}>{tracking}</Text>
                  </View>
                ) : null}
                <Text className="font-extrabold mt-1.5" style={{ fontSize: rf(14.5), color: BRAND.ink }} numberOfLines={2}>
                  {t.deviceDisplayName || 'Device'}
                </Text>
                <View className="flex-row items-center mt-2 flex-wrap">
                  {t.color ? (
                    <View
                      className="rounded-full px-2 py-0.5 mr-1.5 mb-1"
                      style={{ backgroundColor: BRAND.line }}
                    >
                      <Text className="font-bold text-text-muted" style={{ fontSize: rf(10) }}>{t.color}</Text>
                    </View>
                  ) : null}
                  <View style={{ marginBottom: 4 }}>
                    <StatusPill variant={variant}>{(t.status || '').replace(/_/g, ' ')}</StatusPill>
                  </View>
                </View>
              </View>
            </View>
          </Card>

          {/* Invoice — View / Download, before Service History. */}
          <View style={{ marginBottom: 12 }}>
            <InvoiceCard ticket={t} booking={booking} items={priceItems} total={priceTotal} navigation={navigation} />
          </View>

          {/* Service History — Pickup Status design, before Price Summary. */}
          {booking ? (
            <View style={{ marginBottom: 12 }}>
              <ServiceHistoryCard events={booking.events} status={booking.status || t.status} bookingNumber={booking.bookingNumber || t.bookingNumber} />
            </View>
          ) : null}

          {/* Price summary — Partner booking-details design. */}
          <View className="bg-card rounded-2xl p-4 mb-3" style={REF_SHADOW}>
            <RefSection icon={IndianRupee} label="PRICE SUMMARY" />
            {Array.isArray(priceItems) && priceItems.length > 0 ? (
              priceItems.map((it, i) => (
                <View key={i} className="flex-row items-center py-2" style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: MINT }}>
                  <View className="w-6 h-6 rounded-lg items-center justify-center mr-2.5" style={{ backgroundColor: MINT }}>
                    <Text className="font-extrabold" style={{ fontSize: rf(11), color: BRAND_GREEN_DARK }}>{i + 1}</Text>
                  </View>
                  <Text className="flex-1 text-text font-semibold" style={{ fontSize: rf(13) }} numberOfLines={1}>{it?.label || it?.name}</Text>
                  <Text className="font-extrabold text-text" style={{ fontSize: rf(13) }}>{fmtMoney(it?.amount) || '₹0'}</Text>
                </View>
              ))
            ) : (
              <Text className="text-text-muted" style={{ fontSize: rf(12) }}>{t.repairServicesSummary || 'No service items recorded.'}</Text>
            )}
            <View className="flex-row items-center mt-1 pt-2.5" style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <Text className="flex-1 font-extrabold text-text" style={{ fontSize: rf(13) }}>{t.finalPrice != null ? 'Final Total' : 'Estimated Total'}</Text>
              <Text className="font-extrabold" style={{ fontSize: rf(15), color: BRAND_GREEN_DARK }}>{fmtMoney(priceTotal) || '₹0'}</Text>
            </View>

            {/* Service info — same summary card (Partner design). */}
            <View style={{ marginTop: 14 }}>
              <RefSection icon={Wrench} label="SERVICE INFO" />
            </View>
            <RefRow icon={FileText} tint="#F59E0B" label="Complaint" value={t.issueDescription || '-'} />
            <RefRow icon={Clock} tint="#3B9BD9" label="Booking Date & Time" value={fmtDateTime(t.estimatedReadyAt) || '-'} />
            <RefRow icon={CalendarDays} tint="#7FA65A" label="Est. Delivery Date & Time" value={fmtDateTime(t.estimatedDeliveryAt) || '-'} />
            {t.imei ? <RefRow icon={ScanLine} tint="#3F4A63" label="IMEI" value={String(t.imei)} /> : null}
            <RefRow icon={ShieldCheck} tint={BRAND_GREEN_DARK} label="Approval">
              <View className="flex-row items-center self-start rounded-full px-3 py-1" style={{ backgroundColor: approvalDone ? MINT : YELLOW_SOFT }}>
                {approvalDone ? <CheckCircle2 size={13} color={BRAND_GREEN_DARK} /> : <Clock size={13} color={BRAND.ink} />}
                <Text className="font-extrabold ml-1" style={{ fontSize: rf(12), color: approvalDone ? BRAND_GREEN_DARK : BRAND.ink }}>{approvalDone ? 'Approved' : 'Pending'}</Text>
              </View>
            </RefRow>
            {t.deviceSecurityType && String(t.deviceSecurityType).toUpperCase() !== 'NONE' ? (
              <RefRow icon={Lock} tint="#EF4444" label="Security" value={`${String(t.deviceSecurityType).replace(/_/g, ' ')} · ••••••`} />
            ) : null}
            {missingPartsLabels.length ? (
              <RefRow icon={PackageX} tint={BRAND.red} label="Missing / Damage">
                <View className="flex-1 flex-row flex-wrap">
                  {missingPartsLabels.map((p, i) => (
                    <View key={i} className="rounded-full px-2.5 py-1 mr-1 mb-1" style={{ backgroundColor: RED_SOFT }}>
                      <Text className="font-extrabold" style={{ fontSize: rf(11), color: BRAND.red }}>{p}</Text>
                    </View>
                  ))}
                </View>
              </RefRow>
            ) : null}

            {/* Technician details — the technician's Issue Verified & Updated note; hidden until submitted. */}
            {(t.complianceNote || t.complianceAudioUrl || (Array.isArray(t.complianceImageUrls) && t.complianceImageUrls.length)) ? (
              <>
                <View style={{ marginTop: 14 }}>
                  <RefSection icon={UserCog} label="TECHNICIAN DETAILS" />
                </View>
                <ComplianceNoteCard ticket={t} embedded />
              </>
            ) : null}
          </View>

          {/* Device photos uploaded by the customer at booking time. */}
          {(photos.front || photos.back || photos.video) ? (
            <SectionCard icon={Camera} color={BRAND_GREEN} title="Device Photos" subtitle="Submitted by you">
              <View className="flex-row -mx-1">
                {/* Video tile only when a video was uploaded; tap plays it. */}
                {['front', 'back', ...(photos.video ? ['video'] : [])].map((k) => (
                  <View key={k} className="px-1" style={{ width: 120 }}>
                    <TouchableOpacity activeOpacity={0.85} disabled={k !== 'video'} onPress={() => Linking.openURL(photos.video).catch(() => {})}>
                    <View
                      className="rounded-xl items-center justify-center overflow-hidden"
                      style={{
                        height: 112,
                        backgroundColor: SOFT_MINT,
                        borderWidth: 1.5, borderStyle: 'dashed', borderColor: GREEN_LINE,
                      }}
                    >
                      {k === 'video' ? (
                        <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: BRAND_GREEN, alignItems: 'center', justifyContent: 'center' }}>
                          <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                        </View>
                      ) : photos[k] ? (
                        <Image source={{ uri: photos[k] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Camera size={20} color={BRAND_GREEN} />
                      )}
                    </View>
                    </TouchableOpacity>
                    <Text
                      className="font-extrabold text-center mt-1.5"
                      style={{ fontSize: rf(10), color: BRAND_GREEN_DARK }}
                    >
                      {k === 'front' ? 'Front' : k === 'back' ? 'Back' : 'Video'}
                    </Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}
