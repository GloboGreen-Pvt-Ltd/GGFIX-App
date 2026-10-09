import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
} from 'lucide-react-native';
import {
  Card,
  Loader,
  Badge,
  EmptyState,
} from '../../../components/rnr';
import { getServiceTicket } from '../../../api/orders';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

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
function ComplianceNoteCard({ ticket }) {
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

  return (
    <Card className="rounded-2xl" style={{ padding: 12, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: LINE }}>
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
    </Card>
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
  const { ticketId, fromOrders } = route.params || {};
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);

  const goHome = useCallback(() => {
    if (fromOrders && navigation.canGoBack()) navigation.goBack();
    else navigation.popToTop();
  }, [navigation, fromOrders]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'View Details',
      headerBackAction: goHome,
    });
  }, [navigation, goHome]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await getServiceTicket(ticketId);
        if (!cancelled) setT(resp);
      } catch (_) {
        if (!cancelled) setT(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ticketId]));

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
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
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

          {/* Price summary — green icon, green primary money. Final amount
              gets the brand-green emphasis Swiggy-style ("Pay" CTAs). */}
          <SectionCard icon={IndianRupee} color={BRAND_GREEN} title="Price Summary">
            {Array.isArray(priceItems) && priceItems.length > 0 ? (
              priceItems.map((it, i) => (
                <PriceLine key={i} index={i + 1} label={it?.label || it?.name} amount={it?.amount} />
              ))
            ) : (
              <Text className="text-text-muted" style={{ fontSize: rf(12) }}>
                {t.repairServicesSummary || 'No itemised pricing'}
              </Text>
            )}
            <View
              className="flex-row items-center justify-between mt-3 pt-3"
              style={{ borderTopWidth: 1, borderTopColor: LINE }}
            >
              <Text className="font-extrabold text-text" style={{ fontSize: rf(13) }}>
                {t.finalPrice != null ? 'Final Amount' : 'Estimated Amount'}
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: MINT }}
              >
                <Text className="font-extrabold" style={{ fontSize: rf(14), color: BRAND_GREEN_DARK }}>
                  {fmtMoney(priceTotal) || '-'}
                </Text>
              </View>
            </View>
          </SectionCard>

          {/* Complaint */}
          <SectionCard icon={FileText} color={BRAND.ink} title="Complaint Issue">
            <Text className="text-text leading-5" style={{ fontSize: rf(12.5) }}>{t.issueDescription || '-'}</Text>
          </SectionCard>

          {/* Schedule */}
          <SectionCard icon={CalendarClock} color={BRAND.yellow} title="Service Schedule">
            <View className="flex-row py-1.5">
              <Text className="text-text-muted" style={{ fontSize: rf(11), width: 96 }}>Approx. Ready</Text>
              <Text className="font-bold text-text flex-1" style={{ fontSize: rf(12) }}>{fmtDateTime(t.estimatedReadyAt)}</Text>
            </View>
            <View className="flex-row py-1.5">
              <Text className="text-text-muted" style={{ fontSize: rf(11), width: 96 }}>Delivery</Text>
              <Text className="font-bold text-text flex-1" style={{ fontSize: rf(12) }}>{fmtDateTime(t.estimatedDeliveryAt)}</Text>
            </View>
            <View className="flex-row items-center py-1.5">
              <Text className="text-text-muted" style={{ fontSize: rf(11), width: 96 }}>Approval</Text>
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: approvalDone ? MINT : YELLOW_SOFT }}
              >
                <Text
                  className="font-extrabold"
                  style={{ fontSize: rf(10.5), color: approvalDone ? BRAND_GREEN_DARK : BRAND.ink }}
                >
                  {approvalDone ? 'DONE' : 'PENDING'}
                </Text>
              </View>
            </View>
          </SectionCard>

          {/* Device photos uploaded by the customer at booking time. */}
          {(photos.front || photos.back || photos.video) ? (
            <SectionCard icon={Camera} color={BRAND_GREEN} title="Device Photos" subtitle="Submitted by you">
              <View className="flex-row -mx-1">
                {['front', 'back', 'video'].map((k) => (
                  <View key={k} className="flex-1 px-1">
                    <View
                      className="rounded-xl items-center justify-center overflow-hidden"
                      style={{
                        height: 84,
                        backgroundColor: SOFT_MINT,
                        borderWidth: 1.5, borderStyle: 'dashed', borderColor: GREEN_LINE,
                      }}
                    >
                      {photos[k] ? (
                        <Image source={{ uri: photos[k] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Camera size={20} color={BRAND_GREEN} />
                      )}
                    </View>
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

          {/* Security type — value masked on backend for customer reads */}
          <SectionCard icon={ShieldCheck} color={BRAND_GREEN} title="Device Security">
            {t.deviceSecurityType && t.deviceSecurityType !== 'NONE' ? (
              <View className="flex-row items-center">
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: MINT }}
                >
                  <Text className="font-extrabold" style={{ fontSize: rf(11), color: BRAND_GREEN_DARK }}>
                    {t.deviceSecurityType}
                  </Text>
                </View>
                <Text className="text-text-muted ml-2" style={{ fontSize: rf(12) }}>••••••  set</Text>
              </View>
            ) : (
              <Text className="text-text-muted" style={{ fontSize: rf(12) }}>Not set</Text>
            )}
          </SectionCard>

          {/* Missing parts */}
          <SectionCard icon={PackageX} color={BRAND.red} title="Missing / Damage Parts">
            {missingPartsLabels.length ? (
              <View className="flex-row flex-wrap -mx-0.5">
                {missingPartsLabels.map((p, i) => (
                  <View
                    key={i}
                    className="rounded-full px-2.5 py-1 mr-1 mb-1"
                    style={{ backgroundColor: RED_SOFT }}
                  >
                    <Text className="font-extrabold" style={{ fontSize: rf(11), color: BRAND.red }}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-text-muted" style={{ fontSize: rf(12) }}>Nil</Text>
            )}
          </SectionCard>

          {/* Technician — assigned to the booking. Empty when none yet. */}
          {t.assignedTechnicianName ? (
            <SectionCard
              icon={UserCog}
              color={BRAND_GREEN}
              title={t.assignedTechnicianName}
              subtitle={t.assignedTechnicianCode ? `Technician · ${t.assignedTechnicianCode}` : 'Technician'}
            >
              {technicianPhotos.length > 0 ? (
                <>
                  <Text
                    className="font-extrabold uppercase mb-1.5"
                    style={{ fontSize: rf(10), color: BRAND_GREEN_DARK, letterSpacing: 0.8 }}
                  >
                    Photos of your device
                  </Text>
                  <View className="flex-row -mx-1">
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={{ width: '33.333%' }} className="p-1">
                        <View
                          className="rounded-xl items-center justify-center overflow-hidden"
                          style={{
                            aspectRatio: 1,
                            backgroundColor: SOFT_MINT,
                            borderWidth: 1.5, borderStyle: 'dashed', borderColor: GREEN_LINE,
                          }}
                        >
                          {technicianPhotos[i] ? (
                            <Image source={{ uri: technicianPhotos[i] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          ) : (
                            <View className="items-center px-2">
                              <Camera size={18} color={BRAND_GREEN} />
                              <Text className="text-text-muted text-center mt-1" style={{ fontSize: rf(9) }}>Awaiting photo</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text className="text-text-muted italic" style={{ fontSize: rf(11) }}>No photos uploaded yet.</Text>
              )}
            </SectionCard>
          ) : technicianPhotos.length > 0 ? (
            <SectionCard icon={Camera} color={BRAND_GREEN} title="Technician Photos">
              <View className="flex-row -mx-1">
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ width: '33.333%' }} className="p-1">
                    <View
                      className="rounded-xl items-center justify-center overflow-hidden"
                      style={{
                        aspectRatio: 1,
                        backgroundColor: SOFT_MINT,
                        borderWidth: 1.5, borderStyle: 'dashed', borderColor: GREEN_LINE,
                      }}
                    >
                      {technicianPhotos[i] ? (
                        <Image source={{ uri: technicianPhotos[i] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Camera size={18} color={BRAND_GREEN} />
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </SectionCard>
          ) : null}

          {/* Technician Issue Verified & Updated — populated from the
              latest customer-visible repair_notes row by ticket-service.
              Renders nothing when no compliance note exists yet. */}
          <ComplianceNoteCard ticket={t} />
        </View>
      </ScrollView>
    </View>
  );
}
