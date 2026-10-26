import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Wrench,
  Tag,
  ShoppingBag,
  Smartphone,
  Star,
  ShieldCheck,
  Truck,
  Sparkles,
  Headset,
} from 'lucide-react-native';
import { tokens } from '../../theme/colors';
import { rf } from '../../utils/responsive';

// Per-service visual config. The `gradient` colours are reused as the icon /
// badge accents so each tile keeps its colour anchor (green=Repair, orange=Sell,
// blue=Buy, purple=Enquiry) even in the flat white-grid layout.
const SERVICE_THEME = {
  repair: {
    title: 'Repair Service',
    badge: 'Up to 30% OFF',
    gradient: ['#004C40', '#004C40'],
    softBg: '#DCFCE7',
    accent: '#FFFFFF',
    Icon: Wrench,
  },
  sell: {
    title: 'Sell Device',
    badge: 'Instant Cash',
    gradient: ['#FF7A00', '#E56A00'],
    softBg: '#FFEDD5',
    accent: '#FFFFFF',
    Icon: Tag,
  },
  buy: {
    title: 'Buy Device',
    badge: 'Free Delivery',
    gradient: ['#2563EB', '#1D4ED8'],
    softBg: '#DBEAFE',
    accent: '#FFFFFF',
    Icon: ShoppingBag,
  },
  enquiry: {
    title: 'Service Enquiry',
    badge: 'Talk to us',
    gradient: ['#6D28D9', '#5B21B6'],
    softBg: '#EDE9FE',
    accent: '#FFFFFF',
    Icon: Headset,
  },
};

const TRUST_BADGES = [
  { key: 'rating', Icon: Star,        label: '4.7 Rated',      sub: 'by 25k+ users' },
  { key: 'sla',    Icon: ShieldCheck, label: '6 Month',        sub: 'warranty' },
  { key: 'pickup', Icon: Truck,       label: 'Free Pickup',    sub: '& delivery' },
];

export default function CategoryServiceMenuScreen({ navigation, route }) {
  const { categoryId, categoryCode, categoryName } = route.params || {};
  const deviceLabel = categoryName || 'Device';

  const options = [
    {
      key: 'repair',
      sub: `Book a repair for your ${deviceLabel.toLowerCase()}`,
      onPress: () =>
        navigation.navigate('RepairSelectDevice', { flow: 'REPAIR', categoryId, categoryCode, categoryName }),
    },
    {
      key: 'sell',
      sub: 'Get an instant quote and sell',
      onPress: () => navigation.navigate('SellSelectDevice', { flow: 'SELL', categoryId, categoryCode, categoryName }),
    },
    {
      key: 'buy',
      sub: 'Shop devices and accessories',
      onPress: () => navigation.navigate('BuyCategory', { categoryId, categoryName }),
    },
    {
      key: 'enquiry',
      sub: 'Message a shop about your device',
      onPress: () => navigation.navigate('ChatInbox'),
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Hero — soft tinted card with category name + descriptive copy.
            Matches the Swiggy "category hero" pattern at the top of a
            cuisine drill-down screen. */}
        <View className="px-4 pt-3 pb-1">
          <LinearGradient
            colors={[tokens.primarySoft, '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 16 }}
          >
            <View className="flex-row items-center">
              <View
                className="h-12 w-12 rounded-2xl items-center justify-center mr-3"
                style={{ backgroundColor: tokens.card }}
              >
                <Smartphone size={22} color={tokens.primary} />
              </View>
              <View className="flex-1">
                <Text
                  className="font-extrabold"
                  style={{ fontSize: rf(10), color: tokens.primary, letterSpacing: 1.2 }}
                >
                  CATEGORY
                </Text>
                <Text className="font-extrabold text-text mt-0.5" style={{ fontSize: rf(17) }} numberOfLines={1}>
                  {deviceLabel}
                </Text>
                <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(12) }} numberOfLines={2}>
                  What would you like to do with your {deviceLabel.toLowerCase()}?
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Section eyebrow — matches the Home feed's section header rhythm. */}
        <View className="flex-row items-center px-4 mt-5 mb-2.5">
          <Sparkles size={14} color={tokens.accent} />
          <Text className="font-extrabold text-text ml-1.5" style={{ fontSize: rf(14) }}>
            Choose a service
          </Text>
        </View>

        {/* Service tiles — clean white 2-column grid. Each tile keeps its
            colour anchor through a soft-tinted icon chip + badge pill. */}
        <View className="flex-row flex-wrap px-3">
          {options.map((o) => {
            const cfg = SERVICE_THEME[o.key];
            const Icon = cfg.Icon;
            return (
              <View key={o.key} style={{ width: '50%', padding: 6 }}>
                <Pressable
                  onPress={o.onPress}
                  className="rounded-2xl bg-card border border-border active:opacity-90"
                  style={{
                    padding: 14,
                    minHeight: 150,
                    shadowColor: '#0F172A',
                    shadowOpacity: 0.05,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <View
                    className="h-12 w-12 rounded-2xl items-center justify-center mb-3"
                    style={{ backgroundColor: cfg.softBg }}
                  >
                    <Icon size={24} color={cfg.gradient[0]} strokeWidth={2} />
                  </View>
                  <View
                    className="self-start rounded-full px-2 py-0.5 mb-1.5"
                    style={{ backgroundColor: cfg.softBg }}
                  >
                    <Text
                      className="font-extrabold"
                      style={{ fontSize: rf(9), color: cfg.gradient[1], letterSpacing: 0.5 }}
                    >
                      {cfg.badge}
                    </Text>
                  </View>
                  <Text className="font-extrabold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>
                    {cfg.title}
                  </Text>
                  <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }} numberOfLines={2}>
                    {o.sub}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Trust strip — three pill chips (rating / warranty / pickup) that
            give the screen the "thousands trust us" reassurance Zomato shows
            on restaurant details. Static copy — no nav. */}
        <View className="px-4 mt-2">
          <View
            className="flex-row rounded-2xl p-1.5"
            style={{ backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }}
          >
            {TRUST_BADGES.map((b, i) => {
              const Icon = b.Icon;
              return (
                <View
                  key={b.key}
                  className="flex-1 flex-row items-center px-2 py-2"
                  style={{
                    borderRightWidth: i < TRUST_BADGES.length - 1 ? 1 : 0,
                    borderRightColor: tokens.border,
                  }}
                >
                  <View
                    className="h-8 w-8 rounded-full items-center justify-center mr-2"
                    style={{ backgroundColor: tokens.surfaceMuted }}
                  >
                    <Icon size={14} color={tokens.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-extrabold text-text" style={{ fontSize: rf(11) }} numberOfLines={1}>
                      {b.label}
                    </Text>
                    <Text className="text-text-muted" style={{ fontSize: rf(9) }} numberOfLines={1}>
                      {b.sub}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer reassurance — matches the Swiggy footer rhythm. */}
        <View className="items-center mt-5 px-6">
          <View
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={{ backgroundColor: tokens.surfaceMuted }}
          >
            <ShieldCheck size={12} color={tokens.primary} />
            <Text className="font-bold text-text-muted ml-1.5" style={{ fontSize: rf(11) }}>
              Verified shops · Secure payments
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
