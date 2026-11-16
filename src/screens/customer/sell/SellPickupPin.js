import React from 'react';
import { Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { rf, rlh } from '../../../utils/responsive';

// The doorstep pickup PIN. Servers with the doorstep purchase flow return it in
// GET /sell-orders/{id}/purchase → pickup.pin while the pickup person is on the
// way, until they verify it at the door; it's shown only here, to the signed-in
// customer (never in a notification). Nothing renders when the server sends none.
const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = 'rgba(17,17,17,0.55)';

export default function SellPickupPin({ purchase, style }) {
  const pin = purchase?.pickup?.pin ? String(purchase.pickup.pin) : null;
  if (!pin) return null;
  return (
    <View style={[{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.2, borderColor: 'rgba(3,92,108,0.45)', paddingHorizontal: 10, paddingVertical: 8, marginVertical: 4 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ShieldCheck size={16} color={TEAL} />
        <Text style={{ flex: 1, marginLeft: 6, fontSize: rf(13), fontWeight: '800', color: INK }}>Pickup PIN</Text>
        <View style={{ flexDirection: 'row' }} accessibilityLabel={`Pickup PIN ${pin.split('').join(' ')}`}>
          {pin.split('').map((d, i) => (
            <View key={i} style={{ width: 28, height: 32, marginLeft: 4, borderRadius: 8, borderWidth: 1.2, borderColor: TEAL, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,92,108,0.06)' }}>
              <Text style={{ fontSize: rf(16), fontWeight: '900', color: TEAL }}>{d}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={{ marginTop: 5, fontSize: rf(10.5), lineHeight: rlh(14), color: MUTED }}>Share only with the pickup person at your door.</Text>
    </View>
  );
}
