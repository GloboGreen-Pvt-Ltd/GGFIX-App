import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
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
  Leaf,
} from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow } from './FlowChrome';

function Row({ icon, label, value, sub, last }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: FLOW.border }}>
      <View style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: rf(10.5), color: FLOW.muted, letterSpacing: 1.4, fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: FLOW.ink, marginTop: 2, lineHeight: rf(20) }}>{value || '-'}</Text>
        {sub ? <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 2, lineHeight: rf(18) }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const humanize = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function RepairConfirmationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { booking = {}, device = {}, shop, address, services = [] } = route.params || {};

  const deviceName = device.modelName || booking.modelName || device.brandName || booking.brandName || '-';
  const ramStorage = [device.ramLabel, device.storageLabel].filter(Boolean).join(' / ');
  const deviceSpecs = [device.brandName, device.color, ramStorage].filter(Boolean).join(' · ');
  const addressText = address
    ? [address.addressLine, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(', ')
    : '-';
  const scheduledText = `${booking.pickupDate || ''} · ${String(booking.pickupSlotStart || '').slice(0, 5)} - ${String(booking.pickupSlotEnd || '').slice(0, 5)}`;

  // ---- presentation-only values ----
  const addrRest = address ? [address.locality, address.city, address.state, address.pincode].filter(Boolean).join(', ') : '';
  const statusLabel = humanize(booking.status || 'ORDER_PLACED');
  const CONFETTI = [
    [-92, -18, '#A7F3D0', 8], [-70, -62, '#FDE68A', 6], [-40, -84, '#FFFFFF', 5], [48, -86, '#A7F3D0', 7],
    [84, -52, '#FFFFFF', 6], [96, 4, '#FDE68A', 8], [74, 58, '#A7F3D0', 5], [-86, 46, '#FFFFFF', 6],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Success hero */}
        <LinearGradient colors={['#003A31', '#004C40', '#006B57']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 64, overflow: 'hidden' }}>
          {/* soft leaf / curve shapes (decorative) */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -110, top: -90, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, left: -120, bottom: -60, backgroundColor: 'rgba(0,168,107,0.18)' }} />
            <Leaf size={120} color="rgba(255,255,255,0.07)" style={{ position: 'absolute', right: -10, bottom: 40, transform: [{ rotate: '-25deg' }] }} />
            <Leaf size={80} color="rgba(255,255,255,0.06)" style={{ position: 'absolute', left: 10, top: 120, transform: [{ rotate: '30deg' }] }} />
          </View>
          <SafeAreaView edges={['top']}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10 }}>
              <Image source={require('../../../../assets/logo.png')} style={{ width: 34, height: 34, borderRadius: 9 }} resizeMode="cover" />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: rf(16), marginLeft: 9, letterSpacing: 0.6 }}>GGFIX</Text>
            </View>
            <View style={{ alignItems: 'center', paddingTop: 18 }}>
              {/* concentric rings + white disc with check + confetti */}
              <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <View style={{ position: 'absolute', width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(255,255,255,0.10)' }} />
                <View style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.14)' }} />
                {CONFETTI.map(([x, y, c, s], i) => (
                  <View key={i} style={{ position: 'absolute', left: 75 + x, top: 75 + y, width: s, height: s, borderRadius: i % 2 ? s / 2 : 1.5, backgroundColor: c, transform: [{ rotate: `${i * 35}deg` }] }} />
                ))}
                <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
                  <Check size={38} color="#00A86B" strokeWidth={3.2} />
                </View>
              </View>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: rf(26), marginTop: 10, letterSpacing: -0.3 }}>Booking Confirmed!</Text>
              <Text style={{ color: 'rgba(236,253,245,0.88)', fontSize: rf(13.5), marginTop: 6, textAlign: 'center', paddingHorizontal: 34, lineHeight: rf(20) }}>
                Your repair pickup is scheduled. We'll keep you posted on every step.
              </Text>
              {booking.bookingNumber ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(167,243,208,0.45)' }}>
                  <BadgeCheck size={16} color="#A7F3D0" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(14), marginLeft: 8, letterSpacing: 0.6 }} selectable>#{booking.bookingNumber}</Text>
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Order details — overlaps the hero's lower edge */}
        <View style={{ paddingHorizontal: 16, marginTop: -40 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: FLOW.border, padding: 16, marginBottom: 12, shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: FLOW.deep, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Smartphone size={20} color="#fff" />
              </View>
              <Text style={{ flex: 1, fontSize: rf(17.5), fontWeight: '800', color: FLOW.ink }}>Order Details</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '52%' }}>
                <CalendarClock size={14} color={FLOW.deep} />
                <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: FLOW.deep, marginLeft: 5 }} numberOfLines={1}>{statusLabel}</Text>
              </View>
            </View>

            {/* device block */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FLOW.border }}>
              <View style={{ height: 72, width: 64, borderRadius: 14, backgroundColor: FLOW.softMint, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
                {device.imageUrl ? (
                  <Image source={{ uri: device.imageUrl }} style={{ width: 60, height: 68 }} resizeMode="contain" />
                ) : (
                  <Smartphone size={28} color={FLOW.deep} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: rf(10.5), color: FLOW.muted, letterSpacing: 1.4, fontWeight: '600' }}>DEVICE</Text>
                <Text style={{ fontSize: rf(17), fontWeight: '800', color: FLOW.ink, marginTop: 2 }} numberOfLines={2}>{deviceName}</Text>
                {deviceSpecs ? <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 2 }}>{deviceSpecs}</Text> : null}
              </View>
            </View>

            <Row icon={<Wrench size={19} color={FLOW.deep} />} label="Repair Services" value={services.map((s) => s.name).join(', ')} />
            <Row
              icon={<MapPin size={19} color={FLOW.deep} />}
              label="Pickup Address"
              value={address ? (address.addressLine || addressText) : null}
              sub={address && address.addressLine ? addrRest : null}
            />
            <Row icon={<CalendarClock size={19} color={FLOW.deep} />} label="Scheduled" value={scheduledText} last />
          </View>

          {/* Shop details */}
          <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: FLOW.border, padding: 16, marginBottom: 12, ...cardShadow }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: FLOW.deep, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Store size={20} color="#fff" />
              </View>
              <Text style={{ fontSize: rf(17.5), fontWeight: '800', color: FLOW.ink }}>Shop Details</Text>
            </View>
            <Row icon={<Store size={19} color={FLOW.deep} />} label="Shop Name" value={shop?.name} />
            <Row icon={<MapPin size={19} color={FLOW.deep} />} label="Address" value={shop?.address} />
            <Row icon={<Phone size={19} color={FLOW.deep} />} label="Phone" value={shop?.mobile || shop?.phone} last />
          </View>

          <Text style={{ fontSize: rf(12), color: FLOW.muted, textAlign: 'center', paddingHorizontal: 12, lineHeight: rf(18) }}>
            We'll send you live updates as your repair progresses through pickup, diagnosis, repair and delivery.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky actions — same handlers as before. */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: FLOW.border, paddingBottom: Math.max(insets.bottom, 12) + 8, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
        <View style={{ flexDirection: 'row' }}>
          <Pressable
            onPress={() => navigation.popToTop()}
            accessibilityRole="button"
            className="active:opacity-85"
            style={{ flex: 1, marginRight: 6, height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: FLOW.deep, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Home size={19} color={FLOW.deep} />
            <Text style={{ color: FLOW.deep, fontWeight: '800', fontSize: rf(15), marginLeft: 8 }}>Home</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.replace('RepairOrderDetails', { bookingId: booking.id })}
            accessibilityRole="button"
            className="active:opacity-90"
            style={{ flex: 1.4, marginLeft: 6, height: 56, borderRadius: 20, backgroundColor: FLOW.deep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: FLOW.deep, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
          >
            <Truck size={19} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(15), marginLeft: 8, marginRight: 4 }}>Track Order</Text>
            <ChevronRight size={19} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
