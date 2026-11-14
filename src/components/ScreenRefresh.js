import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScreenRefreshContext } from '../shims/react-native';

// Screens where a pull would discard typed input — no auto pull-to-refresh.
const NO_REFRESH = new Set([
  'AddressForm', 'EditProfile', 'ShopChat', 'BuyPlaceOrder', 'RepairCompleteOrder',
  'SellImages', 'SellAddress', 'SellSchedulePickup', 'Search',
  // Own refresh; a remount would reset the open order-details view.
  'BuyFixedOrder', 'BuyOrderDetails',
]);

// Navigator `screenLayout`: pull down on a screen → it remounts, so its own
// load effects run again with fresh data (no per-screen wiring needed).
export function ScreenRefresh({ route, children }) {
  const [key, setKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setKey((k) => k + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRefreshing(false), 700);
  }, []);
  const value = useMemo(() => ({ refreshing, onRefresh }), [refreshing, onRefresh]);
  if (NO_REFRESH.has(route?.name)) return children;
  return (
    <ScreenRefreshContext.Provider value={value}>
      <React.Fragment key={key}>{children}</React.Fragment>
    </ScreenRefreshContext.Provider>
  );
}

export const screenRefreshLayout = ({ route, children }) => <ScreenRefresh route={route}>{children}</ScreenRefresh>;
