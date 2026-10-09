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
import { FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from './FlowChrome';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const MUTED = '#6B6B6B';
const GREEN_LINE = 'rgba(9,173,42,0.45)';
const shadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

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
  const tileW = Math.floor((Math.min(width, 640) - 32 - 22 - 16) / 3); // screen − page pad − card pad − gaps
  const tileH = Math.max(84, Math.min(104, Math.round(tileW * 0.82)));
  // Slot tones: front + video green, back yellow (palette tints).
  const TONE = {
    primary:   { tint: MINT,        bg: '#F7FCF8', border: GREEN_LINE,       fg: GREEN_TEXT, icon: BRAND.green },
    secondary: { tint: YELLOW_SOFT, bg: '#FFFCF3', border: BRAND.yellowLine, fg: BRAND.ink,  icon: BRAND.yellow },
    success:   { tint: MINT,        bg: '#F7FCF8', border: GREEN_LINE,       fg: GREEN_TEXT, icon: BRAND.green },
  };
  const card = {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE,
    padding: 11, marginBottom: 10, ...shadow,
  };

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <FlowDecor palette={BRAND_FLOW} />
      {/* bottom-left decorative curve (visual only) */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -width * 0.4, bottom: 60, width: width * 1.2, height: width * 0.7, borderRadius: width, backgroundColor: 'rgba(9,173,42,0.04)' }} />
      <FlowHeader title="Review Report" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: bottomSpace }}>

        {/* Device summary */}
        <View style={[card, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ height: 56, width: 56, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.line, alignItems: 'center', justifyContent: 'center', marginRight: 11, overflow: 'hidden' }}>
            {device.imageUrl ? (
              <Image source={{ uri: device.imageUrl }} style={{ width: 50, height: 52 }} resizeMode="contain" />
            ) : (
              <Smartphone size={24} color={GREEN_TEXT} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(9.5), color: GREEN_TEXT, letterSpacing: 1.2, fontWeight: '800' }}>YOUR DEVICE</Text>
            <Text style={{ fontSize: rf(15.5), fontWeight: '800', color: BRAND.ink, marginTop: 1 }} numberOfLines={2}>{device.modelName || 'Device'}</Text>
            {specLine ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2 }} numberOfLines={1}>{specLine}</Text> : null}
          </View>
          {/* decorative — this card had no tap action before */}
          <View pointerEvents="none" style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
            <ChevronRight size={16} color={GREEN_TEXT} />
          </View>
        </View>

        {/* Selected services */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
            <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Wrench size={17} color={GREEN_TEXT} />
            </View>
            <Text style={{ flex: 1, fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink }}>Repair Services</Text>
            <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: rf(12), fontWeight: '800', color: GREEN_TEXT }}>{services.length}</Text>
            </View>
          </View>
          {services.length === 0 ? (
            <Text style={{ fontSize: rf(12), color: MUTED }}>No services selected</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: -6 }}>
              {services.map((sv) => (
                <View key={sv.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: MINT, borderWidth: 1, borderColor: GREEN_LINE, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6, maxWidth: '100%' }}>
                  <View style={{ height: 18, width: 18, borderRadius: 9, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center', marginRight: 5 }}>
                    <Check size={11} color="#fff" strokeWidth={3} />
                  </View>
                  <Text style={{ fontSize: rf(12), fontWeight: '700', color: GREEN_TEXT, flexShrink: 1 }} numberOfLines={1}>{sv.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Device photos */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: YELLOW_SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Camera size={17} color={BRAND.yellow} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink }}>Device Photos</Text>
              <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }} numberOfLines={1}>Front & Back required · video optional.</Text>
            </View>
            <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: ready ? MINT : YELLOW_SOFT, borderWidth: 1, borderColor: ready ? GREEN_LINE : BRAND.yellowLine }}>
              <Text style={{ fontSize: rf(12), fontWeight: '800', color: ready ? GREEN_TEXT : BRAND.ink }}>{filled}/3</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 }}>
            {SLOTS.map((slot) => {
              const asset = media[slot.key];
              const t = TONE[slot.accent];
              const Icon = slot.icon;
              const ring = Math.min(42, Math.round(tileW * 0.4));
              return (
                <View key={slot.key} style={{ width: tileW }}>
                  <Pressable
                    onPress={() => pick(slot)}
                    className="active:opacity-85"
                    accessibilityLabel={`Add ${slot.label}`}
                    style={{
                      height: tileH, borderRadius: 14, overflow: 'hidden',
                      borderWidth: asset ? 1 : 1.5, borderStyle: asset ? 'solid' : 'dashed',
                      borderColor: asset ? LINE : t.border, backgroundColor: t.bg,
                    }}
                  >
                    {asset ? (
                      <View style={{ flex: 1 }}>
                        {slot.isVideo ? (
                          <View style={{ flex: 1, backgroundColor: BRAND.ink, alignItems: 'center', justifyContent: 'center' }}>
                            <Video size={22} color="#fff" />
                            <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: '#fff', marginTop: 3 }}>VIDEO</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: asset.uri }} style={{ flex: 1 }} resizeMode="cover" />
                        )}
                        <Pressable
                          onPress={() => remove(slot.key)}
                          accessibilityLabel={`Remove ${slot.label}`}
                          style={{ position: 'absolute', right: 5, top: 5, height: 22, width: 22, borderRadius: 11, backgroundColor: 'rgba(30,30,30,0.65)', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={12} color="#fff" />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ height: ring, width: ring, borderRadius: ring / 2, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                          <Icon size={19} color={t.icon} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Plus size={12} color={t.fg} strokeWidth={2.6} />
                          <Text style={{ fontSize: rf(12), fontWeight: '700', color: t.fg, marginLeft: 3 }}>Add</Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                  <Text style={{ fontSize: rf(11.5), fontWeight: '700', textAlign: 'center', marginTop: 5, color: asset ? GREEN_TEXT : BRAND.ink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {slot.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.line, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginTop: 11 }}>
            <ShieldCheck size={16} color={GREEN_TEXT} />
            <Text style={{ flex: 1, fontSize: rf(11), color: MUTED, marginLeft: 8, lineHeight: rf(15) }}>
              Photos are encrypted and only visible to the shop you book.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bar — same count, `ready` rule and onContinue. */}
      <BottomActionBar>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ minWidth: 88, paddingRight: 12 }}>
            <Text style={{ fontSize: rf(11.5), color: MUTED }}>Photos</Text>
            <Text style={{ fontSize: rf(19), fontWeight: '900', color: BRAND.ink, lineHeight: rf(23) }}>{`${filled}/3`}</Text>
            <Text style={{ fontSize: rf(11), color: ready ? GREEN_TEXT : MUTED }} numberOfLines={1}>{ready ? 'ready' : 'add front & back'}</Text>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: LINE, marginRight: 14 }} />
          <View style={{ flex: 1 }}>
            <FlowCta title="Choose a Shop" onPress={onContinue} disabled={!ready} palette={BRAND_FLOW} />
          </View>
        </View>
      </BottomActionBar>

      {chooserFor ? (
        <Pressable
          onPress={() => setChooserFor(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(30,30,30,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation && e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              paddingTop: 12, paddingBottom: 24, paddingHorizontal: 16,
            }}
          >
            <View style={{ height: 4, width: 44, borderRadius: 2, backgroundColor: LINE, alignSelf: 'center', marginBottom: 14 }} />
            <Text style={{ fontSize: rf(15), fontWeight: '800', color: BRAND.ink, marginBottom: 3 }}>
              Add {chooserFor.label.toLowerCase()}
            </Text>
            <Text style={{ fontSize: rf(11.5), color: MUTED, marginBottom: 12 }}>
              Take a fresh photo or pick one from your gallery.
            </Text>

            <Pressable
              onPress={() => { const slot = chooserFor; setChooserFor(null); launch(slot, 'camera'); }}
              android_ripple={{ color: MINT }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: BRAND.bg, borderRadius: 14,
                paddingHorizontal: 12, paddingVertical: 11,
                marginBottom: 8,
                borderWidth: 1, borderColor: LINE,
              }}
            >
              <View style={{ height: 36, width: 36, borderRadius: 18, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                <Camera size={17} color={GREEN_TEXT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink }}>
                  Take a photo
                </Text>
                <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }}>
                  Open camera now
                </Text>
              </View>
              <ChevronRight size={15} color={MUTED} />
            </Pressable>

            <Pressable
              onPress={() => { const slot = chooserFor; setChooserFor(null); launch(slot, 'library'); }}
              android_ripple={{ color: YELLOW_SOFT }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: BRAND.bg, borderRadius: 14,
                paddingHorizontal: 12, paddingVertical: 11,
                marginBottom: 12,
                borderWidth: 1, borderColor: LINE,
              }}
            >
              <View style={{ height: 36, width: 36, borderRadius: 18, backgroundColor: YELLOW_SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                <Upload size={17} color={BRAND.yellow} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink }}>
                  Upload from gallery
                </Text>
                <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }}>
                  Pick an existing photo
                </Text>
              </View>
              <ChevronRight size={15} color={MUTED} />
            </Pressable>

            <Pressable
              onPress={() => setChooserFor(null)}
              android_ripple={{ color: BRAND.line }}
              style={{ paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: MUTED }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}
