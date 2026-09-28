import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import {
  MessageCircle, Truck, Store, Clock, IndianRupee,
  Phone, Check, Smartphone, ShieldCheck,
} from 'lucide-react-native';
import { BottomActionBar, useBottomBarInset } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';

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
  useHideStackHeader(navigation);
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
    <View style={{ flex: 1, backgroundColor: FLOW.bg }}>
      <FlowDecor />
      <FlowHeader title="Service Options" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bottomSpace }}>
       <View style={centered}>

        {/* Device details — image, condition (Working / Dead), colour, RAM &
            storage, plus the selected services. */}
        {(params.device || params.services?.length) ? (
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, padding: 12, marginBottom: 18, flexDirection: 'row', alignItems: 'center', ...cardShadow }}>
            <View style={{ height: 82, width: 70, borderRadius: 14, marginRight: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: device.imageUrl ? '#fff' : FLOW.softMint }}>
              {device.imageUrl ? (
                <Image source={{ uri: device.imageUrl }} style={{ width: 68, height: 80 }} resizeMode="contain" />
              ) : (
                <Smartphone size={28} color={FLOW.primary} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ fontSize: rf(10.5), color: FLOW.muted, letterSpacing: 1.6, fontWeight: '600', marginRight: 8 }}>DEVICE DETAILS</Text>
                {params.device ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: isDead ? '#FEE2E2' : FLOW.mint }}>
                    <View style={{ height: 7, width: 7, borderRadius: 4, marginRight: 5, backgroundColor: isDead ? '#DC2626' : '#12A150' }} />
                    <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: isDead ? '#B91C1C' : FLOW.deep, letterSpacing: 0.6 }}>
                      {isDead ? 'DEAD / UNKNOWN' : 'WORKING'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: rf(18), fontWeight: '800', color: FLOW.ink, marginTop: 3 }} numberOfLines={1}>
                {device.modelName || 'Device'}
              </Text>
              {deviceSpecs ? (
                <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 2 }} numberOfLines={1}>{deviceSpecs}</Text>
              ) : null}
              {params.services?.length ? (
                <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginTop: 2 }} numberOfLines={1}>
                  {params.services.length} service{params.services.length === 1 ? '' : 's'} · {params.services.map((s) => s.name).join(', ')}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text style={{ fontSize: rf(12), fontWeight: '800', color: FLOW.muted, letterSpacing: 1.8, marginBottom: 10 }}>HOW TO PROCEED</Text>

        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSelected(opt.key)}
              className="active:opacity-90"
              style={{
                backgroundColor: isSelected ? FLOW.tint : '#fff',
                borderWidth: isSelected ? 1.5 : 1, borderColor: isSelected ? '#2FA383' : FLOW.border,
                borderRadius: 22, padding: 14, marginBottom: 12, ...cardShadow,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Icon size={23} color={FLOW.deep} />
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: rf(16.5), fontWeight: '800', color: FLOW.ink, marginRight: 8 }}>{opt.title}</Text>
                    {opt.badge ? (
                      <View style={{ backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <Text style={{ fontSize: rf(10), fontWeight: '800', color: FLOW.primary, letterSpacing: 0.8 }}>{opt.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: rf(12.5), lineHeight: rf(18), color: FLOW.muted, marginTop: 5 }}>{opt.description}</Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                    {opt.highlights.map((h) => {
                      const HIcon = h.icon;
                      return (
                        <View key={h.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, marginRight: 6, marginTop: 4 }}>
                          <HIcon size={14} color={FLOW.deep} />
                          <Text style={{ fontSize: rf(11.5), color: '#334155', marginLeft: 5 }}>{h.label}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: FLOW.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Clock size={15} color={FLOW.muted} />
                      <Text style={{ fontSize: rf(12.5), color: FLOW.muted, marginLeft: 6 }}>{opt.eta}</Text>
                    </View>
                    {opt.price ? (
                      <Text style={{ fontSize: rf(13), fontWeight: '800', color: FLOW.primary }}>{opt.price}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Radio / check */}
                <View
                  style={{
                    height: 28, width: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? FLOW.deep : 'transparent',
                    borderWidth: isSelected ? 0 : 2, borderColor: '#D5DCE3',
                  }}
                >
                  {isSelected ? <Check size={16} color="#fff" strokeWidth={2.5} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        {/* Walk-in (subtle) */}
        <Pressable
          onPress={() => navigation.navigate('NearbyShops')}
          className="active:opacity-85"
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: FLOW.border, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', ...cardShadow }}
        >
          <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Store size={22} color={FLOW.deep} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(15.5), fontWeight: '800', color: FLOW.ink }}>Walk-in to a shop</Text>
            <Text style={{ fontSize: rf(12), color: FLOW.muted, marginTop: 2 }} numberOfLines={2}>Find shops on the map & visit directly.</Text>
          </View>
          <View style={{ backgroundColor: FLOW.mint, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginLeft: 8 }}>
            <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: FLOW.deep }}>Find</Text>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
          <ShieldCheck size={16} color="#fff" fill="#34B889" />
          <Text style={{ fontSize: rf(12), color: FLOW.muted, marginLeft: 6 }}>
            Both options are handled by verified shops.
          </Text>
        </View>
       </View>
      </ScrollView>

      <BottomActionBar>
        <FlowCta
          title={selected === 'ENQUIRY' ? 'Start Enquiry Chat' : 'Continue to Shops'}
          onPress={onContinue}
        />
      </BottomActionBar>
    </View>
  );
}
