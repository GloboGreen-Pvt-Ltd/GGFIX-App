import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Image as ImageIcon, CloudUpload } from 'lucide-react-native';
import { notify } from '../../../components/confirm';
import colors from '../../../theme/colors';
import { Card, PrimaryButton, LabeledInput } from '../../../components/ui';
import { uploadMedia } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
import { cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '46%', margin: '2%', height: 120, borderColor: '#7FB8AE', borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', overflow: 'hidden' },
  slotImg: { ...StyleSheet.absoluteFillObject },
  slotLabel: { fontSize: rf(13), fontWeight: '700', color: colors.text, marginTop: 6, textAlign: 'center' },
  slotLabelOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.92)', paddingVertical: 4, fontSize: rf(12), fontWeight: '700', color: BRAND.ink, textAlign: 'center' },
  removeBtn: { position: 'absolute', right: 4, top: 4, height: 22, width: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  editBanner: { backgroundColor: BRAND.yellowSoft, borderColor: BRAND.yellowLine, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  editBannerTitle: { fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.5 },
  editBannerText: { fontSize: rf(12), color: BRAND.ink, fontWeight: '600', marginTop: 2 },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: BRAND.line, borderTopWidth: 1 },
});

// key maps to the backend ImageBundle field (front/back/side/camera/other)
const SLOTS = [
  { key: 'front', label: 'Front Side' },
  { key: 'back', label: 'Backside' },
  { key: 'side', label: 'side and Center' },
  { key: 'camera', label: 'Camera' },
  { key: 'other', label: 'side and Center' },
];

export default function SellImagesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  useHideStackHeader(navigation);
  const { editSellOrderId, editHints } = params;
  const isEditing = !!editSellOrderId;

  // Seed photo slots from the order's saved image URLs when editing.
  const initialImages = useMemo(() => {
    if (!isEditing) return {};
    const out = {};
    const src = editHints?.images || {};
    SLOTS.forEach((s) => { if (src[s.key]) out[s.key] = src[s.key]; });
    return out;
  }, [isEditing, editHints]);
  const initialCondition = isEditing
    ? (editHints?.deviceConditionSummary || 'Good')
    : 'Good';

  const [condition, setCondition] = useState(initialCondition);
  const [images, setImages] = useState(initialImages); // key -> url
  const [uploading, setUploading] = useState(null); // key currently uploading

  const pick = async (key) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      notify('Permission needed', 'Allow media library access to attach photos.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(key);
      const url = await uploadMedia(result.assets[0], 'sell');
      if (!url) throw new Error('Upload returned no URL');
      setImages((m) => ({ ...m, [key]: url }));
    } catch (e) {
      notify('Upload failed', e?.message || 'Try again');
    } finally {
      setUploading(null);
    }
  };

  const remove = (key) => setImages((m) => { const n = { ...m }; delete n[key]; return n; });

  const onContinue = () => {
    // Detect the stack by inspecting the navigator's registered routes. This is
    // more reliable than depending on a `flow` param surviving every intermediate
    // screen — if any screen in the chain forgets to spread params, the flag
    // disappears, but `routeNames` always reflects the actual stack we're in.
    let hasOwnerRoute = false;
    try { hasOwnerRoute = navigation.getState()?.routeNames?.includes('OwnerSellGadgetPrice') === true; } catch (_) {}
    const ownerListing = hasOwnerRoute
      || params.flow === 'OWNER_LIST'
      || !!params.descriptionType;
    const next = ownerListing ? 'OwnerSellGadgetPrice' : 'SellAddress';
    navigation.navigate(next, {
      ...params,
      flow: ownerListing ? 'OWNER_LIST' : params.flow,
      deviceCondition: condition,
      images,
    });
  };

  // ---- presentation-only values ----
  const { width } = useWindowDimensions();
  const gap = 8;
  const tileW = Math.floor((Math.min(width, 640) - 24 - 22 - 2 - gap * 2) / 3); // screen − page pad − card pad − card border − gaps (3 per row)
  const tileH = Math.max(84, Math.min(116, Math.round(tileW * 0.92)));
  const display = (label) => (label ? label.charAt(0).toUpperCase() + label.slice(1) : label);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <FlowDecor palette={BRAND_FLOW} />
      <FlowHeader title="Sell Device Images" navigation={navigation} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 20 }}>
        {isEditing ? (
          <View style={styles.editBanner}>
            <Ionicons name="create-outline" size={16} color={BRAND.ink} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.editBannerTitle}>EDITING ORDER</Text>
              <Text style={styles.editBannerText}>Your previously uploaded photos are kept — tap to replace any.</Text>
            </View>
          </View>
        ) : null}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6E6E6', padding: 11, marginTop: 6, ...cardShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ height: 34, width: 34, borderRadius: 11, backgroundColor: BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
              <ImageIcon size={17} color={BRAND.green} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: BRAND.ink }}>Upload for Device Images</Text>
              <Text style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 1 }}>Maximum file size: 5 MB.</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {SLOTS.map((s) => {
              const url = images[s.key];
              const busy = uploading === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => pick(s.key)}
                  disabled={busy}
                  activeOpacity={0.85}
                  style={{
                    width: tileW, height: tileH, borderRadius: 12, overflow: 'hidden',
                    borderWidth: url ? 1 : 1.5, borderStyle: url ? 'solid' : 'dashed', borderColor: url ? BRAND.line : BRAND.greenLine,
                    backgroundColor: BRAND.bg, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={BRAND.green} />
                  ) : url ? (
                    <>
                      <Image source={{ uri: url }} style={styles.slotImg} resizeMode="cover" />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => remove(s.key)} accessibilityLabel={`Remove ${display(s.label)}`}>
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.slotLabelOverlay} numberOfLines={1}>{display(s.label)}</Text>
                    </>
                  ) : (
                    <>
                      <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: BRAND.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                        <CloudUpload size={17} color={BRAND.green} />
                      </View>
                      <Text style={{ fontSize: rf(11), fontWeight: '700', color: BRAND.ink, textAlign: 'center', paddingHorizontal: 4 }} numberOfLines={2}>{display(s.label)}</Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Device Condition — the same free-text field and state as before. */}
          <Text style={{ fontSize: rf(11.5), color: BRAND.muted, marginTop: 10, marginBottom: 6 }}>Device Condition</Text>
          <TextInput
            value={condition}
            onChangeText={setCondition}
            placeholder="Device Condition"
            placeholderTextColor={BRAND.muted}
            style={{ height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E6E6E6', backgroundColor: BRAND.bg, paddingHorizontal: 12, fontSize: rf(13), color: BRAND.ink, outlineStyle: 'none' }}
          />
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 10) + 6, shadowColor: BRAND.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }]}>
        <FlowCta palette={BRAND_FLOW} title="Continue" disabled={!!uploading} onPress={onContinue} />
      </View>
    </View>
  );
}
