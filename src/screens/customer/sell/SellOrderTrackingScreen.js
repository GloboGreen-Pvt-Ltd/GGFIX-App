import { useEffect } from 'react';

// The separate Sell Order Details / tracking screen is merged into Sell Device
// Details (Order Progress section). This route stays only as a redirect so old
// entry points (notifications, deep links, saved routes) land on the merged page.
export default function SellOrderTrackingScreen({ navigation, route }) {
  const sellOrderId = route?.params?.sellOrderId;
  useEffect(() => {
    navigation.replace('SellOrderDetails', { sellOrderId, focus: 'progress' });
  }, [navigation, sellOrderId]);
  return null;
}
