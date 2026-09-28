import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Smartphone, MapPin, Store, Calendar, Wrench, ShieldCheck, Tag, Truck, Phone, Camera, Video, ChevronRight, User, Home } from 'lucide-react-native';
import { notify } from '../../../components/confirm';
import {
  Card,
  CardTitle,
  Loader,
  BottomActionBar,
  PriceRow,
  PriceDivider,
  Badge,
  useBottomBarInset,
} from '../../../components/rnr';
import { createRepairBooking } from '../../../api/orders';
import { listAddresses } from '../../../api/customer';
import { getShop } from '../../../api/shops';
import { uploadMedia } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';

function formatTime(t) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

export default function RepairCompleteOrderScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const p = route.params || {};
  useHideStackHeader(navigation);
  const [shop, setShop] = useState(null);
  const [addr, setAddr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const book = async () => {
    setSaving(true);
    try {
      const m = p.media || {};
      // 'repair-bookings' routes these to S3 under media.ggfix.in/Devicefiles/;
      // the slot becomes the filename stem (front-…, back-…, video-…).
      const [frontImageUrl, backImageUrl, videoUrl] = await Promise.all([
        m.front?.uri ? uploadMedia(m.front, 'repair-bookings', { slot: 'front' }).catch(() => null) : null,
        m.back?.uri  ? uploadMedia(m.back,  'repair-bookings', { slot: 'back'  }).catch(() => null) : null,
        m.video?.uri ? uploadMedia(m.video, 'repair-bookings', { slot: 'video' }).catch(() => null) : null,
      ]);
      // A custom "Other" issue has no real repairServiceId (its id is 'OTHER'),
      // so it must NOT go into the backend services[] rows. It's folded into the
      // free-text issueSummary instead; predefined issues become service rows.
      const allSvcs = p.services || [];
      const realSvcs = allSvcs.filter((s) => !s.custom);
      const customSvcs = allSvcs.filter((s) => s.custom);
      const payload = {
        shopId: p.shopId,
        brandId: p.device?.brandId,
        modelId: p.device?.modelId,
        ramOptionId: p.device?.ramOptionId,
        storageOptionId: p.device?.storageOptionId,
        color: p.device?.color,
        serviceMode: 'PICKUP',
        issueSummary: [
          realSvcs.map((s) => s.name).join(', '),
          ...customSvcs.map((s) => `Other${s.categoryName ? ` (${s.categoryName})` : ''}: ${s.name}`),
          p.device?.dead ? "Device reported dead / won't power on" : null,
        ].filter(Boolean).join(' · '),
        services: realSvcs.map((s) => ({ repairServiceId: s.id, serviceCode: s.code, serviceName: s.name })),
        pickupAddressId: p.addressId,
        pickupDate: p.pickupDate,
        pickupSlotStart: p.pickupSlotStart,
        pickupSlotEnd: p.pickupSlotEnd,
        frontImageUrl,
        backImageUrl,
        videoUrl,
      };
      const created = await createRepairBooking(payload);
      navigation.replace('RepairConfirmation', { booking: created, device: p.device, shop, address: addr, services: p.services });
    } catch (e) {
      notify('Error', e.message);
    } finally { setSaving(false); }
  };

  if (loading) return <Loader label="Preparing your booking..." />;

  const dev = p.device || {};
  const services = p.services || [];
  const servicesTotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const pickupFee = 0;
  const discount = Math.floor(servicesTotal * 0.15);
  const total = Math.max(servicesTotal + pickupFee - discount, 0);

  // ---- presentation helpers (visual only) ----
  const CardShell = ({ children, style }) => (
    <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, padding: 14, marginBottom: 12, ...cardShadow, ...style }}>
      {children}
    </View>
  );
  const Tile = ({ Icon, tint = FLOW.mint, color = FLOW.deep, size = 46, fill }) => (
    <View style={{ height: size, width: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
      <Icon size={Math.round(size * 0.46)} color={color} fill={fill || 'transparent'} />
    </View>
  );
  // Decorative chevron (these summary cards had no tap action before).
  const Chev = () => (
    <View pointerEvents="none" style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: FLOW.softMint, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
      <ChevronRight size={18} color={FLOW.ink} />
    </View>
  );
  const Line = ({ Icon, children, bold }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
      <Icon size={18} color={FLOW.muted} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, marginLeft: 10, fontSize: rf(13.5), lineHeight: rf(19), color: bold ? FLOW.ink : '#334155', fontWeight: bold ? '700' : '400' }}>{children}</Text>
    </View>
  );
  const addrRest = addr ? [addr.locality, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : '';
  const media = p.media || {};
  const photoSlots = [
    { key: 'front', label: 'Front', asset: media.front },
    { key: 'back', label: 'Back', asset: media.back },
    ...(media.video?.uri ? [{ key: 'video', label: 'Video', asset: media.video, isVideo: true }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <FlowDecor />
      <FlowHeader title="Complete Order" navigation={navigation} backStyle="white" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bottomSpace }}>
        {/* Your device */}
        <CardShell style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ height: 76, width: 76, borderRadius: 18, backgroundColor: FLOW.softMint, alignItems: 'center', justifyContent: 'center', marginRight: 14, overflow: 'hidden' }}>
            {dev.imageUrl ? (
              <Image source={{ uri: dev.imageUrl }} style={{ width: 70, height: 70 }} resizeMode="contain" />
            ) : (
              <Smartphone size={30} color={FLOW.deep} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(10.5), color: FLOW.muted, letterSpacing: 1.6, fontWeight: '600' }}>YOUR DEVICE</Text>
            <Text style={{ fontSize: rf(19), fontWeight: '800', color: FLOW.ink, marginTop: 2 }} numberOfLines={2}>{dev.modelName || 'Device'}</Text>
            {dev.color ? <Text style={{ fontSize: rf(13), color: FLOW.muted, marginTop: 3 }}>Color: {dev.color}</Text> : null}
          </View>
          <Chev />
        </CardShell>

        {/* Repair services */}
        <CardShell>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tile Icon={Wrench} />
            <Text style={{ flex: 1, fontSize: rf(17), fontWeight: '800', color: FLOW.ink }}>Repair Services</Text>
            <Chev />
          </View>
          <View style={{ paddingLeft: 58, marginTop: 2 }}>
            {services.map((s, idx) => (
              <View key={s.id || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: FLOW.deep, marginRight: 10 }} />
                <Text style={{ flex: 1, fontSize: rf(14), color: FLOW.ink }} numberOfLines={2}>{s.name}</Text>
                {s.price != null ? (
                  <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: FLOW.ink, marginLeft: 8 }}>₹{s.price}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </CardShell>

        {/* Device photos — the captured images from Review (display only). */}
        <CardShell>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tile Icon={Camera} fill={FLOW.deep} color="#fff" />
            <Text style={{ flex: 1, fontSize: rf(17), fontWeight: '800', color: FLOW.ink }}>Device Photos</Text>
            <Chev />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 12, marginHorizontal: -4 }}>
            {photoSlots.map((m) => (
              <View key={m.key} style={{ flex: 1, maxWidth: '50%', paddingHorizontal: 4 }}>
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: FLOW.border, backgroundColor: FLOW.tint, padding: 4 }}>
                  <View style={{ height: 92, borderRadius: 13, overflow: 'hidden', backgroundColor: '#1C2A2A', alignItems: 'center', justifyContent: 'center' }}>
                    {m.asset?.uri && !m.isVideo ? (
                      <Image source={{ uri: m.asset.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <>
                        <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)' }} />
                        {m.isVideo ? <Video size={24} color="#fff" /> : <Camera size={24} color="rgba(255,255,255,0.85)" />}
                      </>
                    )}
                  </View>
                  <Text style={{ fontSize: rf(12.5), color: '#334155', textAlign: 'center', marginTop: 6, marginBottom: 2 }}>{m.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </CardShell>

        {/* Pickup address */}
        <CardShell>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tile Icon={MapPin} fill={FLOW.deep} color="#fff" />
            <Text style={{ flex: 1, fontSize: rf(17), fontWeight: '800', color: FLOW.ink }}>Pickup Address</Text>
            <Chev />
          </View>
          <View style={{ paddingLeft: 58 }}>
            {addr ? (
              <>
                <Line Icon={User} bold>{addr.fullName} · {addr.mobile}</Line>
                {addr.addressLine ? <Line Icon={Home}>{addr.addressLine}</Line> : null}
                {addrRest ? <Line Icon={MapPin}>{addrRest}</Line> : null}
              </>
            ) : (
              <Text style={{ fontSize: rf(13), color: FLOW.muted, marginTop: 6 }}>No address selected</Text>
            )}
          </View>
        </CardShell>

        {/* Shop & schedule */}
        <CardShell>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tile Icon={Store} />
            <Text style={{ flex: 1, fontSize: rf(17), fontWeight: '800', color: FLOW.ink }}>Shop & Schedule</Text>
            <Chev />
          </View>
          <View style={{ backgroundColor: FLOW.tint, borderWidth: 1, borderColor: '#DDF0E9', borderRadius: 18, padding: 12, marginTop: 12 }}>
            {shop ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Store size={18} color={FLOW.deep} />
                  <Text style={{ flex: 1, marginLeft: 10, fontSize: rf(14.5), fontWeight: '800', color: FLOW.ink }} numberOfLines={2}>{shop.name}</Text>
                </View>
                {shop.address ? <Line Icon={MapPin}>{shop.address}</Line> : null}
                {(shop.mobile || shop.phone) ? <Line Icon={Phone}>{shop.mobile || shop.phone}</Line> : null}
                <View style={{ height: 1, backgroundColor: '#D9EDE5', marginTop: 12, marginBottom: 10 }} />
              </>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F6EF', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
              <Calendar size={20} color={FLOW.deep} />
              <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: rf(11.5), color: FLOW.muted }}>Scheduled Date & Time</Text>
                <Text style={{ fontSize: rf(15), fontWeight: '800', color: FLOW.ink, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {p.pickupDate} · {formatTime(p.pickupSlotStart)} - {formatTime(p.pickupSlotEnd)}
                </Text>
              </View>
            </View>
          </View>
        </CardShell>

        {/* Payment summary (kept from the existing screen, restyled) */}
        <CardShell>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Tile Icon={Tag} tint="#FEF0D6" color="#D97706" />
            <Text style={{ flex: 1, fontSize: rf(17), fontWeight: '800', color: FLOW.ink }}>Payment Summary</Text>
          </View>
          <PriceRow label="Service charges" value={`₹${servicesTotal}`} />
          <PriceRow label="Pickup & drop" value={pickupFee ? `₹${pickupFee}` : 'FREE'} valueClassName={pickupFee ? '' : 'text-success font-extrabold'} />
          <PriceRow label="Coupon FIRSTFIX (15%)" value={`-₹${discount}`} valueClassName="text-success font-bold" />
          <PriceDivider />
          <PriceRow label="Total payable" value={`₹${total}`} bold />
          <View style={{ backgroundColor: FLOW.softMint, borderRadius: 14, marginTop: 8, padding: 10, flexDirection: 'row', alignItems: 'center' }}>
            <ShieldCheck size={16} color={FLOW.deep} />
            <Text style={{ fontSize: rf(12), fontWeight: '700', color: FLOW.deep, marginLeft: 8 }}>30-day repair warranty included</Text>
          </View>
        </CardShell>

        <View style={{ backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#FBD89A', borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Truck size={18} color="#D97706" />
          <Text style={{ flex: 1, fontSize: rf(12), color: FLOW.ink, marginLeft: 10 }}>
            Pay on pickup, after diagnosis, or after repair - your choice.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky total + Confirm Booking — same total, book() and saving loader. */}
      <BottomActionBar>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ minWidth: 88, paddingRight: 12 }}>
            <Text style={{ fontSize: rf(12), color: FLOW.muted }}>Total</Text>
            <Text style={{ fontSize: rf(22), fontWeight: '900', color: FLOW.ink, lineHeight: rf(27) }} numberOfLines={1} adjustsFontSizeToFit>{`₹${total}`}</Text>
            <Text style={{ fontSize: rf(11.5), color: FLOW.muted }}>incl. all charges</Text>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: FLOW.border, marginRight: 14 }} />
          <View style={{ flex: 1 }}>
            <FlowCta title="Confirm Booking" onPress={book} loading={saving} />
          </View>
        </View>
      </BottomActionBar>
    </View>
  );
}
