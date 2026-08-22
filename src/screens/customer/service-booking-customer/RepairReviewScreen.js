import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: bottomSpace }}>

        {/* Device summary */}
        <Card className="rounded-2xl mb-2.5">
          <View className="flex-row items-center">
            <View className="h-11 w-11 rounded-xl bg-primary/10 items-center justify-center mr-3 overflow-hidden">
              {device.imageUrl ? (
                <Image source={{ uri: device.imageUrl }} style={{ width: 44, height: 44 }} resizeMode="cover" />
              ) : (
                <Smartphone size={20} color="#00008B" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-text-muted uppercase tracking-widest" style={{ fontSize: rf(10) }}>Your Device</Text>
              <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{device.modelName || 'Device'}</Text>
              <View className="flex-row items-center mt-0.5 flex-wrap">
                {device.color ? <Text className="text-text-muted mr-2" style={{ fontSize: rf(10) }}>{device.color}</Text> : null}
                {device.ramLabel ? <Text className="text-text-muted mr-2" style={{ fontSize: rf(10) }}>· {device.ramLabel}</Text> : null}
                {device.storageLabel ? <Text className="text-text-muted" style={{ fontSize: rf(10) }}>· {device.storageLabel}</Text> : null}
              </View>
            </View>
          </View>
        </Card>

        {/* Selected services */}
        <Card className="rounded-2xl mb-2.5">
          <View className="flex-row items-center mb-2">
            <Wrench size={15} color="#00008B" />
            <CardTitle className="ml-2 flex-1">Repair Services</CardTitle>
            <Badge variant="softPrimary">{services.length}</Badge>
          </View>
          {services.length === 0 ? (
            <Text className="text-text-muted" style={{ fontSize: rf(12) }}>No services selected</Text>
          ) : (
            <View className="flex-row flex-wrap">
              {services.map((s) => (
                <View key={s.id} className="bg-primary/10 rounded-full px-2.5 py-1 mr-1.5 mb-1.5">
                  <Text className="font-bold text-primary" style={{ fontSize: rf(11) }}>{s.name}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Device photos */}
        <Card className="rounded-2xl mb-2.5">
          <View className="flex-row items-center mb-1">
            <Camera size={15} color="#F59E0B" />
            <CardTitle className="ml-2 flex-1">Device Photos</CardTitle>
            <Badge variant={ready ? 'softSuccess' : 'softWarning'}>
              {filled}/3
            </Badge>
          </View>
          <Text className="text-text-muted mb-2" style={{ fontSize: rf(10) }}>
            Front & Back required · video optional.
          </Text>

          <View className="flex-row -mx-1">
            {SLOTS.map((slot) => {
              const asset = media[slot.key];
              const accent = accentMap[slot.accent];
              const Icon = slot.icon;
              return (
                <View key={slot.key} style={{ width: '33.333%' }} className="px-1">
                  <Pressable
                    onPress={() => pick(slot)}
                    className={`rounded-xl overflow-hidden border-2 border-dashed ${accent.border}`}
                    style={{ height: 104, backgroundColor: '#F8FAFC' }}
                  >
                    {asset ? (
                      <View className="flex-1">
                        {slot.isVideo ? (
                          <View className="flex-1 bg-text/90 items-center justify-center">
                            <Video size={22} color="#fff" />
                            <Text className="text-white font-bold mt-0.5" style={{ fontSize: rf(9) }}>VIDEO</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: asset.uri }} style={{ flex: 1 }} resizeMode="cover" />
                        )}
                        <Pressable
                          onPress={() => remove(slot.key)}
                          className="absolute right-1 top-1 h-5 w-5 rounded-full bg-black/60 items-center justify-center"
                        >
                          <X size={11} color="#fff" />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <View className={`h-9 w-9 rounded-full ${accent.bg} items-center justify-center mb-1.5`}>
                          <Icon size={16} color={accent.tint} />
                        </View>
                        <View className="flex-row items-center">
                          <Plus size={10} color="#64748B" />
                          <Text className="text-text-muted ml-0.5" style={{ fontSize: rf(9) }}>Add</Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                  <Text className={` font-extrabold mt-1 text-center ${asset ? accent.text : 'text-text'}`} style={{ fontSize: rf(10) }} numberOfLines={1}>
                    {slot.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        <View className="flex-row items-center px-1">
          <ShieldCheck size={13} color="#004C40" />
          <Text className="text-text-muted ml-1.5 flex-1" style={{ fontSize: rf(10) }}>
            Photos are encrypted and only visible to the shop you book.
          </Text>
        </View>
      </ScrollView>

      <BottomActionBar
        priceCaption="Photos"
        priceValue={`${filled}/3`}
        priceLabel={ready ? 'ready' : 'add front & back'}
        title="Choose a Shop"
        onPress={onContinue}
        disabled={!ready}
      />

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

