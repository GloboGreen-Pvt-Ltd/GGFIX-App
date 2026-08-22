import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import {
  MessageCircle, Truck, Store, Clock, IndianRupee,
  Phone, Check, Smartphone,
} from 'lucide-react-native';
import { BottomActionBar, useBottomBarInset } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';

const MAX_W = 560;

const OPTIONS = [
  {
    key: 'PICKUP',
    target: 'RepairPickupShops',
    title: 'Doorstep Pickup',
    tagline: 'Most popular',
    description: 'Free pickup & drop. Pick a nearby shop and a slot — we handle the rest.',
    accent: '#00008B',
    bg: 'bg-primary/10',
    priceClass: 'text-primary',
    icon: Truck,
    badge: 'POPULAR',
    highlights: [
      { icon: Truck, label: 'Free pickup' },
      { icon: Clock, label: 'Same-day' },
    ],
    eta: 'Pickup in 30 min',
    price: null,
  },
  {
    key: 'ENQUIRY',
    target: 'ShopChat',
    targetParams: { mode: 'ENQUIRY' },
    title: 'Service Enquiry',
    tagline: 'Talk first, book later',
    description: 'Chat with shop technicians to clarify the issue & get a quote before booking.',
    accent: '#004C40',
    bg: 'bg-success/10',
    priceClass: 'text-success',
    icon: MessageCircle,
    badge: 'FREE',
    highlights: [
      { icon: MessageCircle, label: 'Live chat' },
      { icon: Phone, label: 'Call back' },
      { icon: IndianRupee, label: 'No obligation' },
    ],
    eta: 'Replies in ~10 min',
    price: null,
  },
];

export default function RepairServiceOptionsScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const params = route.params || {};
  const device = params.device || {};
  // Mobile condition set on the "Your Device" step (REPAIR flow). A dead device
  // has no RAM/Storage, so the specs line naturally collapses to just the colour.
  const isDead = (device.workingCondition || (device.dead ? 'DEAD' : 'WORKING')) === 'DEAD';
  const deviceSpecs = [device.color, device.ramLabel, device.storageLabel].filter(Boolean).join(' · ');
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };
  const [selected, setSelected] = useState('PICKUP');

  const onContinue = () => {
    const opt = OPTIONS.find((o) => o.key === selected);
    if (!opt) return;
    navigation.navigate(opt.target, { ...params, ...(opt.targetParams || {}) });
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: bottomSpace }}>
       <View style={centered}>

        {/* Device details — image, condition (Working / Dead), colour, RAM &
            storage, plus the selected services. */}
        {(params.device || params.services?.length) ? (
          <View className="bg-card border border-border rounded-2xl p-3 mb-3 flex-row items-center">
            <View className="rounded-xl bg-primary/10 items-center justify-center mr-3 overflow-hidden" style={{ height: 60, width: 60 }}>
              {device.imageUrl ? (
                <Image source={{ uri: device.imageUrl }} style={{ width: 60, height: 60 }} resizeMode="cover" />
              ) : (
                <Smartphone size={26} color="#00008B" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-text-muted uppercase tracking-widest mr-2" style={{ fontSize: rf(10) }}>Device Details</Text>
                {params.device ? (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: isDead ? '#FEE2E2' : '#DCFCE7' }}>
                    <Text className="font-extrabold" style={{ fontSize: rf(8.5), color: isDead ? '#B91C1C' : '#004C40', letterSpacing: 0.4 }}>
                      {isDead ? 'DEAD / UNKNOWN' : 'WORKING'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="font-extrabold text-text mt-0.5" style={{ fontSize: rf(14) }} numberOfLines={1}>
                {device.modelName || 'Device'}
              </Text>
              {deviceSpecs ? (
                <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10.5) }} numberOfLines={1}>{deviceSpecs}</Text>
              ) : null}
              {params.services?.length ? (
                <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }} numberOfLines={1}>
                  {params.services.length} service{params.services.length === 1 ? '' : 's'} · {params.services.map((s) => s.name).join(', ')}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text className="font-extrabold text-text-muted tracking-widest mb-2" style={{ fontSize: rf(11) }}>HOW TO PROCEED</Text>

        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSelected(opt.key)}
              className={`bg-card rounded-2xl border p-3.5 mb-2.5 active:opacity-90 ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <View className="flex-row items-start">
                <View className={`h-10 w-10 rounded-xl items-center justify-center mr-3 ${opt.bg}`}>
                  <Icon size={20} color={opt.accent} />
                </View>
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center">
                    <Text className="font-extrabold text-text mr-2" style={{ fontSize: rf(15) }}>{opt.title}</Text>
                    {opt.badge ? (
                      <View className="bg-background border border-border rounded-full px-2 py-0.5">
                        <Text className="font-bold text-text-muted tracking-wide" style={{ fontSize: rf(9) }}>{opt.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-text-muted mt-1 leading-4" style={{ fontSize: rf(12) }}>{opt.description}</Text>

                  <View className="flex-row flex-wrap mt-2">
                    {opt.highlights.map((h) => {
                      const HIcon = h.icon;
                      return (
                        <View key={h.label} className="flex-row items-center mr-3 mb-1">
                          <HIcon size={11} color={opt.accent} />
                          <Text className="text-text-muted ml-1" style={{ fontSize: rf(10) }}>{h.label}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
                    <View className="flex-row items-center">
                      <Clock size={11} color="#94A3B8" />
                      <Text className="text-text-muted ml-1" style={{ fontSize: rf(11) }}>{opt.eta}</Text>
                    </View>
                    {opt.price ? (
                      <Text className={` font-extrabold ${opt.priceClass}`} style={{ fontSize: rf(13) }}>{opt.price}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Radio / check */}
                <View className={`h-6 w-6 rounded-full items-center justify-center ${isSelected ? 'bg-primary' : 'border-2 border-border'}`}>
                  {isSelected ? <Check size={14} color="#fff" strokeWidth={2} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        {/* Walk-in (subtle) */}
        <Pressable
          onPress={() => navigation.navigate('NearbyShops')}
          className="bg-card border border-border rounded-2xl p-3 flex-row items-center active:opacity-80"
        >
          <View className="h-9 w-9 rounded-full bg-background items-center justify-center mr-3">
            <Store size={16} color="#64748B" />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-text" style={{ fontSize: rf(13) }}>Walk-in to a shop</Text>
            <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }} numberOfLines={1}>Find shops on the map & visit directly.</Text>
          </View>
          <View className="bg-background border border-border rounded-full px-3 py-1.5">
            <Text className="font-bold text-text" style={{ fontSize: rf(11) }}>Find</Text>
          </View>
        </Pressable>

        <Text className="text-text-muted text-center mt-3" style={{ fontSize: rf(10) }}>
          Both options are handled by verified shops.
        </Text>
       </View>
      </ScrollView>

      <BottomActionBar
        title={selected === 'ENQUIRY' ? 'Start Enquiry Chat' : 'Continue to Shops'}
        onPress={onContinue}
      />
    </View>
  );
}
