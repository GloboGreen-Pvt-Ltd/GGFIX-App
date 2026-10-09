import React from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { BadgeCheck, ShoppingBag, Smartphone, ChevronRight, Receipt, Store, PackageSearch, ClipboardCheck } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { goToTab } from '../../../navigation/goToTab';
import { BRAND } from '../../../theme/brand';
import { SuccessHero, SuccessCard, StatusPill, NextSteps, SuccessActions, GREEN_TEXT, MUTED } from '../../../components/SuccessChrome';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const humanize = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const STEPS = [
  { icon: ClipboardCheck, state: 'done', title: 'Order placed', sub: 'Sent to the shop' },
  { icon: Store, state: 'wait', title: 'Shop confirms', sub: "We'll notify you once it's confirmed" },
  { icon: PackageSearch, state: 'todo', title: 'Track your order', sub: 'Anytime in My Orders › Buy' },
];

// Buy "submitted" page, shown after My Cart checkout. Params (from MyCartScreen):
// order = the POST /customer-orders/buy response, items = the cart snapshot, total.
export default function BuyOrderSuccessScreen({ navigation, route }) {
  const order = route?.params?.order || {};
  const items = route?.params?.items || [];
  const total = route?.params?.total ?? items.reduce((s, it) => s + (Number(it.price) || 0) * (it.quantity || 1), 0);
  const orderNo = order.orderNumber ? String(order.orderNumber).replace(/^#+/, '') : null;
  const status = order.phaseLabel || (order.status ? humanize(order.status) : null);
  const count = items.reduce((s, it) => s + (it.quantity || 1), 0);
  const notified = route?.params?.notifiedShops || [];

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <SuccessHero
          title="Order Placed!"
          subtitle={notified.length
            ? `Your name, phone & address were sent to ${notified.join(', ')}. Track it in My Orders.`
            : 'Your order has been placed. Track it in My Orders.'}
          chips={[
            orderNo ? { icon: BadgeCheck, text: `#${orderNo}`, selectable: true } : null,
            status ? { text: `Status: ${status}` } : null,
          ].filter(Boolean)}
        />

        {/* Cards overlap the hero's lower edge */}
        <View style={{ paddingHorizontal: 14, marginTop: -30 }}>
          {items.length ? (
            <SuccessCard raised icon={Receipt} title="Order Summary" right={<StatusPill tone="green" text={`${count} item${count === 1 ? '' : 's'}`} />}>
              {items.map((it, i) => (
                <View key={it.id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BRAND.line }}>
                  <View style={{ height: 42, width: 42, borderRadius: 10, backgroundColor: BRAND.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 9 }}>
                    {it.imageUrl ? (
                      <Image source={{ uri: it.imageUrl }} style={{ width: 38, height: 38 }} resizeMode="contain" />
                    ) : (
                      <Smartphone size={18} color={GREEN_TEXT} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={2}>{it.title || 'Product'}</Text>
                    <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }} numberOfLines={1}>
                      {[it.storageLabel, it.color, `Qty ${it.quantity || 1}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: GREEN_TEXT, marginLeft: 8 }}>{inr((Number(it.price) || 0) * (it.quantity || 1))}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 9 }}>
                <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '700', color: BRAND.ink }}>Total</Text>
                <Text style={{ fontSize: rf(16), fontWeight: '900', color: BRAND.ink }}>{inr(total)}</Text>
              </View>
            </SuccessCard>
          ) : null}

          <NextSteps steps={STEPS} />
        </View>
      </ScrollView>

      <SuccessActions
        secondary={{ label: 'Shop more', icon: ShoppingBag, onPress: () => goToTab(navigation, 'Buy') }}
        primary={{ label: 'View My Orders', trailing: ChevronRight, onPress: () => navigation.replace('MyOrders', { initialTab: 'Buy', initialStatus: 'Pending' }) }}
      />
    </View>
  );
}
