import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
} from 'lucide-react-native';
import { Button, Card, CardTitle, Badge } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';

function Row({ icon, label, value, sub }) {
  return (
    <View className="flex-row items-start py-2.5 border-b border-border">
      <View className="h-8 w-8 rounded-full bg-primary/10 items-center justify-center mr-3 mt-0.5">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-text-muted uppercase tracking-widest" style={{ fontSize: rf(11) }}>{label}</Text>
        <Text className="text-text font-bold mt-0.5" style={{ fontSize: rf(13) }}>{value || '-'}</Text>
        {sub ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

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

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#004C40' }}>
        <LinearGradient
          colors={['#004C40', '#004C40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 24, paddingBottom: 44, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, alignItems: 'center' }}
        >
          <View className="h-20 w-20 rounded-full bg-white/20 items-center justify-center mb-3">
            <View className="h-14 w-14 rounded-full bg-white items-center justify-center">
              <CheckCircle2 size={32} color="#004C40" />
            </View>
          </View>
          <Text className="text-white font-extrabold" style={{ fontSize: rf(22) }}>Booking Confirmed!</Text>
          <Text className="text-white/85 mt-1 text-center px-8" style={{ fontSize: rf(13) }}>
            Your repair pickup is scheduled. We'll keep you posted on every step.
          </Text>
          {booking.bookingNumber ? (
            <View className="bg-white/20 rounded-full px-4 py-1.5 mt-4 flex-row items-center">
              <BadgeCheck size={13} color="#fff" />
              <Text className="text-white font-bold ml-1.5" style={{ fontSize: rf(12) }}>#{booking.bookingNumber}</Text>
            </View>
          ) : null}

        </LinearGradient>
      </SafeAreaView>

      <ScrollView className="flex-1 -mt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="rounded-2xl mb-3">
          <CardTitle className="mb-1">Order Details</CardTitle>
          <Row icon={<Smartphone size={14} color="#00008B" />} label="Device" value={deviceName} sub={deviceSpecs} />
          <Row icon={<BadgeCheck size={14} color="#00008B" />} label="Repair Services" value={services.map((s) => s.name).join(', ')} />
          <Row icon={<MapPin size={14} color="#00008B" />} label="Pickup Address" value={address ? addressText : null} />
          <Row icon={<CalendarClock size={14} color="#00008B" />} label="Scheduled" value={scheduledText} />
        </Card>

        <Card className="rounded-2xl mb-3">
          <CardTitle className="mb-1">Shop</CardTitle>
          <Row icon={<Store size={14} color="#2563EB" />} label="Shop Name" value={shop?.name} />
          <Row icon={<MapPin size={14} color="#2563EB" />} label="Address" value={shop?.address} />
          <Row icon={<Phone size={14} color="#2563EB" />} label="Phone" value={shop?.mobile || shop?.phone} />
        </Card>

        <Card className="rounded-2xl mb-3">
          <View className="flex-row items-center justify-between">
            <CardTitle>Service Status</CardTitle>
            <Badge variant="softSuccess">
              {(booking.status || 'ORDER_PLACED').replace(/_/g, ' ')}
            </Badge>
          </View>
          <Text className="text-text-muted mt-1" style={{ fontSize: rf(12) }}>
            We'll send you live updates as your repair progresses through pickup, diagnosis, repair and delivery.
          </Text>
        </Card>
      </ScrollView>

      <View className="px-4 pt-3 bg-card border-t border-border" style={{ paddingBottom: Math.max(insets.bottom, 12) + 8, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
        <View className="flex-row">
          <Button
            variant="outline"
            className="flex-1 mr-2"
            onPress={() => navigation.popToTop()}
            leftIcon={<Home size={16} color="#00008B" />}
          >
            Home
          </Button>
          <Button
            className="flex-1 ml-2"
            onPress={() => navigation.replace('RepairOrderDetails', { bookingId: booking.id })}
          >
            Track Order
          </Button>
        </View>
      </View>
    </View>
  );
}

