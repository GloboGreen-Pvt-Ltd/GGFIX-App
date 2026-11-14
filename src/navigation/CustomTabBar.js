import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home as HomeIcon, Tag, ShoppingBag, Wrench, User } from 'lucide-react-native';
import { rf, rs } from '../utils/responsive';
import { getTabBarBottomGap, getTabBarContentHeight, isTabletWidth } from './customerTabBarMetrics';

// The customer bottom tab bar, shared by the tab navigator (CustomerNavigator)
// and StaticTabBar below.

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

// Floating capsule bottom bar — the Partner app's GlassTabBar
// (OwnerNavigator.js) design: a fully rounded white capsule with a thin
// light-grey outline and soft shadow; every tab shows icon + label, and the
// active one sits in its own fully rounded light-red pill (red icon + bold
// label), inactive tabs dark grey. Height from tabBarMetrics (50 phone / 56
// tablet, scaled); on tablets the capsule is centred at 660 instead of stretching.
const PILL_INSET = 5;           // pill's gap to the bar edge — all four sides
const ICON_ON = '#F32C26';      // active icon + label
const ICON_OFF = '#374151';     // inactive icon + label
const ACTIVE_PILL = '#FEEAE9';  // active tab's pill — light tint of #F32C26
const GLASS_OUTLINE = '#ECECEC';

// `floating`: the tab navigator's bar sits over the screen (no strip behind it);
// a StaticTabBar inside a stack screen stays in the layout.
export default function CustomTabBar({ state, navigation, floating = true }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);
  const barHeight = getTabBarContentHeight(isTablet);
  const pillRadius = (barHeight - PILL_INSET * 2) / 2;
  const iconSize = rs(isTablet ? 20 : 18);
  const labelSize = rf(isTablet ? 11 : 10);

  return (
    <View style={{ ...(floating ? { position: 'absolute', left: 0, right: 0, bottom: 0 } : null), backgroundColor: 'transparent', paddingTop: 6, paddingHorizontal: rs(isTablet ? 20 : 14), paddingBottom: getTabBarBottomGap(insets.bottom) }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'stretch',
          width: '100%', maxWidth: isTablet ? 660 : '100%', alignSelf: 'center',
          height: barHeight, borderRadius: barHeight / 2,
          backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GLASS_OUTLINE,
          shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 }, elevation: 6,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = index === state.index;
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
              accessibilityState={{ selected: focused }}
              // Switch on touch-down, not release — as the Partner bar does.
              onPressIn={onPress}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={onPress}
              onLongPress={onLongPress}
              hitSlop={6}
              style={{ flex: 1, minHeight: 40, alignItems: 'stretch', justifyContent: 'center', padding: PILL_INSET }}
            >
              <View
                style={{
                  flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: pillRadius, overflow: 'hidden',
                  backgroundColor: focused ? ACTIVE_PILL : 'transparent',
                }}
              >
                <Icon size={iconSize} color={focused ? ICON_ON : ICON_OFF} strokeWidth={focused ? 2.4 : 1.75} />
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={{ fontSize: labelSize, marginTop: rs(2), color: focused ? ICON_ON : ICON_OFF, fontWeight: focused ? '700' : '500' }}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Order of the customer tabs (CustomerNavigator's Tab.Screen list).
const TAB_ORDER = ['Home', 'Repair', 'Sell', 'Buy', 'Profile'];

/**
 * The same bottom bar on a stack screen that belongs to a tab's flow (e.g. a
 * Sell sub-page), with that tab highlighted. Tapping another tab returns to
 * the tab navigator on that tab.
 */
export function StaticTabBar({ navigation, active }) {
  const state = { index: TAB_ORDER.indexOf(active), routes: TAB_ORDER.map((name) => ({ key: name, name })) };
  const tabNav = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name) => navigation.navigate('CustomerTabs', { screen: name }),
  };
  return <CustomTabBar state={state} navigation={tabNav} floating={false} />;
}
