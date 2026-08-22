import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Store, User, Wrench } from 'lucide-react-native';
import { rf, rlh, rs } from '../utils/responsive';

/**
 * Sign-in chooser — the app's first screen when logged out.
 *
 * GGFIX ships three product shells in one binary (see navigation/RootNavigator):
 * the customer app, the shop/owner app under `shop/`, and the employee app under
 * `employee/`. They authenticate against DIFFERENT backend endpoints and produce
 * different session shapes, so the identity has to be chosen BEFORE the form is
 * shown rather than inferred from whatever was typed:
 *
 *   Customer  -> POST /auth/customer-login   (customer_users; roles ['CUSTOMER'])
 *   Shop      -> POST /auth/login            (loginType SHOP_OWNER | SHOP_LOGIN)
 *   Employee  -> POST /auth/login            (loginType EMPLOYEE)
 *
 * Shop and Employee share the `/auth/login` verifier but NOT the OTP issuer, and
 * they land on different shells — so they stay two explicit choices here.
 *
 * Styling is iOS "inset grouped list": one tinted glyph tile per row, title +
 * subtitle, chevron, hairline separators inside a single rounded card.
 */

const INK = '#0F172A';
const MUTED = '#64748B';
const SUBTLE = '#94A3B8';
const SCREEN_BG = '#F6F7F9';
const CARD_BG = '#FFFFFF';
const SEPARATOR = '#E9EBEF';

// One accent per shell. Customer keeps the brand teal, Employee keeps the navy
// its own app uses, and Shop takes the brand accent orange — the shop and
// customer themes both resolve `primary` to #004C40, so reusing it here would
// have made two of the three rows indistinguishable at a glance.
const ROLES = [
  {
    key: 'CUSTOMER',
    route: 'CustomerLogin',
    title: 'Customer Login',
    subtitle: 'Book repairs, buy and sell devices',
    Icon: User,
    tint: '#004C40',
    wash: '#DCFCE7',
  },
  {
    key: 'SHOP',
    route: 'ShopLogin',
    title: 'Shop Login',
    subtitle: 'Manage bookings, billing and your team',
    Icon: Store,
    tint: '#C2410C',
    wash: '#FFEDD5',
  },
  {
    key: 'EMPLOYEE',
    route: 'EmployeeLogin',
    title: 'Employee Login',
    subtitle: 'Your jobs, pickups and attendance',
    Icon: Wrench,
    tint: '#00008B',
    wash: '#E0E7FF',
  },
];

/**
 * One row of the chooser.
 *
 * Press feedback is held in state and applied through a plain style OBJECT.
 * Pressable's `style={({ pressed }) => …}` callback form is silently dropped in
 * its entirety by NativeWind's JSX interop (it only understands a style object
 * or array), which would take the row's flexDirection with it and collapse the
 * icon/title/chevron into a vertical stack.
 */
function RoleRow({ role, first, last, wide, onPress }) {
  const [pressed, setPressed] = useState(false);
  const { Icon } = role;
  const tile = wide ? rs(46) : rs(42);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={role.title}
      accessibilityHint={role.subtitle}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      android_ripple={{ color: 'rgba(15,23,42,0.06)' }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: wide ? rs(20) : rs(16),
        paddingVertical: wide ? rs(18) : rs(15),
        backgroundColor: pressed ? '#F2F4F7' : CARD_BG,
        borderTopLeftRadius: first ? rs(16) : 0,
        borderTopRightRadius: first ? rs(16) : 0,
        borderBottomLeftRadius: last ? rs(16) : 0,
        borderBottomRightRadius: last ? rs(16) : 0,
      }}
    >
      <View
        style={{
          height: tile,
          width: tile,
          borderRadius: rs(12),
          backgroundColor: role.wash,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={wide ? rs(23) : rs(21)} color={role.tint} />
      </View>

      <View style={{ flex: 1, marginLeft: rs(14) }}>
        <Text style={{ fontSize: rf(15.5), fontWeight: '700', color: INK, letterSpacing: -0.2 }}>
          {role.title}
        </Text>
        <Text style={{ fontSize: rf(12.5), color: MUTED, marginTop: rs(2), lineHeight: rlh(17) }}>
          {role.subtitle}
        </Text>
      </View>

      <ChevronRight size={rs(19)} color={SUBTLE} />
    </Pressable>
  );
}

export default function LoginSelectScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Short side, so a tablet reads as a tablet in either orientation.
  const shortSide = Math.min(width, height);
  const wide = shortSide >= 600;
  const isShort = height < 700;

  return (
    <View style={{ flex: 1, backgroundColor: SCREEN_BG }}>
      <StatusBar barStyle="dark-content" backgroundColor="#DCFCE7" />
      <LinearGradient
        colors={['#DCFCE7', '#F0FDF4', SCREEN_BG]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: rs(300) }}
      />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: insets.top + rs(24),
          // Clears the gesture bar / 3-button nav under Android edge-to-edge.
          paddingBottom: insets.bottom + rs(28),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: wide ? 560 : undefined,
            alignSelf: 'center',
            paddingHorizontal: wide ? rs(32) : rs(22),
          }}
        >
          {/* Brand */}
          <View style={{ alignItems: 'center', marginBottom: isShort ? rs(18) : rs(26) }}>
            <View
              style={{
                height: rs(64),
                width: rs(64),
                borderRadius: rs(20),
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: rs(10),
                shadowColor: '#004C40',
                shadowOpacity: 0.18,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
                borderWidth: 1,
                borderColor: '#DCFCE7',
              }}
            >
              <Image
                source={require('../../assets/logo.png')}
                style={{ height: rs(46), width: rs(46), borderRadius: rs(12) }}
                resizeMode="contain"
              />
            </View>
            <Text style={{ fontSize: rf(21), fontWeight: '800', color: '#004C40', letterSpacing: -0.3 }}>
              GGFIX
            </Text>
            <Text style={{ fontSize: rf(12), color: MUTED, marginTop: rs(3) }}>
              Repair · Buy · Sell — at your fingertips
            </Text>
          </View>

          <Text style={{ fontSize: rf(22), fontWeight: '800', color: INK, letterSpacing: -0.4 }}>
            Sign in
          </Text>
          <Text style={{ fontSize: rf(13), color: MUTED, marginTop: rs(4), lineHeight: rlh(19) }}>
            Choose how you want to continue.
          </Text>

          {/* iOS inset-grouped list */}
          <View
            style={{
              marginTop: rs(16),
              borderRadius: rs(16),
              backgroundColor: CARD_BG,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#EDEFF3',
              shadowColor: '#0F172A',
              shadowOpacity: 0.05,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            {ROLES.map((role, i) => (
              <View key={role.key}>
                {i > 0 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: SEPARATOR,
                      // Inset to the text column, the way iOS draws list separators.
                      marginLeft: (wide ? rs(20) : rs(16)) + (wide ? rs(46) : rs(42)) + rs(14),
                    }}
                  />
                ) : null}
                <RoleRow
                  role={role}
                  first={i === 0}
                  last={i === ROLES.length - 1}
                  wide={wide}
                  onPress={() => navigation?.navigate(role.route)}
                />
              </View>
            ))}
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: rs(22),
            }}
          >
            <Text style={{ fontSize: rf(13), color: MUTED }}>New to GGFIX? </Text>
            {/* Sign-up is customer-only — shops and employees are provisioned by
                the business, not self-served. Nested target: the CreateAccount
                route lives inside the customer auth stack. */}
            <Pressable
              onPress={() => navigation?.navigate('CustomerLogin', { screen: 'CreateAccount' })}
              hitSlop={8}
            >
              <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#004C40' }}>
                Create account
              </Text>
            </Pressable>
          </View>

          <Text
            style={{
              fontSize: rf(11),
              color: MUTED,
              textAlign: 'center',
              marginTop: rs(18),
              lineHeight: rlh(16),
            }}
          >
            By continuing, you agree to our{' '}
            <Text style={{ color: INK, fontWeight: '600' }}>Terms of Service</Text>
            {'  ·  '}
            <Text style={{ color: INK, fontWeight: '600' }}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
