import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import {
  ChevronLeft,
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
  if (!noteText && !audioUrl && imageUrls.length === 0) return null;

  const hasAudio = !!audioUrl;
  const hasImages = imageUrls.length > 0;
  const attachmentCount = (hasAudio ? 1 : 0) + imageUrls.length;

  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    try { soundRef.current?.unloadAsync?.(); } catch (_) {}
  }, []);

  const togglePlay = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => { if (s?.didJustFinish) setPlaying(false); });
      await sound.playAsync();
      setPlaying(true);
    } catch (_) { /* best-effort playback */ }
  };

  return (
    <Card className="rounded-2xl mb-3">
      <View className="flex-row items-center mb-3">
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
          style={{ backgroundColor: '#FEF3C7' }}
        >
          <FileText size={14} color="#B45309" />
        </View>
        <View className="flex-1">
          <Text
            className="font-extrabold tracking-widest"
            style={{ fontSize: rf(10), color: '#B45309', letterSpacing: 1.2 }}
          >
            ISSUE VERIFIED & UPDATED
          </Text>
          <Text className="font-extrabold text-text mt-0.5" style={{ fontSize: rf(13) }}>
            By your technician
          </Text>
        </View>
        <View
          className="flex-row items-center rounded-full px-2 py-0.5"
          style={{ backgroundColor: '#DCFCE7' }}
        >
          <ShieldCheck size={11} color="#004C40" />
          <Text className="font-extrabold ml-1" style={{ fontSize: rf(9), color: '#004C40' }}>VERIFIED</Text>
        </View>
      </View>

      <View className="flex-row">
        <View
          style={{ width: 3, borderRadius: 2, backgroundColor: '#F59E0B', marginRight: 12, alignSelf: 'stretch' }}
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
              style={{ backgroundColor: playing ? '#FEF3C7' : '#FFFBEB', borderWidth: 1, borderColor: '#F59E0B' }}
            >
              {playing
                ? <Pause size={13} color="#B45309" />
                : <Play size={13} color="#B45309" />}
              <Text className="font-extrabold ml-1.5" style={{ fontSize: rf(11), color: '#B45309' }}>
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
                        backgroundColor: '#F1F5F9',
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
          style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
        >
          <CalendarClock size={11} color="#94A3B8" />
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
        style={{ backgroundColor: '#DCFCE7' }}
      >
        <Text className="font-extrabold" style={{ fontSize: rf(10), color: '#004C40' }}>{index}</Text>
      </View>
      <Text className="text-text flex-1" style={{ fontSize: rf(12.5) }} numberOfLines={1}>{label || 'Item'}</Text>
      <Text className="font-extrabold text-text" style={{ fontSize: rf(12.5) }}>{fmtMoney(amount) || '-'}</Text>
    </View>
  );
}

// Brand-green primary used throughout the screen. Variant tints keep the
// section icons distinguishable while every "primary" emphasis (CTAs,
// money, accents) lands on the same green so the screen reads as one app.
const BRAND_GREEN = '#004C40';
const BRAND_GREEN_DARK = '#004C40';

// Swiggy/Zomato-style section card: tinted icon chip on the left + bold
// title. Caller passes the accent (icon color); the tint is derived from
// the same hex so the chip always feels coherent with the icon.
function SectionCard({ icon: Icon, color, title, children, subtitle, right }) {
  const accent = color || BRAND_GREEN;
  const tint = accent + '1A'; // 10% alpha tint for the icon-chip background
  return (
    <Card
      className="rounded-2xl mb-3"
      style={{
        borderWidth: 1, borderColor: '#EEF2F7',
        shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 }, elevation: 2,
      }}
    >
      <View className="flex-row items-center mb-3">
        {Icon ? (
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-2.5"
            style={{ backgroundColor: tint }}
          >
            <Icon size={15} color={accent} />
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="font-extrabold text-text" style={{ fontSize: rf(13.5) }} numberOfLines={1}>{title}</Text>
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
      headerLeft: () => (
        <Pressable
          onPress={goHome}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => ({ marginLeft: 8, padding: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <View
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: '#F1F5F9',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={18} color="#0F172A" />
          </View>
        </Pressable>
      ),
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
      <View className="flex-1 bg-background">
        <EmptyState
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
    <View className="flex-1" style={{ backgroundColor: '#F5F7FB' }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={centered}>
          {/* Hero device card — left green accent bar, 72×90 thumbnail,
              tracking pill, big device name, color + status chips. The
              shadow is a hair stronger here so the hero sits visually
              above the section cards below. */}
          <Card
            className="rounded-2xl mb-3"
            style={{
              borderWidth: 1, borderColor: '#E2E8F0',
              shadowColor: '#0F172A', shadowOpacity: 0.10, shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 }, elevation: 4,
            }}
          >
            <View className="flex-row items-center">
              <View
                style={{ width: 4, borderRadius: 2, backgroundColor: BRAND_GREEN, marginRight: 12, alignSelf: 'stretch' }}
              />
              <View
                className="rounded-2xl overflow-hidden items-center justify-center"
                style={{ width: 76, height: 96, backgroundColor: '#F0FDF4' }}
              >
                {t.deviceImageUrl ? (
                  <Image source={{ uri: t.deviceImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <Wrench size={30} color={BRAND_GREEN} />
                )}
              </View>
              <View className="flex-1 ml-3">
                {tracking ? (
                  <View
                    className="flex-row items-center self-start rounded-full px-2 py-0.5"
                    style={{ backgroundColor: '#DCFCE7' }}
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
                <Text className="font-extrabold text-text mt-1.5" style={{ fontSize: rf(15.5) }} numberOfLines={2}>
                  {t.deviceDisplayName || 'Device'}
                </Text>
                <View className="flex-row items-center mt-2 flex-wrap">
                  {t.color ? (
                    <View
                      className="rounded-full px-2 py-0.5 mr-1.5 mb-1"
                      style={{ backgroundColor: '#F1F5F9' }}
                    >
                      <Text className="font-bold text-text-muted" style={{ fontSize: rf(10) }}>{t.color}</Text>
                    </View>
                  ) : null}
                  <View style={{ marginBottom: 4 }}>
                    <Badge variant={variant}>{(t.status || '').replace(/_/g, ' ')}</Badge>
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
              style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0' }}
            >
              <Text className="font-extrabold text-text" style={{ fontSize: rf(13) }}>
                {t.finalPrice != null ? 'Final Amount' : 'Estimated Amount'}
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: '#DCFCE7' }}
              >
                <Text className="font-extrabold" style={{ fontSize: rf(14), color: BRAND_GREEN_DARK }}>
                  {fmtMoney(priceTotal) || '-'}
                </Text>
              </View>
            </View>
          </SectionCard>

          {/* Complaint */}
          <SectionCard icon={FileText} color="#3B82F6" title="Complaint Issue">
            <Text className="text-text leading-5" style={{ fontSize: rf(12.5) }}>{t.issueDescription || '-'}</Text>
          </SectionCard>

          {/* Schedule */}
          <SectionCard icon={CalendarClock} color="#F59E0B" title="Service Schedule">
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
                style={{ backgroundColor: approvalDone ? '#DCFCE7' : '#FEF3C7' }}
              >
                <Text
                  className="font-extrabold"
                  style={{ fontSize: rf(10.5), color: approvalDone ? BRAND_GREEN_DARK : '#B45309' }}
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
                        height: 100,
                        backgroundColor: '#F0FDF4',
                        borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#7FB8AE',
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
                  style={{ backgroundColor: '#DCFCE7' }}
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
          <SectionCard icon={PackageX} color="#DC2626" title="Missing / Damage Parts">
            {missingPartsLabels.length ? (
              <View className="flex-row flex-wrap -mx-0.5">
                {missingPartsLabels.map((p, i) => (
                  <View
                    key={i}
                    className="rounded-full px-2.5 py-1 mr-1 mb-1"
                    style={{ backgroundColor: '#FEE2E2' }}
                  >
                    <Text className="font-extrabold" style={{ fontSize: rf(11), color: '#B91C1C' }}>{p}</Text>
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
                            backgroundColor: '#F0FDF4',
                            borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#7FB8AE',
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
                        backgroundColor: '#F0FDF4',
                        borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#7FB8AE',
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
