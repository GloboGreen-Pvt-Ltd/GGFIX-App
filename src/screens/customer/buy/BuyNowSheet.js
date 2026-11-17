import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fulfilmentOf } from '../../../api/buyOrders';
import { listAddresses } from '../../../api/customer';
import { rf } from '../../../utils/responsive';

/**
 * Buy Now bottom sheet — replaces Select Fulfillment for a single product.
 * onContinue({ mode, addressId }) → caller navigates to BuyPlaceOrder with the
 * same params BuyFulfillment passes ({ items, mode }) plus the chosen addressId.
 */
const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const addrText = (a) => [a.addressLine, a.area || a.locality, a.taluk, a.district || a.city, a.state, a.pincode].filter(Boolean).join(', ');

export default function BuyNowSheet({ visible, product, total, onClose, onContinue, onManageAddress }) {
  const insets = useSafeAreaInsets();
  const f = fulfilmentOf(product);
  const canHome = f.home;
  const canShop = f.shop || !canHome; // server accepts VISIT_SHOP for any active listing
  const [mode, setMode] = useState(null);
  const [saved, setSaved] = useState([]);
  const [addrId, setAddrId] = useState(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    setMode((m) => m || (canHome ? 'HOME_DELIVERY' : 'VISIT_SHOP'));
    let live = true;
    listAddresses().then((list) => {
      if (!live || !Array.isArray(list)) return;
      setSaved(list);
      setAddrId((cur) => (cur && list.some((a) => a.id === cur) ? cur : (list.find((a) => a.isDefault) || list[0] || {}).id || null));
    }).catch(() => {});
    return () => { live = false; };
  }, [visible, canHome]);

  const addr = saved.find((a) => a.id === addrId);
  const home = mode === 'HOME_DELIVERY';
  const opts = [
    { key: 'VISIT_SHOP', icon: 'storefront-outline', title: 'Visit Shop & Buy', sub: 'Buy directly at the shop', ok: canShop },
    { key: 'HOME_DELIVERY', icon: 'home-outline', title: 'Home Delivery', sub: 'Estimated 1–2 days', ok: canHome },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.4)' }} />
      <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 4, maxHeight: '85%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: LINE, marginBottom: 12 }} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: rf(15), fontWeight: '800', color: INK, marginBottom: 10 }}>How would you like to buy?</Text>
          {opts.map((o) => {
            const on = mode === o.key;
            return (
              <Pressable key={o.key} onPress={() => o.ok && setMode(o.key)} disabled={!o.ok} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !o.ok }}
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: on ? 1.5 : 1, borderColor: on ? TEAL : LINE, backgroundColor: on ? '#EEF6F7' : '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 8, opacity: o.ok ? 1 : 0.5 }}>
                <View style={{ height: 38, width: 38, borderRadius: 10, backgroundColor: on ? TEAL : '#E6F0F2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={o.icon} size={19} color={on ? '#FFFFFF' : TEAL} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: INK }}>{o.title}</Text>
                  <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }}>{o.ok ? o.sub : 'Not offered for this product'}</Text>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? TEAL : '#B8C0CC'} />
              </Pressable>
            );
          })}

          {home ? (
            <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location-outline" size={17} color={TEAL} />
                <Text style={{ flex: 1, marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: INK }}>Delivery address</Text>
                <Pressable onPress={() => (saved.length ? setPicking((v) => !v) : onManageAddress())} hitSlop={8} accessibilityRole="button">
                  <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: TEAL }}>{saved.length ? (picking ? 'Done' : 'Change') : 'Add'}</Text>
                </Pressable>
              </View>
              {!picking ? (
                <Text style={{ fontSize: rf(12), color: addr ? INK : MUTED, marginTop: 6, lineHeight: rf(17) }} numberOfLines={2}>
                  {addr ? addrText(addr) : 'No saved address — you can enter one on the next step.'}
                </Text>
              ) : (
                <View style={{ marginTop: 6 }}>
                  {saved.map((a) => (
                    <Pressable key={a.id} onPress={() => { setAddrId(a.id); setPicking(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: LINE }}>
                      <Ionicons name={a.id === addrId ? 'radio-button-on' : 'radio-button-off'} size={18} color={a.id === addrId ? TEAL : '#B8C0CC'} />
                      <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(12), color: INK }} numberOfLines={2}>{addrText(a)}</Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={onManageAddress} style={{ paddingTop: 8, alignItems: 'center' }} accessibilityRole="button">
                    <Text style={{ fontSize: rf(12), fontWeight: '700', color: TEAL }}>Manage addresses</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            <Text style={{ flex: 1, fontSize: rf(13), color: MUTED }}>Total amount</Text>
            <Text style={{ fontSize: rf(17), fontWeight: '900', color: INK }}>{inr(total)}</Text>
          </View>
        </ScrollView>
        <Pressable onPress={() => mode && onContinue({ mode, addressId: home ? addrId : null })} disabled={!mode} accessibilityRole="button"
          style={{ height: 48, borderRadius: 14, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', marginTop: 12, opacity: mode ? 1 : 0.5 }}>
          <Text style={{ color: '#FFFFFF', fontSize: rf(15), fontWeight: '800' }}>Continue</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
