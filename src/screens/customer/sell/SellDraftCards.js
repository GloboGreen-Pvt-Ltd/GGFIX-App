import React, { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Smartphone } from 'lucide-react-native';
import { confirm } from '../../../components/confirm';
import { sellOrderImage } from '../../../utils/sellImage';
import { listSellDrafts, deleteSellDraft, continueSellDraft } from './sellDraft';
import { ago } from './useSellOrder';

const TEAL = '#035C6C';

// "Continue Selling": the signed-in customer's saved sell drafts (this phone only),
// re-read on focus. Renders nothing when there are none.
export default function SellDraftCards({ navigation, style }) {
  const [list, setList] = useState([]);
  useFocusEffect(useCallback(() => {
    let off = false;
    listSellDrafts().then((l) => { if (!off) setList(l || []); });
    return () => { off = true; };
  }, []));
  if (!list.length) return null;

  const onDelete = async (d) => {
    const ok = await confirm({ title: 'Delete draft', message: `Discard your saved sell progress for ${d.deviceName || 'this device'}?`, confirmText: 'Delete', destructive: true });
    if (!ok) return;
    await deleteSellDraft(d.id);
    setList((l) => l.filter((x) => x.id !== d.id));
  };

  return (
    <View style={style}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: TEAL, letterSpacing: 0.4, marginBottom: 6 }}>CONTINUE SELLING</Text>
      {list.map((d) => {
        const img = sellOrderImage({ images: d.images, device: { imageUrl: d.imageUrl } }, null);
        const total = d.totalSteps || 5;
        const step = Math.max(0, Math.min(d.step || 0, total));
        return (
          <View key={d.id} style={{ marginBottom: 6, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#D5E7EA', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#F1F7F8', alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' }}>
              {img ? <Image source={{ uri: img }} style={{ width: 40, height: 40 }} resizeMode="contain" /> : <Smartphone size={20} color={TEAL} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
              <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: '#1C3053' }}>{d.deviceName || 'Your device'}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: '#606E87', marginTop: 1 }}>
                {step ? `Step ${step} of ${total}` : 'Device selected'} · Edited {ago(d.updatedAt)}
              </Text>
              <View style={{ height: 3, borderRadius: 2, backgroundColor: '#E5EEF0', marginTop: 5 }}>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: TEAL, width: `${Math.round((step / total) * 100)}%` }} />
              </View>
            </View>
            <Pressable onPress={() => onDelete(d)} accessibilityRole="button" accessibilityLabel="Delete draft" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#F32C26' }}>Delete</Text>
            </Pressable>
            <Pressable onPress={() => continueSellDraft(navigation, d)} accessibilityRole="button" accessibilityLabel="Continue selling" style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: TEAL }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Continue</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
