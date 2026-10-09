import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, Trash2, ShoppingCart, ShieldCheck, Truck, Minus, Plus, Smartphone, ChevronRight } from 'lucide-react-native';
import {
  Loader,
  EmptyState,
  BottomActionBar,
  Button,
  useBottomBarInset,
} from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { getCart, removeCartItem, updateCartItem, clearCart } from '../../../api/marketplace';
import { createBuyOrder } from '../../../api/orders';
import { useSelector } from 'react-redux';
import { selectSession } from '../../../store/authSlice';
import { notifyShopsOfBuyOrder } from '../../../utils/buyOrderNotify';
import { goToTab } from '../../../navigation/goToTab';
import { resolveDeviceImageSource } from '../../../utils/images';
import { BRAND } from '../../../theme/brand';
import { rf } from '../../../utils/responsive';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 };

const cartTotal = (list) =>
  list.reduce((sum, it) => sum + (Number(it.product?.price) || 0) * (it.quantity || 1), 0);

function Chip({ label }) {
  return (
    <View style={{ backgroundColor: BRAND.bg, borderWidth: 1, borderColor: BRAND.line, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, marginRight: 5, marginTop: 4 }}>
      <Text numberOfLines={1} style={{ fontSize: rf(10), color: BRAND.body, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function StepButton({ icon: Icon, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className={disabled ? '' : 'active:opacity-70'}
      style={{ height: 26, width: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, opacity: disabled ? 0.4 : 1 }}
    >
      <Icon size={13} color={BRAND.ink} />
    </Pressable>
  );
}

export default function MyCartScreen({ navigation }) {
  const bottomSpace = useBottomBarInset(96);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const session = useSelector(selectSession);

  const load = useCallback(async () => {
    try { setItems(await getCart()); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRemove = async (id) => {
    const ok = await confirm({ title: 'Remove', message: 'Remove this item from cart?', confirmText: 'Remove', destructive: true });
    if (!ok) return;
    try { await removeCartItem(id); load(); } catch (e) { notify('Error', e.message); }
  };

  // Optimistically bump quantity, then persist (min 1).
  const onQty = async (it, delta) => {
    const next = Math.max(1, (it.quantity || 1) + delta);
    if (next === (it.quantity || 1)) return;
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, quantity: next } : x)));
    try { await updateCartItem(it.id, next); } catch (e) { notify('Error', e.message || 'Could not update quantity'); load(); }
  };

  const onCheckout = async () => {
    if (placing || !items.length) return;
    setPlacing(true);
    try {
      const payloadItems = items.map((it) => ({
        productId: it.product?.id || it.productId,
        title: it.product?.title,
        price: Number(it.product?.price) || 0,
        quantity: it.quantity || 1,
      }));
      // Snapshot for the "Order Placed" page before the cart is cleared.
      const snapshot = items.map((it) => ({
        id: it.id,
        title: it.product?.title,
        price: Number(it.product?.price) || 0,
        quantity: it.quantity || 1,
        imageUrl: resolveDeviceImageSource({ url: it.product?.imageUrl }) || null,
        storageLabel: it.product?.storageLabel,
        color: it.product?.color,
      }));
      const total = cartTotal(items);
      const created = await createBuyOrder({ items: payloadItems, totalAmount: total });
      // Send the order + buyer name / phone / address to the seller's chat
      // (Partner app inbox). Best-effort; never blocks the order.
      const notifiedShops = await notifyShopsOfBuyOrder({
        order: created,
        cartItems: items,
        buyer: { fullName: session?.fullName, mobile: session?.mobile },
      });
      await clearCart().catch(() => {});
      setItems([]);
      navigation.replace('BuyOrderSuccess', { order: created || {}, items: snapshot, total, notifiedShops });
    } catch (e) {
      notify('Checkout failed', e.message || 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <Loader label="Loading your cart..." />;
  if (!items.length) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <EmptyState
          icon={<ShoppingCart size={30} color={BRAND.green} />}
          accent={BRAND.green}
          accentSoft="#EAF8EC"
          title="Your cart is empty"
          description="Browse our refurbished collection to get started."
          actionLabel="Start shopping"
          onAction={() => goToTab(navigation, 'Buy')}
        />
      </View>
    );
  }

  const subtotal = items.reduce((sum, it) => sum + (Number(it.product?.price) || 0) * (it.quantity || 1), 0);
  const shipping = 0;
  const total = subtotal + shipping;
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
        {items.map((it) => {
          const p = it.product || {};
          const img = resolveDeviceImageSource({ url: p.imageUrl });
          const qty = it.quantity || 1;
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

              {/* Quantity stepper · View · Remove */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BRAND.line }}>
                <StepButton icon={Minus} onPress={() => onQty(it, -1)} disabled={qty <= 1} />
                <Text style={{ minWidth: 28, textAlign: 'center', fontSize: rf(13), fontWeight: '800', color: BRAND.ink }}>{qty}</Text>
                <StepButton icon={Plus} onPress={() => onQty(it, 1)} />
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

        <View style={{ flexDirection: 'row' }}>
          {[
            { icon: ShieldCheck, label: '6-month warranty', color: BRAND.green, bg: '#EAF8EC' },
            { icon: Truck, label: 'Free delivery', color: BRAND.yellow, bg: '#FEF6DA' },
          ].map((t, i) => {
            const Icon = t.icon;
            return (
              <View key={t.label} style={{ flex: 1, marginLeft: i ? 8 : 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 9 }}>
                <View style={{ height: 26, width: 26, borderRadius: 13, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
                  <Icon size={14} color={t.color} />
                </View>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: rf(11), fontWeight: '700', color: BRAND.ink }}>{t.label}</Text>
              </View>
            );
          })}
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
