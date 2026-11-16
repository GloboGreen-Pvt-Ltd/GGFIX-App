import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import colors from '../theme/colors';
import PageHeader from '../components/PageHeader';
import { HEADER_SUBTITLES } from './headerSubtitles';
import CustomTabBar from './CustomTabBar';

// Tab root screens
import HomeScreen from '../screens/customer/HomeScreen';
import CategoryServiceMenuScreen from '../screens/customer/CategoryServiceMenuScreen';
import SellHomeScreen from '../screens/customer/sell/SellHomeScreen';
import BuyHomeScreen from '../screens/customer/buy/BuyHomeScreen';
import RepairHomeScreen from '../screens/customer/service-booking-customer/RepairHomeScreen';
import ProfileScreen from '../screens/customer/profile/ProfileScreen';

// Profile screens
import EditProfileScreen from '../screens/customer/profile/EditProfileScreen';
import ManageAddressScreen from '../screens/customer/profile/ManageAddressScreen';
import AddressFormScreen from '../screens/customer/profile/AddressFormScreen';
import ManageDeviceScreen from '../screens/customer/profile/ManageDeviceScreen';
import CustomerSupportScreen from '../screens/customer/profile/CustomerSupportScreen';
import AboutUsScreen from '../screens/customer/profile/AboutUsScreen';
import LegalDocumentScreen from '../legal/LegalDocumentScreen';
import FaqScreen from '../screens/customer/profile/FaqScreen';
import MyOrdersScreen from '../screens/customer/profile/MyOrdersScreen';
import MyCartScreen from '../screens/customer/profile/MyCartScreen';
import NotificationsScreen from '../screens/customer/profile/NotificationsScreen';

// Device wizard (shared by Profile / Sell / Repair)
import SelectCategoryScreen from '../screens/customer/device/SelectCategoryScreen';
import DeviceDetailsScreen from '../screens/customer/device/DeviceDetailsScreen';
import SelectBrandScreen from '../screens/customer/device/SelectBrandScreen';
import SelectSeriesScreen from '../screens/customer/device/SelectSeriesScreen';
import SelectModelScreen from '../screens/customer/device/SelectModelScreen';
import SelectVariantScreen from '../screens/customer/device/SelectVariantScreen';

// Repair flow (Mobile Repair end-to-end wizard lives in repair/)
import RepairSelectDeviceScreen from '../screens/customer/service-booking-customer/RepairSelectDeviceScreen';
import RepairSelectServiceScreen from '../screens/customer/service-booking-customer/RepairSelectServiceScreen';
import RepairReviewScreen from '../screens/customer/service-booking-customer/RepairReviewScreen';
import RepairServiceOptionsScreen from '../screens/customer/service-booking-customer/RepairServiceOptionsScreen';
import RepairPickupShopsScreen from '../screens/customer/service-booking-customer/RepairPickupShopsScreen';
import RepairShopDetailsScreen from '../screens/customer/service-booking-customer/RepairShopDetailsScreen';
import RepairSelectAddressScreen from '../screens/customer/service-booking-customer/RepairSelectAddressScreen';
import RepairPickupSlotScreen from '../screens/customer/service-booking-customer/RepairPickupSlotScreen';
import RepairCompleteOrderScreen from '../screens/customer/service-booking-customer/RepairCompleteOrderScreen';
import RepairConfirmationScreen from '../screens/customer/service-booking-customer/RepairConfirmationScreen';
import PickupDetailsScreen from '../screens/customer/service-booking-customer/PickupDetailsScreen';
import ServiceTicketDetailsScreen from '../screens/customer/service-booking-customer/ServiceTicketDetailsScreen';
import RepairPickupStatusScreen from '../screens/customer/service-booking-customer/RepairPickupStatusScreen';
import RepairOrderHistoryScreen from '../screens/customer/service-booking-customer/RepairOrderHistoryScreen';
import RepairEstimateScreen from '../screens/customer/service-booking-customer/RepairEstimateScreen';
import ServiceReceiptScreen from '../screens/customer/service-booking-customer/ServiceReceiptScreen';
import InvoiceReceiptScreen from '../screens/customer/service-booking-customer/InvoiceReceiptScreen';
import ShopChatScreen from '../screens/customer/service-booking-customer/ShopChatScreen';
import CustomerChatInboxScreen from '../screens/customer/chat/CustomerChatInboxScreen';

// Sell flow
import SellSelectDeviceScreen from '../screens/customer/sell/SellSelectDeviceScreen';
import SellConditionScreen from '../screens/customer/sell/SellConditionScreen';
import SellScreeningScreen from '../screens/customer/sell/SellScreeningScreen';
import SellScreenConditionScreen from '../screens/customer/sell/SellScreenConditionScreen';
import SellFunctionalScreen from '../screens/customer/sell/SellFunctionalScreen';
import SellDeviceConfigScreen from '../screens/customer/sell/SellDeviceConfigScreen';
import SellAccessoriesWarrantyScreen from '../screens/customer/sell/SellAccessoriesWarrantyScreen';
import SellImagesScreen from '../screens/customer/sell/SellImagesScreen';
import SellAddressScreen from '../screens/customer/sell/SellAddressScreen';
import SellCompleteScreen from '../screens/customer/sell/SellCompleteScreen';
import SellOrderDetailsScreen from '../screens/customer/sell/SellOrderDetailsScreen';
import BuyOrderSuccessScreen from '../screens/customer/buy/BuyOrderSuccessScreen';
import SearchScreen from '../screens/customer/search/SearchScreen';
import ScanScreen from '../screens/customer/search/ScanScreen';
import SellQuotationScreen from '../screens/customer/sell/SellQuotationScreen';
import SellSelectShopScreen from '../screens/customer/sell/SellSelectShopScreen';
import SellQuoteRequestsScreen from '../screens/customer/sell/SellQuoteRequestsScreen';
import SellBuyerEnquiriesScreen from '../screens/customer/sell/SellBuyerEnquiriesScreen';
import SellQuotesReceivedScreen from '../screens/customer/sell/SellQuotesReceivedScreen';
import SellQuoteDetailsScreen from '../screens/customer/sell/SellQuoteDetailsScreen';
import SellFinalOfferScreen from '../screens/customer/sell/SellFinalOfferScreen';
import SellSchedulePickupScreen from '../screens/customer/sell/SellSchedulePickupScreen';
import SellOrderTrackingScreen from '../screens/customer/sell/SellOrderTrackingScreen';

// Buy flow
import BuyCategoryScreen from '../screens/customer/buy/BuyCategoryScreen';
import BuyListingScreen from '../screens/customer/buy/BuyListingScreen';
import BuyProductDetailsScreen from '../screens/customer/buy/BuyProductDetailsScreen';
import BuyPlaceOrderScreen from '../screens/customer/buy/BuyPlaceOrderScreen';
import BuyFulfillmentScreen from '../screens/customer/buy/BuyFulfillmentScreen';
import BuyDevicesScreen from '../screens/customer/buy/BuyDevicesScreen';
import BuyOrderDetailsScreen from '../screens/customer/buy/BuyOrderDetailsScreen';
import BuyFixedOrderScreen from '../screens/customer/buy/BuyFixedOrderScreen';

// Shop browse
import NearbyShopsScreen from '../screens/customer/shop/NearbyShopsScreen';
import ShopDetailsScreen from '../screens/customer/shop/ShopDetailsScreen';
import { screenRefreshLayout } from '../components/ScreenRefresh';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import DeliveryInvoiceReportScreen from '../screens/owner/AllBooking/DeliveryInvoiceReportScreen';

const Stack = createNativeStackNavigator();
// Buy order screens: a render error shows the message + Retry instead of closing.
const BuyOrderDetailsSafe = withScreenErrorBoundary(BuyOrderDetailsScreen, 'BuyOrderDetails');
const BuyFixedOrderSafe = withScreenErrorBoundary(BuyFixedOrderScreen, 'BuyFixedOrder');
const Tab = createBottomTabNavigator();

// `onLogout` is passed in from RootNavigator so the Profile tab can call the
// SAME callback that clears RootNavigator's local session state — without
// that, the Profile screen's local `dispatch(clearAuth())` only updates Redux
// while RootNavigator's useState keeps a stale token, leaving the user
// stranded on Profile after they tap Log out.
function CustomerTabs({ onLogout }) {
  return (
    <Tab.Navigator
      screenLayout={screenRefreshLayout}
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Repair" component={RepairHomeScreen} />
      <Tab.Screen name="Sell" component={SellHomeScreen} />
      <Tab.Screen name="Buy" component={BuyHomeScreen} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function CustomerNavigator({ session, onLogout }) {
  return (
    <Stack.Navigator
      screenLayout={screenRefreshLayout}
      screenOptions={{
        // Every stack page gets the same header: back · title + subtitle · action.
        // Screens can set `subtitle`, `headerRight` and `headerBackAction`
        // (replaces goBack, e.g. "always go Home") through their options;
        // `headerSideWidth` widens both side slots for a text action (e.g. Skip).
        header: ({ navigation, route, options, back }) => (
          <PageHeader
            title={options.title ?? route.name}
            subtitle={options.subtitle ?? HEADER_SUBTITLES[route.name]}
            onBack={options.headerBackAction || (back ? () => navigation.goBack() : undefined)}
            right={options.headerRight ? options.headerRight({ canGoBack: !!back }) : null}
            sideWidth={options.headerSideWidth}
          />
        ),
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="CustomerTabs" options={{ headerShown: false }}>
        {(props) => <CustomerTabs {...props} session={session} onLogout={onLogout} />}
      </Stack.Screen>

      {/* Category service menu (Repair / Sell / Buy for a tapped category) */}
      <Stack.Screen
        name="CategoryServiceMenu"
        component={CategoryServiceMenuScreen}
        options={({ route }) => ({ title: route.params?.categoryName || 'Our Service' })}
      />

      {/* Profile sub-flows */}
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="ManageAddress" component={ManageAddressScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ManageDevice" component={ManageDeviceScreen} options={{ title: 'Manage My Device' }} />
      <Stack.Screen name="CustomerSupport" component={CustomerSupportScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AboutUs" component={AboutUsScreen} options={{ title: 'About Us' }} />
      <Stack.Screen name="Terms" component={LegalDocumentScreen} initialParams={{ type: 'TERMS' }} options={{ headerShown: false }} />
      <Stack.Screen name="PrivacyPolicy" component={LegalDocumentScreen} initialParams={{ type: 'PRIVACY' }} options={{ headerShown: false }} />
      <Stack.Screen name="Faq" component={FaqScreen} options={{ title: 'FAQ' }} />
      {/* MyOrders renders its own AppHeader (title + subtitle + back) — hide
          the stack header to avoid the duplicate "My Orders" bar above it. */}
      <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ headerShown: false }} />
      {/* Same screen, repair bookings only (Service / Pickup / Enquiry). */}
      <Stack.Screen name="RepairOrders" component={MyOrdersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MyCart" component={MyCartScreen} options={{ title: 'My Cart' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />

      {/* Device wizard */}
      <Stack.Screen name="SelectCategory" component={SelectCategoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeviceDetails" component={DeviceDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SelectBrand" component={SelectBrandScreen} options={{ title: 'Select Brand' }} />
      <Stack.Screen name="SelectSeries" component={SelectSeriesScreen} options={{ title: 'Select Series' }} />
      <Stack.Screen name="SelectModel" component={SelectModelScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SelectVariant" component={SelectVariantScreen} options={{ title: 'Your Device' }} />

      {/* Repair flow */}
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
      <Stack.Screen name="RepairOrderDetails" component={PickupDetailsScreen} options={{ title: 'Pickup Details' }} />
      <Stack.Screen name="RepairPickupStatus" component={RepairPickupStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceTicketDetails" component={ServiceTicketDetailsScreen} options={{ title: 'Booking Details' }} />
      <Stack.Screen name="RepairOrderHistory" component={RepairOrderHistoryScreen} options={{ title: 'Service History' }} />
      <Stack.Screen name="RepairEstimate" component={RepairEstimateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceReceipt" component={ServiceReceiptScreen} options={{ title: 'Receipt' }} />
      <Stack.Screen name="InvoiceReceipt" component={InvoiceReceiptScreen} options={{ title: 'Invoice Receipt' }} />
      <Stack.Screen name="CustomerInvoice" component={DeliveryInvoiceReportScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShopChat" component={ShopChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChatInbox" component={CustomerChatInboxScreen} options={{ headerShown: false }} />

      {/* Sell flow */}
      <Stack.Screen name="SellSelectDevice" component={SellSelectDeviceScreen} options={{ title: 'Select Sell Device' }} />
      <Stack.Screen name="SellCondition" component={SellConditionScreen} options={{ title: 'Your Device' }} />
      <Stack.Screen name="SellScreening" component={SellScreeningScreen} options={{ title: 'Screening Question' }} />
      <Stack.Screen name="SellScreenCondition" component={SellScreenConditionScreen} options={{ title: 'Screen' }} />
      <Stack.Screen name="SellFunctional" component={SellFunctionalScreen} options={{ title: 'Functional' }} />
      <Stack.Screen name="SellDeviceConfig" component={SellDeviceConfigScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SellAccessoriesWarranty" component={SellAccessoriesWarrantyScreen} options={{ title: 'Accessoires & Warranty' }} />
      <Stack.Screen name="SellImages" component={SellImagesScreen} options={{ title: 'Sell Device Images' }} />
      <Stack.Screen name="SellAddress" component={SellAddressScreen} options={{ title: 'Select Address' }} />
      <Stack.Screen name="SellComplete" component={SellCompleteScreen} options={{ title: 'Complete Order' }} />
      <Stack.Screen name="SellOrderDetails" component={SellOrderDetailsScreen} options={{ title: 'Sell Device Details' }} />
      <Stack.Screen name="BuyOrderSuccess" component={BuyOrderSuccessScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SellQuotation" component={SellQuotationScreen} options={{ title: 'View Quotation Report' }} />
      <Stack.Screen name="SellSelectShop" component={SellSelectShopScreen} options={{ title: 'Select Sell Shop' }} />
      {/* Quote → pickup → tracking (Sell → My Listings → Listing Details → …) */}
      <Stack.Screen name="SellBuyerEnquiries" component={SellBuyerEnquiriesScreen} options={{ title: 'Buyer Enquiries', subtitle: 'Enquiries for your listings' }} />
      <Stack.Screen name="SellQuoteRequests" component={SellQuoteRequestsScreen} options={{ title: 'Quotation Requests', subtitle: 'Your devices waiting on offers' }} />
      <Stack.Screen name="SellQuotesReceived" component={SellQuotesReceivedScreen} options={{ title: 'Quotations Received' }} />
      <Stack.Screen name="SellQuoteDetails" component={SellQuoteDetailsScreen} options={{ title: 'Quote Details' }} />
      <Stack.Screen name="SellSchedulePickup" component={SellSchedulePickupScreen} options={{ title: 'Schedule Pickup' }} />
      <Stack.Screen name="SellOrderTracking" component={SellOrderTrackingScreen} options={{ title: 'Sell Order Details' }} />
      <Stack.Screen name="SellFinalOffer" component={SellFinalOfferScreen} options={{ title: 'Final Price Request' }} />

      {/* Buy flow */}
      <Stack.Screen name="BuyCategory" component={BuyCategoryScreen} options={{ title: 'Smart Phones' }} />
      <Stack.Screen name="BuyListing" component={BuyListingScreen} options={{ title: 'Listings' }} />
      <Stack.Screen name="BuyProductDetails" component={BuyProductDetailsScreen} options={{ title: 'Product Details' }} />
      <Stack.Screen name="BuyDevices" component={BuyDevicesScreen} options={{ title: 'Buy Devices' }} />
      <Stack.Screen name="BuyFulfillment" component={BuyFulfillmentScreen} options={{ title: 'Select Fulfillment' }} />
      <Stack.Screen name="BuyPlaceOrder" component={BuyPlaceOrderScreen} options={{ title: 'Place Order' }} />
      <Stack.Screen name="BuyOrderDetails" component={BuyOrderDetailsSafe} options={{ title: 'Order Details' }} />
      <Stack.Screen name="BuyFixedOrder" component={BuyFixedOrderSafe} options={{ title: 'Track Order' }} />

      {/* Shop browse */}
      <Stack.Screen name="NearbyShops" component={NearbyShopsScreen} options={{ title: 'Nearby Shops' }} />
      <Stack.Screen name="ShopDetails" component={ShopDetailsScreen} options={{ title: 'Shop Details' }} />
    </Stack.Navigator>
  );
}
