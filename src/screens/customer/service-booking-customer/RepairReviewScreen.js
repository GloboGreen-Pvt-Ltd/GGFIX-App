import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Smartphone,
  Camera,
  Video,
  X,
  Plus,
  ShieldCheck,
  Wrench,
  Upload,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import {
  BottomActionBar,
  Card,
  CardTitle,
  Badge,
  useBottomBarInset,
} from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';

const SLOTS = [
  { key: 'front', label: 'Front Side',  hint: 'Show the screen',     accent: 'primary',   icon: Smartphone },
  { key: 'back',  label: 'Back Side',   hint: 'Show the rear panel', accent: 'secondary', icon: Camera },
  { key: 'video', label: 'Full Coverage', hint: '15-sec walkaround', accent: 'success',   icon: Video, isVideo: true },
];

const accentMap = {
  primary:   { tint: '#00008B', bg: 'bg-primary/10',   border: 'border-primary/40',   text: 'text-primary' },
  secondary: { tint: '#2563EB', bg: 'bg-secondary/10', border: 'border-secondary/40', text: 'text-secondary' },
  success:   { tint: '#004C40', bg: 'bg-success/10',   border: 'border-success/40',   text: 'text-success' },
};

export default function RepairReviewScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  useHideStackHeader(navigation);
  const { device = {}, services = [] } = route.params || {};
  const [media, setMedia] = useState({ front: null, back: null, video: null });
  // Picker chooser modal: which slot is currently asking for Camera vs Upload?
  // null = no chooser open. The chooser dispatches to launchCameraAsync or
  // launchImageLibraryAsync once the user picks a source.
  const [chooserFor, setChooserFor] = useState(null);

  const launch = async (slot, source) => {
    const isVideo = slot.isVideo;
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        notify('Permission needed', source === 'camera'
          ? 'Allow camera access to take a photo.'
          : 'Allow media library access to attach photos.');
        return;
      }
      const opts = {
        mediaTypes: isVideo ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        videoMaxDuration: 30,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (!result.canceled && result.assets?.[0]) {
        setMedia((m) => ({ ...m, [slot.key]: result.assets[0] }));
      }
    } catch (e) {
      notify('Couldn\'t pick media', e?.message || 'Try again');
    }
  };

  // Open the bottom-sheet chooser when a slot is tapped. On web (which lacks
  // a native camera picker in expo-image-picker) we skip the chooser and go
  // straight to the file dialog.
  const pick = (slot) => {
    if (Platform.OS === 'web') {
      launch(slot, 'library');
      return;
    }
    setChooserFor(slot);
  };

  const remove = (key) => setMedia((m) => ({ ...m, [key]: null }));

  const onContinue = () => {
    navigation.navigate('RepairServiceOptions', { device, services, media });
  };

  const filled = Object.values(media).filter(Boolean).length;
  const ready = !!media.front && !!media.back; // video optional

  // ---- presentation-only values ----
  const { width } = useWindowDimensions();
  const specLine = [device.color, device.ramLabel, device.storageLabel].filter(Boolean).join('  ·  ');
  const tileW = Math.floor((Math.min(width, 640) - 32 - 28 - 16) / 3); // screen − page pad − card pad − gaps
  const tileH = Math.max(96, Math.min(124, Math.round(tileW * 1.0)));
  const TONE = {
    primary:   { tint: '#DDF3EA', bg: '#F2FBF7', border: '#8FD3B8', fg: '#006B57' },
    secondary: { tint: '#DCEBFD', bg: '#F1F7FF', border: '#8EC0F2', fg: '#2583E8' },
    success:   { tint: '#DDF3EA', bg: '#F2FBF7', border: '#8FD3B8', fg: '#006B57' },
  };
  const card = {
    backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: FLOW.border,
    padding: 14, marginBottom: 14, ...cardShadow,
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FCFA' }}>
      <FlowDecor />
      {/* bottom-left decorative curve (visual only) */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -width * 0.4, bottom: 60, width: width * 1.2, height: width * 0.7, borderRadius: width, backgroundColor: 'rgba(0,168,120,0.05)' }} />
      <FlowHeader title="Review Report" navigation={navigation} backStyle="white" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bottomSpace }}>

        {/* Device summary */}
        <View style={[card, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ height: 78, width: 78, borderRadius: 18, backgroundColor: FLOW.softMint, alignItems: 'center', justifyContent: 'center', marginRight: 14, overflow: 'hidden' }}>
            {device.imageUrl ? (
              <Image source={{ uri: device.imageUrl }} style={{ width: 70, height: 72 }} resizeMode="contain" />
            ) : (
              <Smartphone size={30} color={FLOW.deep} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(10.5), color: FLOW.muted, letterSpacing: 1.6, fontWeight: '600' }}>YOUR DEVICE</Text>
            <Text style={{ fontSize: rf(19), fontWeight: '800', color: FLOW.ink, marginTop: 2 }} numberOfLines={2}>{device.modelName || 'Device'}</Text>
            {specLine ? <Text style={{ fontSize: rf(13), color: FLOW.muted, marginTop: 3 }} numberOfLines={1}>{specLine}</Text> : null}
          </View>
          {/* decorative — this card had no tap action before */}
          <View pointerEvents="none" style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: FLOW.softMint, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
            <ChevronRight size={19} color={FLOW.deep} />
          </View>
        </View>

        {/* Selected services */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ height: 44, width: 44, borderRadius: 22, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Wrench size={21} color={FLOW.deep} />
            </View>
            <Text style={{ flex: 1, fontSize: rf(17.5), fontWeight: '800', color: FLOW.ink }}>Repair Services</Text>
            <View style={{ minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 8, backgroundColor: FLOW.mint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: FLOW.deep }}>{services.length}</Text>
            </View>
          </View>
          {services.length === 0 ? (
            <Text style={{ fontSize: rf(12.5), color: FLOW.muted }}>No services selected</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: -6 }}>
              {services.map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: FLOW.softMint, borderWidth: 1, borderColor: '#D5EDE3', borderRadius: 999, paddingLeft: 5, paddingRight: 12, paddingVertical: 5, marginRight: 6, marginBottom: 6, maxWidth: '100%' }}>
                  <View style={{ height: 20, width: 20, borderRadius: 10, backgroundColor: FLOW.deep, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </View>
                  <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: FLOW.deep, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Device photos */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ height: 44, width: 44, borderRadius: 22, backgroundColor: '#FFF4DE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Camera size={21} color="#F59E0B" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(17.5), fontWeight: '800', color: FLOW.ink }}>Device Photos</Text>
              <Text style={{ fontSize: rf(12), color: FLOW.muted, marginTop: 2 }}>Front & Back required · video optional.</Text>
            </View>
            <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: ready ? FLOW.mint : '#FFF4DE' }}>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: ready ? FLOW.deep : '#D97706' }}>{filled}/3</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            {SLOTS.map((slot) => {
              const asset = media[slot.key];
              const t = TONE[slot.accent];
              const Icon = slot.icon;
              return (
                <View key={slot.key} style={{ width: tileW }}>
                  <Pressable
                    onPress={() => pick(slot)}
                    className="active:opacity-85"
                    style={{
                      height: tileH, borderRadius: 18, overflow: 'hidden',
                      borderWidth: asset ? 1 : 1.5, borderStyle: asset ? 'solid' : 'dashed',
                      borderColor: asset ? FLOW.border : t.border, backgroundColor: t.bg,
                    }}
                  >
                    {asset ? (
                      <View style={{ flex: 1 }}>
                        {slot.isVideo ? (
                          <View style={{ flex: 1, backgroundColor: '#1C2A2A', alignItems: 'center', justifyContent: 'center' }}>
                            <Video size={24} color="#fff" />
                            <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: '#fff', marginTop: 3 }}>VIDEO</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: asset.uri }} style={{ flex: 1 }} resizeMode="cover" />
                        )}
                        <Pressable
                          onPress={() => remove(slot.key)}
                          accessibilityLabel={`Remove ${slot.label}`}
                          style={{ position: 'absolute', right: 5, top: 5, height: 22, width: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={12} color="#fff" />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ height: Math.min(52, tileW * 0.46), width: Math.min(52, tileW * 0.46), borderRadius: 26, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                          <Icon size={22} color={t.fg} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Plus size={13} color={t.fg} strokeWidth={2.6} />
                          <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: t.fg, marginLeft: 3 }}>Add</Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                  <Text style={{ fontSize: rf(12.5), fontWeight: '700', textAlign: 'center', marginTop: 7, color: asset ? t.fg : FLOW.ink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {slot.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F7F8', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginTop: 14 }}>
            <ShieldCheck size={19} color={FLOW.deep} />
            <Text style={{ flex: 1, fontSize: rf(12), color: FLOW.muted, marginLeft: 10, lineHeight: rf(17) }}>
              Photos are encrypted and only visible to the shop you book.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bar — same count, `ready` rule and onContinue. */}
      <BottomActionBar>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ minWidth: 92, paddingRight: 12 }}>
            <Text style={{ fontSize: rf(12), color: FLOW.muted }}>Photos</Text>
            <Text style={{ fontSize: rf(22), fontWeight: '900', color: FLOW.ink, lineHeight: rf(27) }}>{`${filled}/3`}</Text>
            <Text style={{ fontSize: rf(11.5), color: FLOW.muted }} numberOfLines={1}>{ready ? 'ready' : 'add front & back'}</Text>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: FLOW.border, marginRight: 14 }} />
          <View style={{ flex: 1 }}>
            <FlowCta title="Choose a Shop" onPress={onContinue} disabled={!ready} />
          </View>
        </View>
      </BottomActionBar>

      {chooserFor ? (
        <Pressable
          onPress={() => setChooserFor(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15,23,42,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation && e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 22, borderTopRightRadius: 22,
              paddingTop: 14, paddingBottom: 28, paddingHorizontal: 16,
            }}
          >
            <View style={{ height: 4, width: 44, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: rf(16), fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
              Add {chooserFor.label.toLowerCase()}
            </Text>
            <Text style={{ fontSize: rf(12), color: '#64748B', marginBottom: 14 }}>
              Take a fresh photo or pick one from your gallery.
            </Text>

            <Pressable
              onPress={() => { const slot = chooserFor; setChooserFor(null); launch(slot, 'camera'); }}
              android_ripple={{ color: '#DCFCE7' }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#F6F7F9', borderRadius: 14,
                paddingHorizontal: 14, paddingVertical: 14,
                marginBottom: 10,
                borderWidth: 1, borderColor: '#F1F5F9',
              }}
            >
              <View
                style={{
                  height: 40, width: 40, borderRadius: 20,
                  backgroundColor: '#DCFCE7',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Camera size={18} color="#004C40" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#0F172A' }}>
                  Take a photo
                </Text>
                <Text style={{ fontSize: rf(11.5), color: '#64748B', marginTop: 1 }}>
                  Open camera now
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => { const slot = chooserFor; setChooserFor(null); launch(slot, 'library'); }}
              android_ripple={{ color: '#FFEDD5' }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#F6F7F9', borderRadius: 14,
                paddingHorizontal: 14, paddingVertical: 14,
                marginBottom: 14,
                borderWidth: 1, borderColor: '#F1F5F9',
              }}
            >
              <View
                style={{
                  height: 40, width: 40, borderRadius: 20,
                  backgroundColor: '#FFEDD5',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Upload size={18} color="#C2410C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#0F172A' }}>
                  Upload from gallery
                </Text>
                <Text style={{ fontSize: rf(11.5), color: '#64748B', marginTop: 1 }}>
                  Pick an existing photo
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setChooserFor(null)}
              android_ripple={{ color: '#F1F5F9' }}
              style={{ paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#64748B' }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

