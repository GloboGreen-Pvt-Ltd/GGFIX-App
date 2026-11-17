import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, Trash2, ShoppingCart, Smartphone, ChevronRight } from 'lucide-react-native';
import {
  Loader,
  EmptyState,
  BottomActionBar,
  Button,
  useBottomBarInset,
} from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { getCart, removeCartItem } from '../../../api/marketplace';
import { goToTab } from '../../../navigation/goToTab';
import { resolveDeviceImageSource } from '../../../utils/images';
import { BRAND } from '../../../theme/brand';
import { rf } from '../../../utils/responsive';

const GREEN_TEXT = '#035C6C'; // #035C6C shaded for text on white
const LINE = '#E8EAEE';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 };


function Chip({ label }) {
  return (
    <View style={{ backgroundColor: BRAND.bg, borderWidth: 1, borderColor: BRAND.line, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, marginRight: 5, marginTop: 4 }}>
      <Text numberOfLines={1} style={{ fontSize: rf(10), color: BRAND.body, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export default function MyCartScreen({ navigation }) {
  const bottomSpace = useBottomBarInset(96);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await getCart()); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRemove = async (id) => {
    const ok = await confirm({ title: 'Remove', message: 'Remove this item from cart?', confirmText: 'Remove', destructive: true });
    if (!ok) return;
    try { await removeCartItem(id); load(); } catch (e) { notify('Error', e.message); }
  };

  // Checkout → Place Order (pickup choice + price details); it places the
  // order, messages the shop and clears the cart.
  const onCheckout = () => {
    if (placing || !items.length) return;
    navigation.navigate('BuyPlaceOrder', { items: items.map((x) => ({ ...x, quantity: 1 })), fromCart: true });
  };

  if (loading) return <Loader label="Loading your cart..." />;
  if (!items.length) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <EmptyState
          icon={<ShoppingCart size={30} color={BRAND.green} />}
          accent={BRAND.green}
          accentSoft="#E5F3F5"
          title="Your cart is empty"
          description="Browse our refurbished collection to get started."
          actionLabel="Start shopping"
          onAction={() => goToTab(navigation, 'Buy')}
        />
      </View>
    );
  }

  const subtotal = items.reduce((sum, it) => sum + (Number(it.product?.price) || 0) , 0);
  const shipping = 0;
  const total = subtotal + shipping;
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
        {items.map((it) => {
          const p = it.product || {};
          const img = resolveDeviceImageSource({ url: p.imageUrl });
          return (
            <View key={it.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 10, marginBottom: 10, ...cardShadow }}>
              <Pressable
                onPress={() => navigation.navigate('BuyProductDetails', { productId: p.id })}
                className="active:opacity-90"
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ height: 64, width: 64, borderRadius: 12, backgroundColor: BRAND.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 }}>
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: 58, height: 58 }} resizeMode="contain" />
                  ) : (
                    <Smartphone size={24} color={BRAND.green} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ fontSize: rf(13), fontWeight: '800', color: BRAND.ink }}>{p.title}</Text>
                  {(p.storageLabel || p.color) ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {p.storageLabel ? <Chip label={p.storageLabel} /> : null}
                      {p.color ? <Chip label={p.color} /> : null}
                    </View>
                  ) : null}
                  <Text style={{ fontSize: rf(14), fontWeight: '800', color: GREEN_TEXT, marginTop: 4 }}>{inr(p.price)}</Text>
                </View>
                <ChevronRight size={16} color={BRAND.muted} />
              </Pressable>

              {/* View · Remove */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BRAND.line }}>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => navigation.navigate('BuyProductDetails', { productId: p.id })}
                  className="active:opacity-70"
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <Eye size={14} color={BRAND.green} />
                  <Text style={{ marginLeft: 4, fontSize: rf(11.5), fontWeight: '700', color: BRAND.ink }}>View</Text>
                </Pressable>
                <View style={{ width: 1, height: 16, backgroundColor: LINE }} />
                <Pressable
                  onPress={() => onRemove(it.id)}
                  className="active:opacity-70"
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <Trash2 size={14} color={BRAND.red} />
                  <Text style={{ marginLeft: 4, fontSize: rf(11.5), fontWeight: '700', color: BRAND.red }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* Order summary */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 12, marginBottom: 10, ...cardShadow }}>
          <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink, marginBottom: 6 }}>Order Summary</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ fontSize: rf(12.5), color: BRAND.muted }}>{`Subtotal (${items.length} item${items.length > 1 ? 's' : ''})`}</Text>
            <Text style={{ fontSize: rf(12.5), color: BRAND.ink, fontWeight: '600' }}>{inr(subtotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ fontSize: rf(12.5), color: BRAND.muted }}>Shipping</Text>
            <Text style={{ fontSize: rf(12.5), color: shipping ? BRAND.ink : GREEN_TEXT, fontWeight: '700' }}>{shipping ? inr(shipping) : 'FREE'}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: BRAND.line, marginVertical: 6 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: rf(13.5), color: BRAND.ink, fontWeight: '800' }}>Total</Text>
            <Text style={{ fontSize: rf(13.5), color: BRAND.ink, fontWeight: '800' }}>{inr(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <BottomActionBar
        priceCaption="Total"
        priceValue={`₹${total.toLocaleString()}`}
        priceLabel={`${items.length} item${items.length > 1 ? 's' : ''}`}
      >
        <Button
          onPress={onCheckout}
          loading={placing}
          disabled={placing || !items.length}
          className="w-full"
          style={{ backgroundColor: BRAND.green, shadowColor: BRAND.green }}
          rightIcon={<ChevronRight size={18} color="#fff" />}
        >
          {placing ? 'Placing…' : 'Checkout'}
        </Button>
      </BottomActionBar>
    </View>
  );
}
