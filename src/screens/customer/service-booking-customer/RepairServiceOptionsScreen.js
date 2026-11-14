import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  MessageCircle, Truck, Clock, IndianRupee,
  Phone, Check, Smartphone, ShieldCheck, X, Zap,
} from 'lucide-react-native';
import { BottomActionBar, useBottomBarInset } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';
import { FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';

const MAX_W = 560;
const GREEN_TEXT = '#035C6C'; // #035C6C shaded for text on white
const LINE = '#E8EAEE';
const MINT = '#E5F3F5';
const YELLOW_SOFT = '#FFF4D6';
const RED_SOFT = '#FEEBEA';
const MUTED = '#606E87';
const shadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

const OPTIONS = [
  {
    key: 'PICKUP',
    target: 'RepairPickupShops',
    title: 'Doorstep Pickup',
    tagline: 'Most popular',
    description: 'Free pickup & drop. Pick a nearby shop and a slot — we handle the rest.',
    accent: '#0788C9',
    bg: 'bg-primary/10',
    priceClass: 'text-primary',
    icon: Truck,
    badge: 'POPULAR',
    // Tap a highlight for a short note (both options).
    highlights: [
      { icon: Clock, label: 'Same Day Pickup', title: 'Same Day Pickup', note: 'Choose a slot for today and the shop collects your device from your doorstep the same day.' },
      { icon: Truck, label: 'Free pickup', title: 'Free pickup & delivery', note: 'No extra charge to collect your device and bring it back after the repair. You pay only for the repair.' },
      { icon: Zap, label: 'Fast delivery', title: 'Fast delivery', note: 'Your device is delivered back as soon as the repair passes the quality check, within the estimated time in your booking.' },
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
    accent: '#035C6C',
    bg: 'bg-success/10',
    priceClass: 'text-success',
    icon: MessageCircle,
    badge: 'FREE',
    highlights: [
      { icon: MessageCircle, label: 'Live chat', title: 'Live chat', note: 'Chat with the shop technicians in the app to explain the issue before you book.' },
      { icon: Phone, label: 'Call back', title: 'Call back', note: 'Prefer talking? The shop can call you back to discuss the repair.' },
      { icon: IndianRupee, label: 'No obligation', title: 'No obligation', note: 'Ask questions and get a quote for free. Book only if you are happy with it.' },
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
  const [note, setNote] = useState(null); // highlight whose note popup is open
  const NoteIcon = note?.icon;

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
                backgroundColor: isSelected ? '#F0F8F9' : '#FFFFFF',
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

                  <View style={{ flexDirection: 'row', flexWrap: 'nowrap', marginTop: 5 }}>
                    {opt.highlights.map((h, i) => {
                      const HIcon = h.icon;
                      // Same chip look for both options: one line (shrinking on narrow
                      // phones); each chip opens a short note.
                      const chip = { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, marginRight: 5, marginTop: 4 };
                      return h.note ? (
                        <Pressable
                          key={h.label}
                          onPress={() => setNote(h)}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityLabel={`${h.title || h.label}. Show details`}
                          className="active:opacity-70"
                          style={{ ...chip, flexShrink: 1, minWidth: 0, paddingHorizontal: 6, marginRight: i === opt.highlights.length - 1 ? 0 : 5 }}
                        >
                          <HIcon size={12} color={GREEN_TEXT} />
                          <Text style={{ flexShrink: 1, fontSize: rf(10.5), color: BRAND.body, marginLeft: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{h.label}</Text>
                        </Pressable>
                      ) : (
                        <View key={h.label} style={chip}>
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
                    borderWidth: isSelected ? 0 : 2, borderColor: '#D2D6DD',
                  }}
                >
                  {isSelected ? <Check size={14} color="#fff" strokeWidth={2.5} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
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

      {/* Small note popup for a Doorstep Pickup highlight. */}
      <Modal visible={!!note} transparent animationType="fade" onRequestClose={() => setNote(null)} statusBarTranslucent>
        <Pressable onPress={() => setNote(null)} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 280, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, ...shadow, elevation: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                {NoteIcon ? <NoteIcon size={14} color={GREEN_TEXT} /> : null}
              </View>
              <Text style={{ flex: 1, fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{note?.title || note?.label}</Text>
              <Pressable onPress={() => setNote(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close note">
                <X size={16} color={MUTED} />
              </Pressable>
            </View>
            <Text style={{ fontSize: rf(12), lineHeight: rf(17), color: MUTED, marginTop: 8 }}>{note?.note}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
