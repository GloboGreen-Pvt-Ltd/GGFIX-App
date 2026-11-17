import React from 'react';
import { Text, View } from 'react-native';
import { Box, Check, HandHelping, Package, Store, Truck } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { BUY_STATUS_LABEL } from '../../../api/buyOrders';

const TEAL = '#035C6C';
const INK = '#111111';
const LINE = '#E8EAEE';

// Backend flow (marketplace FixedPriceOrderService):
//  home delivery: PLACED → CONFIRMED → ASSIGNED → ACCEPTED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
//  visit shop:    PLACED → CONFIRMED → COMPLETED (shop "handover": paid in store + OTP)
const HOME_ORDER = ['PLACED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const HOME_STEPS = [['PLACED', 'Placed', Package], ['CONFIRMED', 'Confirmed', Store], ['OUT_FOR_DELIVERY', 'Out for Delivery', Truck], ['DELIVERED', 'Delivered', HandHelping]];
const VISIT_ORDER = ['PLACED', 'CONFIRMED', 'COMPLETED'];
const VISIT_STEPS = [['PLACED', 'Placed', Package], ['CONFIRMED', 'Confirmed', Store], ['COMPLETED', 'Paid & Collected', HandHelping]];
export const CLOSED_STATUSES = ['REJECTED', 'CANCELLED', 'RETURNED', 'DELIVERY_FAILED'];

// Live backend fulfilmentType values: HOME_DELIVERY | VISIT_SHOP.
export const isVisitShop = (o) => String(o?.fulfilmentType || o?.fulfilment || '').toUpperCase() === 'VISIT_SHOP';

// Receipt only once the product has actually reached the customer:
// home → DELIVERED only; visit shop → COMPLETED only (shop handover verifies payment + OTP
// and sets paymentStatus PAID). COMPLETED never follows DELIVERED on the backend.
export const receiptReady = (o) => {
  if (!o) return false;
  const s = String(o.status || '').toUpperCase();
  const pay = String(o.paymentStatus || '').toUpperCase();
  if (pay && pay !== 'PAID') return false;
  return isVisitShop(o) ? s === 'COMPLETED' : s === 'DELIVERED';
};

// Horizontal status card ("Order Status") — only real reached/current steps highlighted.
export default function BuyStatusSteps({ status, visitShop = false, style }) {
  const s = String(status || 'PLACED').toUpperCase();
  const order = visitShop ? VISIT_ORDER : HOME_ORDER;
  const steps = visitShop ? VISIT_STEPS : HOME_STEPS;
  const reached = order.indexOf(s);
  const closed = CLOSED_STATUSES.includes(s);
  const done = steps.map(([k]) => reached >= 0 && reached >= order.indexOf(k));
  const current = closed ? -1 : done.indexOf(false);
  return (
    <View style={[{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 14, marginBottom: 12, paddingVertical: 16 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <Box size={20} color={TEAL} strokeWidth={2} />
        <Text style={{ marginLeft: 8, fontSize: rf(14.5), fontWeight: '800', color: TEAL }}>Order Status</Text>
      </View>
      {closed ? (
        <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#C62828', textAlign: 'center' }}>{BUY_STATUS_LABEL[s] || s}</Text>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          {steps.map(([k, label, Icon], i) => {
            const isDone = done[i];
            const isCur = i === current;
            return (
              <View key={k} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                  <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : isDone || isCur ? TEAL : LINE }} />
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDone ? TEAL : isCur ? '#E5F3F5' : '#FFFFFF', borderWidth: 1.5, borderColor: isDone || isCur ? TEAL : '#C9D0DA', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={19} color={isDone ? '#FFFFFF' : isCur ? TEAL : '#7A8596'} strokeWidth={1.8} />
                    {isDone ? (
                      <View style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#0A8A9E', borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={9} color="#FFFFFF" strokeWidth={3.5} />
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? 'transparent' : done[i + 1] || i + 1 === current ? TEAL : LINE }} />
                </View>
                <Text style={{ fontSize: rf(10.5), fontWeight: isDone || isCur ? '800' : '600', color: isDone || isCur ? INK : '#9AA4B2', marginTop: 6, textAlign: 'center' }} numberOfLines={2}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
