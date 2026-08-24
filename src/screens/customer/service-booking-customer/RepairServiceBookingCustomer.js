import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import colors from '../../../theme/colors';
import BackButton from '../../../components/BackButton';

import RepairSelectDeviceScreen from './RepairSelectDeviceScreen';
import RepairSelectServiceScreen from './RepairSelectServiceScreen';
import RepairReviewScreen from './RepairReviewScreen';
import RepairServiceOptionsScreen from './RepairServiceOptionsScreen';
import RepairPickupShopsScreen from './RepairPickupShopsScreen';
import RepairShopDetailsScreen from './RepairShopDetailsScreen';
import RepairSelectAddressScreen from './RepairSelectAddressScreen';
import RepairPickupSlotScreen from './RepairPickupSlotScreen';
import RepairCompleteOrderScreen from './RepairCompleteOrderScreen';
import RepairConfirmationScreen from './RepairConfirmationScreen';
import RepairOrderDetailsScreen from './RepairOrderDetailsScreen';
import ServiceTicketDetailsScreen from './ServiceTicketDetailsScreen';
import RepairOrderHistoryScreen from './RepairOrderHistoryScreen';
import RepairPickupStatusScreen from './RepairPickupStatusScreen';
import RepairEstimateScreen from './RepairEstimateScreen';
import ServiceReceiptScreen from './ServiceReceiptScreen';
import InvoiceReceiptScreen from './InvoiceReceiptScreen';
import ShopChatScreen from './ShopChatScreen';
import { rf } from '../../../utils/responsive';

const Stack = createNativeStackNavigator();

export default function RepairServiceBookingCustomer() {
  return (
    <Stack.Navigator
      initialRouteName="RepairSelectDevice"
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.headerBg, height: 52 },
        headerShadowVisible: false,
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontSize: rf(15), fontWeight: '700', color: colors.headerText },
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.background },
        headerLeft: () => {
          if (!navigation.canGoBack()) return null;
          return <BackButton onPress={() => navigation.goBack()} />;
        },
        headerBackVisible: false,
      })}
    >
      <Stack.Screen name="RepairSelectDevice" component={RepairSelectDeviceScreen} options={{ title: 'Select Device' }} />
      <Stack.Screen name="RepairSelectService" component={RepairSelectServiceScreen} options={{ title: 'Select Repair Service' }} />
      <Stack.Screen name="RepairReview" component={RepairReviewScreen} options={{ title: 'Review Report' }} />
      <Stack.Screen name="RepairServiceOptions" component={RepairServiceOptionsScreen} options={{ title: 'Service Options' }} />
      <Stack.Screen name="RepairPickupShops" component={RepairPickupShopsScreen} options={{ title: 'Pickup Service Shop' }} />
      <Stack.Screen name="RepairShopDetails" component={RepairShopDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RepairSelectAddress" component={RepairSelectAddressScreen} options={{ title: 'Select Address' }} />
      <Stack.Screen name="RepairPickupSlot" component={RepairPickupSlotScreen} options={{ title: 'Select Pickup Slot' }} />
      <Stack.Screen name="RepairCompleteOrder" component={RepairCompleteOrderScreen} options={{ title: 'Complete Order' }} />
      <Stack.Screen name="RepairConfirmation" component={RepairConfirmationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RepairOrderDetails" component={RepairOrderDetailsScreen} options={{ title: 'View Details' }} />
      <Stack.Screen name="ServiceTicketDetails" component={ServiceTicketDetailsScreen} options={{ title: 'View Details' }} />
      <Stack.Screen name="RepairOrderHistory" component={RepairOrderHistoryScreen} options={{ title: 'Service History' }} />
      <Stack.Screen name="RepairPickupStatus" component={RepairPickupStatusScreen} options={{ title: 'Pickup Status' }} />
      <Stack.Screen name="RepairEstimate" component={RepairEstimateScreen} options={{ title: 'Repair Estimate' }} />
      <Stack.Screen name="ServiceReceipt" component={ServiceReceiptScreen} options={{ title: 'Receipt' }} />
      <Stack.Screen name="InvoiceReceipt" component={InvoiceReceiptScreen} options={{ title: 'Invoice Receipt' }} />
      <Stack.Screen name="ShopChat" component={ShopChatScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
