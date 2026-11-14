import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  Smartphone,
  Camera,
  Video,
  X,
  Plus,
  ShieldCheck,
  Images,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';
import {
  BottomActionBar,
  useBottomBarInset,
} from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { rf } from '../../../utils/responsive';
import { HEADER_SUBTITLES } from '../../../navigation/headerSubtitles';
import { BookingHeader, useHideStackHeader } from './FlowChrome';
import { IssueGlyph, SelectedIssueRow } from './RepairIssueGroups';

// Partner "Devices & Repair" palette.
const ACCENT = '#035C6C';
const MINT = '#E5F3F5';
const MINT_LINE = '#C7E6EA';
const INK = '#111111';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const PAGE_BG = '#F3F4F6';
const RED_TEXT = '#D63232';

const card = { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE };
const sectionTitle = { fontSize: rf(14), fontWeight: '700', color: INK, marginBottom: 8 };
const col = { width: '100%', maxWidth: 720, alignSelf: 'center' };

const SLOTS = [
  { key: 'front', label: 'Front Side',  hint: 'Show the screen',     icon: Smartphone },
  { key: 'back',  label: 'Back Side',   hint: 'Show the rear panel', icon: Camera },
  { key: 'video', label: 'Full Coverage', hint: '15-sec walkaround', icon: Video, isVideo: true },
];

export default function RepairReviewScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const insets = useSafeAreaInsets();
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
  const isTablet = width >= 600;
  const specLine = [[device.ramLabel, device.storageLabel].filter(Boolean).join(' / '), device.color].filter(Boolean).join(' · ');
  const brandPrefix = device.brandName && !String(device.modelName || '').toLowerCase().startsWith(String(device.brandName).toLowerCase())
    ? device.brandName : null;
  const deviceTitle = [brandPrefix, device.modelName].filter(Boolean).join(' ') || 'Device';
  // Camera / Gallery fill the next empty photo slot (front, then back); Video
  // goes to the video slot. Tapping a slot tile still picks for that slot.
  const nextPhoto = SLOTS.find((s) => !s.isVideo && !media[s.key]) || null;
  const videoSlot = SLOTS.find((s) => s.isVideo);
  const quickAdd = (source) => { if (nextPhoto) launch(nextPhoto, Platform.OS === 'web' ? 'library' : source); };
  // 3 thumbnails per row on phones, 5 on tablets (a hair under, so rounding never wraps).
  const tilePct = `${(100 / (isTablet ? 5 : 3)) - 0.1}%`;
  const sheetVideo = !!chooserFor?.isVideo;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BookingHeader title="Review Report" subtitle={HEADER_SUBTITLES.RepairReview} navigation={navigation} step={1} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }}>
        <View style={[col, { paddingHorizontal: 16 }]}>

          {/* ── Device Information ── */}
          <View style={{ paddingTop: 14 }}>
            <Text style={sectionTitle}>Device Information</Text>
            <View style={[card, { flexDirection: 'row', alignItems: 'center', padding: 10 }]}>
              <View style={{ height: 64, width: 64, borderRadius: 12, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {device.imageUrl ? (
                  <Image source={{ uri: device.imageUrl }} style={{ width: '88%', height: '88%' }} resizeMode="contain" />
                ) : (
                  <Smartphone size={26} color={ACCENT} strokeWidth={1.75} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text style={{ fontSize: rf(14), fontWeight: '800', color: INK }} numberOfLines={2}>{deviceTitle}</Text>
                {specLine ? <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 1 }} numberOfLines={1}>{specLine}</Text> : null}
                {device.modelNumber ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }} numberOfLines={1}>{device.modelNumber}</Text> : null}
              </View>
            </View>
          </View>

          {/* ── Selected services ── */}
          <View style={{ paddingTop: 16 }}>
            <Text style={sectionTitle}>Repair Services ({services.length})</Text>
            {services.length === 0 ? (
              <View style={[card, { padding: 12 }]}>
                <Text style={{ fontSize: rf(12), color: MUTED }}>No services selected</Text>
              </View>
            ) : (
              services.map((sv) => (
                <SelectedIssueRow
                  key={sv.id}
                  name={sv.name}
                  sub={sv.custom ? `Other Issue${sv.categoryName ? ` · ${sv.categoryName}` : ''}` : sv.categoryName}
                  glyph={sv.custom
                    ? <Sparkles size={18} color={ACCENT} />
                    : <IssueGlyph item={sv} groupCode={sv.categoryCode} groupName={sv.categoryName} size={18} color={ACCENT} />}
                />
              ))
            )}
          </View>

          {/* ── Device photos — Front & Back required, video optional ── */}
          <View style={{ paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[sectionTitle, { flex: 1, marginBottom: 0 }]}>
                Device Photos<Text style={{ color: RED_TEXT }}> *</Text>
                <Text style={{ fontWeight: '400', color: MUTED }}> (video optional)</Text>
              </Text>
              <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: ready ? MINT : PAGE_BG, borderWidth: 1, borderColor: ready ? MINT_LINE : LINE }}>
                <Text style={{ fontSize: rf(12), fontWeight: '800', color: ready ? ACCENT : INK }}>{filled}/3</Text>
              </View>
            </View>

            {/* Camera · Gallery · Video — straight to the source. */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {[
                { key: 'camera', label: 'Camera', Icon: Camera, disabled: !nextPhoto, onPress: () => quickAdd('camera') },
                { key: 'gallery', label: 'Gallery', Icon: Images, disabled: !nextPhoto, onPress: () => quickAdd('library') },
                { key: 'video', label: 'Video', Icon: Video, disabled: !!media.video, onPress: () => pick(videoSlot) },
              ].map((b) => (
                <Pressable
                  key={b.key}
                  onPress={b.disabled ? undefined : b.onPress}
                  disabled={b.disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${b.label.toLowerCase()}`}
                  accessibilityState={{ disabled: b.disabled }}
                  className="active:opacity-80"
                  style={{
                    flex: 1, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    borderColor: b.disabled ? LINE : MINT_LINE, backgroundColor: b.disabled ? PAGE_BG : MINT, opacity: b.disabled ? 0.6 : 1,
                  }}
                >
                  <b.Icon size={18} color={b.disabled ? MUTED : ACCENT} />
                  <Text style={{ marginLeft: 6, fontSize: rf(13), fontWeight: '700', color: b.disabled ? MUTED : ACCENT }} numberOfLines={1}>{b.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* One tile per slot — tap to add / replace, ✕ removes. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {SLOTS.map((slot) => {
                const asset = media[slot.key];
                const Icon = slot.icon;
                return (
                  <View key={slot.key} style={{ width: tilePct, padding: 4 }}>
                    <Pressable
                      onPress={() => pick(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`${asset ? 'Replace' : 'Add'} ${slot.label}`}
                      className="active:opacity-85"
                      style={{
                        aspectRatio: 1, borderRadius: 12, overflow: 'hidden',
                        borderWidth: asset ? 1 : 1.5, borderStyle: asset ? 'solid' : 'dashed',
                        borderColor: asset ? LINE : MINT_LINE, backgroundColor: asset ? PAGE_BG : '#F9FAFB',
                      }}
                    >
                      {asset ? (
                        <View style={{ flex: 1 }}>
                          {slot.isVideo ? (
                            <View style={{ flex: 1, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                              <Video size={24} color="#FFFFFF" />
                              <Text style={{ fontSize: rf(9.5), fontWeight: '800', color: '#FFFFFF', marginTop: 3 }}>VIDEO</Text>
                            </View>
                          ) : (
                            <Image source={{ uri: asset.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          )}
                          <Pressable
                            onPress={() => remove(slot.key)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${slot.label}`}
                            style={{ position: 'absolute', right: 5, top: 5, height: 22, width: 22, borderRadius: 11, backgroundColor: 'rgba(17,17,17,0.7)', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <X size={13} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                            <Icon size={17} color={ACCENT} />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Plus size={12} color={ACCENT} strokeWidth={2.6} />
                            <Text style={{ fontSize: rf(12), fontWeight: '700', color: ACCENT, marginLeft: 3 }}>Add</Text>
                          </View>
                        </View>
                      )}
                    </Pressable>
                    <Text style={{ marginTop: 4, fontSize: rf(11.5), fontWeight: '600', color: asset ? ACCENT : MUTED, textAlign: 'center' }} numberOfLines={1}>
                      {slot.label}{slot.isVideo ? '' : ' *'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: PAGE_BG, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10, marginTop: 8 }}>
              <ShieldCheck size={16} color={ACCENT} />
              <Text style={{ flex: 1, fontSize: rf(11), color: MUTED, marginLeft: 8, lineHeight: rf(15) }}>
                Photos are encrypted and only visible to the shop you book.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bar — same count, `ready` rule and onContinue. */}
      <BottomActionBar>
        <View style={[col, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ minWidth: 88, paddingRight: 12 }}>
            <Text style={{ fontSize: rf(11.5), color: MUTED }}>Photos</Text>
            <Text style={{ fontSize: rf(18), fontWeight: '800', color: INK, lineHeight: rf(22) }}>{`${filled}/3`}</Text>
            <Text style={{ fontSize: rf(11), color: ready ? ACCENT : MUTED }} numberOfLines={1}>{ready ? 'ready' : 'add front & back'}</Text>
          </View>
          <Pressable
            onPress={onContinue}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            className={ready ? 'active:opacity-85' : ''}
            style={{
              flex: 1, height: 52, borderRadius: 14, backgroundColor: ACCENT, opacity: ready ? 1 : 0.45,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: rf(15), fontWeight: '800' }} numberOfLines={1}>Choose a Shop</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.25} style={{ marginLeft: 6 }} />
          </Pressable>
        </View>
      </BottomActionBar>

      {chooserFor ? (
        <Pressable
          onPress={() => setChooserFor(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(17,17,17,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation && e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 10, paddingHorizontal: 16,
            }}
          >
            <View style={{ height: 4, width: 40, borderRadius: 2, backgroundColor: LINE, alignSelf: 'center', marginBottom: 12 }} />
            <Text style={{ fontSize: rf(16), fontWeight: '800', color: INK, marginBottom: 2 }}>
              Add {chooserFor.label.toLowerCase()}
            </Text>
            <Text style={{ fontSize: rf(11.5), color: MUTED, marginBottom: 6 }}>
              {sheetVideo ? 'Record a short video or pick one from your gallery.' : 'Take a fresh photo or pick one from your gallery.'}
            </Text>

            {[
              { key: 'camera', Icon: sheetVideo ? Video : Camera, label: sheetVideo ? 'Record a video' : 'Take a photo', sub: 'Open camera now' },
              { key: 'library', Icon: Images, label: 'Upload from gallery', sub: sheetVideo ? 'Pick an existing video' : 'Pick an existing photo' },
            ].map((o) => (
              <Pressable
                key={o.key}
                onPress={() => { const slot = chooserFor; setChooserFor(null); launch(slot, o.key); }}
                android_ripple={{ color: MINT }}
                accessibilityRole="button"
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ height: 40, width: 40, borderRadius: 20, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
                  <o.Icon size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontSize: rf(14.5), fontWeight: '600', color: INK }}>{o.label}</Text>
                  <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }}>{o.sub}</Text>
                </View>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setChooserFor(null)}
              accessibilityRole="button"
              className="active:opacity-80"
              style={{ marginTop: 10, height: 46, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: rf(14), fontWeight: '700', color: INK }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}
