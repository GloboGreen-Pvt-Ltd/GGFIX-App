import React from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import {
  CalendarClock,
  Smartphone,
  MapPin,
  Store,
  Phone,
  BadgeCheck,
  Home,
  Check,
  Wrench,
  Truck,
  ChevronRight,
  ClipboardCheck,
  PackageCheck,
} from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { SuccessHero, SuccessCard, StatusPill, InfoRow, SuccessActions, GREEN_TEXT, MINT, MUTED } from '../../../components/SuccessChrome';

const hashed = (n) => (n ? (String(n).startsWith('#') ? String(n) : `#${n}`) : '');
const humanize = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Compact progress strip: Confirmed ✓ → Pickup → Repair → Delivered.
const PROGRESS = [
  { icon: Check, label: 'Confirmed' },
  { icon: Truck, label: 'Pickup' },
  { icon: Wrench, label: 'Repair' },
  { icon: PackageCheck, label: 'Delivered' },
];
function ProgressStrip() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: BRAND.line }}>
      {PROGRESS.map((s, i) => {
        const Icon = s.icon;
        const done = i === 0;
        return (
          <React.Fragment key={s.label}>
            <View style={{ alignItems: 'center', width: 58 }}>
              <View style={{ height: 26, width: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? BRAND.green : MINT, borderWidth: done ? 3 : 0, borderColor: 'rgba(9,173,42,0.22)' }}>
                <Icon size={12} color={done ? '#FFFFFF' : GREEN_TEXT} strokeWidth={done ? 3 : 2.2} />
              </View>
              <Text style={{ fontSize: rf(9.5), fontWeight: '700', color: done ? GREEN_TEXT : MUTED, marginTop: 3 }} numberOfLines={1}>{s.label}</Text>
            </View>
            {i < PROGRESS.length - 1 ? (
              <View style={{ flex: 1, height: 2, borderRadius: 1, marginTop: 12, marginHorizontal: -8, backgroundColor: i === 0 ? 'rgba(9,173,42,0.45)' : '#E3E3E3' }} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function RepairConfirmationScreen({ navigation, route }) {
  const { booking = {}, device = {}, shop, address, services = [] } = route.params || {};

  const deviceName = device.modelName || booking.modelName || device.brandName || booking.brandName || '-';
  const ramStorage = [device.ramLabel, device.storageLabel].filter(Boolean).join(' / ');
  const deviceSpecs = [device.brandName, device.color, ramStorage].filter(Boolean).join(' · ');
  const addressText = address
    ? [address.addressLine, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(', ')
    : '-';
  // '-' (via InfoRow) rather than a stray ' · -' when the booking carries no slot.
  const scheduledText = booking.pickupDate
    ? `${booking.pickupDate} · ${String(booking.pickupSlotStart || '').slice(0, 5)} - ${String(booking.pickupSlotEnd || '').slice(0, 5)}`
    : null;

  // ---- presentation-only values ----
  const addrRest = address ? [address.locality, address.city, address.state, address.pincode].filter(Boolean).join(', ') : '';
  const statusLabel = humanize(booking.status || 'ORDER_PLACED');

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <SuccessHero
          title="Booking Confirmed!"
          subtitle="Your repair pickup is scheduled. We'll keep you posted on every step."
          chips={booking.bookingNumber ? [{ icon: BadgeCheck, text: hashed(booking.bookingNumber), selectable: true }] : []}
        />

        {/* Cards overlap the hero's lower edge */}
        <View style={{ paddingHorizontal: 14, marginTop: -30 }}>
          <SuccessCard raised icon={ClipboardCheck} title="Order Details" right={<StatusPill icon={CalendarClock} text={statusLabel} />}>
            <ProgressStrip />

            {/* device block */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BRAND.line }}>
              <View style={{ height: 46, width: 42, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.line, alignItems: 'center', justifyContent: 'center', marginRight: 9, overflow: 'hidden' }}>
                {device.imageUrl ? (
                  <Image source={{ uri: device.imageUrl }} style={{ width: 38, height: 42 }} resizeMode="contain" />
                ) : (
                  <Smartphone size={20} color={GREEN_TEXT} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: rf(9), color: GREEN_TEXT, letterSpacing: 1, fontWeight: '800' }}>DEVICE</Text>
                <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink, marginTop: 1 }} numberOfLines={2}>{deviceName}</Text>
                {deviceSpecs ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }} numberOfLines={1}>{deviceSpecs}</Text> : null}
              </View>
            </View>

            <InfoRow icon={Wrench} label="Repair Services" value={services.map((s) => s.name).join(', ')} />
            <InfoRow
              icon={MapPin}
              label="Pickup Address"
              value={address ? (address.addressLine || addressText) : null}
              sub={address && address.addressLine ? addrRest : null}
            />
            <InfoRow icon={CalendarClock} label="Scheduled" value={scheduledText} last />
          </SuccessCard>

          <SuccessCard icon={Store} title="Shop Details">
            <InfoRow icon={Store} label="Shop Name" value={shop?.name} />
            <InfoRow icon={MapPin} label="Address" value={shop?.address} />
            <InfoRow icon={Phone} label="Phone" value={shop?.mobile || shop?.phone} last />
          </SuccessCard>

          <Text style={{ fontSize: rf(11), color: MUTED, textAlign: 'center', paddingHorizontal: 12, lineHeight: rf(16) }}>
            We'll send you live updates as your repair progresses through pickup, diagnosis, repair and delivery.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky actions — same handlers as before. */}
      <SuccessActions
        secondary={{ label: 'Home', icon: Home, onPress: () => navigation.popToTop() }}
        primary={{ label: 'Track Order', icon: Truck, trailing: ChevronRight, onPress: () => navigation.replace('RepairOrderDetails', { bookingId: booking.id }) }}
      />
    </View>
  );
}
