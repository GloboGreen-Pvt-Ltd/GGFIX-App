import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, Trash2, ShoppingCart, ShieldCheck, Truck, Minus, Plus } from 'lucide-react-native';
import {
  Card,
  Loader,
  EmptyState,
  BottomActionBar,
  PriceRow,
  PriceDivider,
  Badge,
  useBottomBarInset,
} from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { getCart, removeCartItem, updateCartItem, clearCart } from '../../../api/marketplace';
import { createBuyOrder } from '../../../api/orders';
import { rf } from '../../../utils/responsive';

const cartTotal = (list) =>
  list.reduce((sum, it) => sum + (Number(it.product?.price) || 0) * (it.quantity || 1), 0);

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
      await createBuyOrder({ items: payloadItems, totalAmount: cartTotal(items) });
      await clearCart().catch(() => {});
      setItems([]);
      notify('Order placed', 'Your order has been placed. Track it in My Orders.');
      navigation.navigate('MyOrders', { initialTab: 'Buy', initialStatus: 'Pending' });
    } catch (e) {
      notify('Checkout failed', e.message || 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <Loader label="Loading your cart..." />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<ShoppingCart size={28} color="#00008B" />}
        title="Your cart is empty"
        description="Browse our refurbished collection to get started."
        actionLabel="Start shopping"
        onAction={() => navigation.navigate('Buy')}
      />
    );
  }

  const subtotal = items.reduce((sum, it) => sum + (Number(it.product?.price) || 0) * (it.quantity || 1), 0);
  const shipping = 0;
  const total = subtotal + shipping;

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
        {items.map((it) => {
          const p = it.product || {};
          return (
            <Card key={it.id} className="rounded-2xl mb-3">
              <View className="flex-row">
                <View className="h-24 w-20 rounded-xl bg-primary/10 items-center justify-center mr-3 overflow-hidden">
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: rf(28) }}>📱</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }} numberOfLines={2}>{p.title}</Text>
                  <View className="flex-row flex-wrap mt-1">
                    {p.storageLabel ? (
                      <Badge variant="muted" className="mr-1.5 mb-1">{p.storageLabel}</Badge>
                    ) : null}
                    {p.color ? (
                      <Badge variant="muted" className="mr-1.5 mb-1">{p.color}</Badge>
                    ) : null}
                  </View>
                  <Text className="font-extrabold text-primary mt-2" style={{ fontSize: rf(16) }}>
                    ₹{(p.price || 0).toLocaleString?.() || p.price}
                  </Text>
                  {/* Quantity stepper */}
                  <View className="flex-row items-center mt-2">
                    <Pressable
                      onPress={() => onQty(it, -1)}
                      disabled={(it.quantity || 1) <= 1}
                      className={`h-7 w-7 rounded-lg border border-border items-center justify-center ${(it.quantity || 1) <= 1 ? 'opacity-40' : 'active:opacity-70'}`}
                    >
                      <Minus size={14} color="#0F172A" />
                    </Pressable>
                    <Text className="mx-3 font-extrabold text-text" style={{ fontSize: rf(14) }}>{it.quantity || 1}</Text>
                    <Pressable
                      onPress={() => onQty(it, 1)}
                      className="h-7 w-7 rounded-lg border border-border items-center justify-center active:opacity-70"
                    >
                      <Plus size={14} color="#0F172A" />
                    </Pressable>
                  </View>
                </View>
              </View>
              <View className="flex-row mt-3 -mx-1 pt-2 border-t border-border">
                <Pressable
                  onPress={() => navigation.navigate('BuyProductDetails', { productId: p.id })}
                  className="flex-1 flex-row items-center justify-center py-2 active:opacity-70"
                >
                  <Eye size={14} color="#00008B" />
                  <Text className="ml-1.5 font-bold text-primary" style={{ fontSize: rf(12) }}>View</Text>
                </Pressable>
                <Pressable
                  onPress={() => onRemove(it.id)}
                  className="flex-1 flex-row items-center justify-center py-2 active:opacity-70 border-l border-border"
                >
                  <Trash2 size={14} color="#EF4444" />
                  <Text className="ml-1.5 font-bold text-danger" style={{ fontSize: rf(12) }}>Remove</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}

        <Card className="rounded-2xl mb-3">
          <Text className="font-extrabold text-text mb-2" style={{ fontSize: rf(14) }}>Order Summary</Text>
          <PriceRow label={`Subtotal (${items.length} item${items.length > 1 ? 's' : ''})`} value={`₹${subtotal.toLocaleString()}`} />
          <PriceRow label="Shipping" value={shipping ? `₹${shipping}` : 'FREE'} valueClassName={shipping ? '' : 'text-success font-bold'} />
          <PriceDivider />
          <PriceRow label="Total" value={`₹${total.toLocaleString()}`} bold />
        </Card>

        <View className="flex-row">
          <View className="flex-1 bg-card border border-border rounded-2xl p-3 mr-2 flex-row items-center">
            <ShieldCheck size={16} color="#004C40" />
            <Text className="font-bold text-text ml-2" style={{ fontSize: rf(11) }}>6-month warranty</Text>
          </View>
          <View className="flex-1 bg-card border border-border rounded-2xl p-3 ml-2 flex-row items-center">
            <Truck size={16} color="#2563EB" />
            <Text className="font-bold text-text ml-2" style={{ fontSize: rf(11) }}>Free delivery</Text>
          </View>
        </View>
      </ScrollView>

      <BottomActionBar
        priceCaption="Total"
        priceValue={`₹${total.toLocaleString()}`}
        priceLabel={`${items.length} item${items.length > 1 ? 's' : ''}`}
        title={placing ? 'Placing…' : 'Checkout'}
        onPress={onCheckout}
        loading={placing}
        disabled={placing || !items.length}
      />
    </View>
  );
}
