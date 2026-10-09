import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import {
  MessageCircle, Truck, Store, Clock, IndianRupee,
  Phone, Check, Smartphone, ShieldCheck,
} from 'lucide-react-native';
import { BottomActionBar, useBottomBarInset } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';
import { FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';

const MAX_W = 560;
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const RED_SOFT = '#FEECEC';
const MUTED = '#6B6B6B';
const shadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

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
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <FlowDecor palette={BRAND_FLOW} />
      <FlowHeader title="Service Options" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: bottomSpace }}>
       <View style={centered}>

        {/* Device details — image, condition (Working / Dead), colour, RAM &
            storage, plus the selected services. */}
        {(params.device || params.services?.length) ? (
          <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', ...shadow }}>
            <View style={{ height: 60, width: 52, borderRadius: 12, marginRight: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: device.imageUrl ? '#FFFFFF' : MINT }}>
              {device.imageUrl ? (
                <Image source={{ uri: device.imageUrl }} style={{ width: 50, height: 58 }} resizeMode="contain" />
              ) : (
                <Smartphone size={24} color={GREEN_TEXT} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ fontSize: rf(9.5), color: GREEN_TEXT, letterSpacing: 1.2, fontWeight: '800', marginRight: 7 }}>DEVICE DETAILS</Text>
                {params.device ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: isDead ? RED_SOFT : MINT }}>
                    <View style={{ height: 6, width: 6, borderRadius: 3, marginRight: 4, backgroundColor: isDead ? BRAND.red : BRAND.green }} />
                    <Text style={{ fontSize: rf(9), fontWeight: '800', color: isDead ? BRAND.red : GREEN_TEXT, letterSpacing: 0.5 }}>
                      {isDead ? 'DEAD / UNKNOWN' : 'WORKING'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: rf(15.5), fontWeight: '800', color: BRAND.ink, marginTop: 2 }} numberOfLines={1}>
                {device.modelName || 'Device'}
              </Text>
              {deviceSpecs ? (
                <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }} numberOfLines={1}>{deviceSpecs}</Text>
              ) : null}
              {params.services?.length ? (
                <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }} numberOfLines={1}>
                  {params.services.length} service{params.services.length === 1 ? '' : 's'} · {params.services.map((s) => s.name).join(', ')}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text style={{ fontSize: rf(11), fontWeight: '800', color: MUTED, letterSpacing: 1.4, marginBottom: 8 }}>HOW TO PROCEED</Text>

        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.key;
          const yellowBadge = opt.badge === 'POPULAR';
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSelected(opt.key)}
              className="active:opacity-90"
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={opt.title}
              style={{
                backgroundColor: isSelected ? '#F7FCF8' : '#FFFFFF',
                borderWidth: isSelected ? 1.5 : 1, borderColor: isSelected ? BRAND.green : LINE,
                borderRadius: 16, padding: 11, marginBottom: 10, ...shadow,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Icon size={18} color={GREEN_TEXT} />
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink, marginRight: 7 }}>{opt.title}</Text>
                    {opt.badge ? (
                      <View style={{ backgroundColor: yellowBadge ? YELLOW_SOFT : MINT, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: rf(9), fontWeight: '800', color: yellowBadge ? BRAND.ink : GREEN_TEXT, letterSpacing: 0.6 }}>{opt.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: rf(11.5), lineHeight: rf(16), color: MUTED, marginTop: 3 }}>{opt.description}</Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 }}>
                    {opt.highlights.map((h) => {
                      const HIcon = h.icon;
                      return (
                        <View key={h.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, marginRight: 5, marginTop: 4 }}>
                          <HIcon size={12} color={GREEN_TEXT} />
                          <Text style={{ fontSize: rf(10.5), color: BRAND.body, marginLeft: 4 }}>{h.label}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: BRAND.line }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Clock size={13} color={MUTED} />
                      <Text style={{ fontSize: rf(11.5), color: MUTED, marginLeft: 5 }}>{opt.eta}</Text>
                    </View>
                    {opt.price ? (
                      <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: GREEN_TEXT }}>{opt.price}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Radio / check */}
                <View
                  style={{
                    height: 24, width: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? BRAND.green : 'transparent',
                    borderWidth: isSelected ? 0 : 2, borderColor: '#C9C9C9',
                  }}
                >
                  {isSelected ? <Check size={14} color="#fff" strokeWidth={2.5} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        {/* Walk-in (subtle) */}
        <Pressable
          onPress={() => navigation.navigate('NearbyShops')}
          className="active:opacity-85"
          accessibilityRole="button"
          accessibilityLabel="Walk-in to a shop"
          style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 11, flexDirection: 'row', alignItems: 'center', ...shadow }}
        >
          <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Store size={18} color={GREEN_TEXT} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(14), fontWeight: '800', color: BRAND.ink }}>Walk-in to a shop</Text>
            <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }} numberOfLines={2}>Find shops on the map & visit directly.</Text>
          </View>
          <View style={{ backgroundColor: BRAND.green, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8 }}>
            <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: '#FFFFFF' }}>Find</Text>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
          <ShieldCheck size={15} color="#fff" fill={BRAND.green} />
          <Text style={{ fontSize: rf(11), color: MUTED, marginLeft: 6 }}>
            Both options are handled by verified shops.
          </Text>
        </View>
       </View>
      </ScrollView>

      <BottomActionBar>
        <FlowCta
          title={selected === 'ENQUIRY' ? 'Start Enquiry Chat' : 'Continue to Shops'}
          onPress={onContinue}
          palette={BRAND_FLOW}
        />
      </BottomActionBar>
    </View>
  );
}
