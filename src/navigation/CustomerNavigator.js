import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home as HomeIcon, Tag, ShoppingBag, Wrench, User } from 'lucide-react-native';
import colors from '../theme/colors';
import BackButton from '../components/BackButton';
import { rf } from '../utils/responsive';

const TAB_GREEN = '#004C40';
const TAB_GREEN_DARK = '#004C40';
const TAB_GREEN_SOFT = '#DCFCE7';

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
import TermsScreen from '../screens/customer/profile/TermsScreen';
import FaqScreen from '../screens/customer/profile/FaqScreen';
import MyOrdersScreen from '../screens/customer/profile/MyOrdersScreen';
import MyCartScreen from '../screens/customer/profile/MyCartScreen';
import NotificationsScreen from '../screens/customer/profile/NotificationsScreen';

// Device wizard (shared by Profile / Sell / Repair)
import SelectCategoryScreen from '../screens/customer/device/SelectCategoryScreen';
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
import RepairOrderDetailsScreen from '../screens/customer/service-booking-customer/RepairOrderDetailsScreen';
import ServiceTicketDetailsScreen from '../screens/customer/service-booking-customer/ServiceTicketDetailsScreen';
import RepairOrderHistoryScreen from '../screens/customer/service-booking-customer/RepairOrderHistoryScreen';
import RepairPickupStatusScreen from '../screens/customer/service-booking-customer/RepairPickupStatusScreen';
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
import SellSuccessScreen from '../screens/customer/sell/SellSuccessScreen';
import SellQuotationScreen from '../screens/customer/sell/SellQuotationScreen';
import SellSelectShopScreen from '../screens/customer/sell/SellSelectShopScreen';

// Buy flow
import BuyCategoryScreen from '../screens/customer/buy/BuyCategoryScreen';
import BuyListingScreen from '../screens/customer/buy/BuyListingScreen';
import BuyProductDetailsScreen from '../screens/customer/buy/BuyProductDetailsScreen';

// Shop browse
import NearbyShopsScreen from '../screens/customer/shop/NearbyShopsScreen';
import ShopDetailsScreen from '../screens/customer/shop/ShopDetailsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: HomeIcon,
  Repair: Wrench,
  Sell: Tag,
  Buy: ShoppingBag,
  Profile: User,
};

const TAB_LABELS = {
  Home: 'Home',
  Repair: 'Repair',
  Sell: 'Sell',
  Buy: 'Buy',
  Profile: 'Profile',
};

// Floating "glass" capsule bottom bar — mirrors the shop app's OwnerNavigator
// GlassTabBar method: a rounded white capsule floating above the safe area with
// a spring-animated pill that slides to the active tab. Themed green for the
// customer brand (active icon/label green; pill green-soft).
const TAB_HPAD = 6;      // capsule inner horizontal padding
const TAB_PILL_INSET = 8; // gap between a slot edge and the pill

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const [barW, setBarW] = useState(0);

  const count = routes.length || 1;
  const slot = barW > 0 ? (barW - TAB_HPAD * 2) / count : 0;
  const activeIndex = state.index;

  const anim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: activeIndex, useNativeDriver: true, friction: 14, tension: 120 }).start();
  }, [activeIndex, slot]);

  const translateX = anim.interpolate({
    inputRange: routes.map((_, i) => i),
    outputRange: routes.map((_, i) => TAB_HPAD + i * slot + TAB_PILL_INSET),
    extrapolate: 'clamp',
  });

  return (
    <View style={{ backgroundColor: colors.background, paddingTop: 8, paddingBottom: insets.bottom || 10, paddingHorizontal: 14 }}>
      {/* Floating rounded capsule */}
      <View
        onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#FFFFFF', borderRadius: 30,
          paddingHorizontal: TAB_HPAD, height: 62,
          borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)',
          shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 }, elevation: 12,
        }}
      >
        {/* Sliding green pill behind the active tab */}
        {slot > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 8, left: 0,
              width: slot - TAB_PILL_INSET * 2, height: 46, borderRadius: 18,
              backgroundColor: TAB_GREEN_SOFT,
              borderWidth: 1, borderColor: 'rgba(22, 163, 74, 0.14)',
              transform: [{ translateX }],
            }}
          />
        ) : null}

        {routes.map((route, index) => {
          const focused = index === activeIndex;
          const Icon = TAB_ICONS[route.name] || HomeIcon;
          const label = TAB_LABELS[route.name] || route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={{ width: slot, height: 46, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon size={21} color={focused ? TAB_GREEN_DARK : '#94A3B8'} strokeWidth={2} />
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={{ fontSize: rf(10.5), marginTop: 3, color: focused ? TAB_GREEN_DARK : '#94A3B8', fontWeight: focused ? '800' : '600' }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// `onLogout` is passed in from RootNavigator so the Profile tab can call the
// SAME callback that clears RootNavigator's local session state — without
// that, the Profile screen's local `dispatch(clearAuth())` only updates Redux
// while RootNavigator's useState keeps a stale token, leaving the user
// stranded on Profile after they tap Log out.
function CustomerTabs({ onLogout }) {
  return (
    <Tab.Navigator
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
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms & Conditions' }} />
      <Stack.Screen name="Faq" component={FaqScreen} options={{ title: 'FAQ' }} />
      {/* MyOrders renders its own AppHeader (title + subtitle + back) — hide
          the stack header to avoid the duplicate "My Orders" bar above it. */}
      <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MyCart" component={MyCartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />

      {/* Device wizard */}
      <Stack.Screen name="SelectCategory" component={SelectCategoryScreen} options={{ headerShown: false }} />
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
      <Stack.Screen name="RepairOrderDetails" component={RepairOrderDetailsScreen} options={{ title: 'View Details' }} />
      <Stack.Screen name="ServiceTicketDetails" component={ServiceTicketDetailsScreen} options={{ title: 'View Details' }} />
      <Stack.Screen name="RepairOrderHistory" component={RepairOrderHistoryScreen} options={{ title: 'Service History' }} />
      <Stack.Screen name="RepairPickupStatus" component={RepairPickupStatusScreen} options={{ title: 'Pickup Status' }} />
      <Stack.Screen name="RepairEstimate" component={RepairEstimateScreen} options={{ title: 'Repair Estimate' }} />
      <Stack.Screen name="ServiceReceipt" component={ServiceReceiptScreen} options={{ title: 'Receipt' }} />
      <Stack.Screen name="InvoiceReceipt" component={InvoiceReceiptScreen} options={{ title: 'Invoice Receipt' }} />
      <Stack.Screen name="ShopChat" component={ShopChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChatInbox" component={CustomerChatInboxScreen} options={{ headerShown: false }} />

      {/* Sell flow */}
      <Stack.Screen name="SellSelectDevice" component={SellSelectDeviceScreen} options={{ title: 'Select Sell Device' }} />
      <Stack.Screen name="SellCondition" component={SellConditionScreen} options={{ title: 'Your Device' }} />
      <Stack.Screen name="SellScreening" component={SellScreeningScreen} options={{ title: 'Screening Question' }} />
      <Stack.Screen name="SellScreenCondition" component={SellScreenConditionScreen} options={{ title: 'Screen' }} />
      <Stack.Screen name="SellFunctional" component={SellFunctionalScreen} options={{ title: 'Functional' }} />
      <Stack.Screen name="SellDeviceConfig" component={SellDeviceConfigScreen} options={{ title: 'Device Configuration' }} />
      <Stack.Screen name="SellAccessoriesWarranty" component={SellAccessoriesWarrantyScreen} options={{ title: 'Accessoires & Warranty' }} />
      <Stack.Screen name="SellImages" component={SellImagesScreen} options={{ title: 'Sell Device Images' }} />
      <Stack.Screen name="SellAddress" component={SellAddressScreen} options={{ title: 'Select Address' }} />
      <Stack.Screen name="SellComplete" component={SellCompleteScreen} options={{ title: 'Complete Order' }} />
      <Stack.Screen name="SellOrderDetails" component={SellOrderDetailsScreen} options={{ title: 'Sell Device Details' }} />
      <Stack.Screen name="SellSuccess" component={SellSuccessScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SellQuotation" component={SellQuotationScreen} options={{ title: 'View Quotation Report' }} />
      <Stack.Screen name="SellSelectShop" component={SellSelectShopScreen} options={{ title: 'Select Sell Shop' }} />

      {/* Buy flow */}
      <Stack.Screen name="BuyCategory" component={BuyCategoryScreen} options={{ title: 'Smart Phones' }} />
      <Stack.Screen name="BuyListing" component={BuyListingScreen} options={{ title: 'Listings' }} />
      <Stack.Screen name="BuyProductDetails" component={BuyProductDetailsScreen} options={{ title: 'Product Details' }} />

      {/* Shop browse */}
      <Stack.Screen name="NearbyShops" component={NearbyShopsScreen} options={{ title: 'Nearby Shops' }} />
      <Stack.Screen name="ShopDetails" component={ShopDetailsScreen} options={{ title: 'Shop Details' }} />
    </Stack.Navigator>
  );
}
