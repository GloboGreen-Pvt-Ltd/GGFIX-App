import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { confirm } from '../../../components/confirm';
import { showToast } from '../../../components/AppToast';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarTotalHeight, isTabletWidth } from '../../../navigation/customerTabBarMetrics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BadgeCheck, Bell, Camera, ChevronRight, Heart, LogOut, Mail, Pencil, Phone, ShieldCheck } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { clearSession as clearAuth, selectSession } from '../../../store/authSlice';
import { clearSession } from '../../../auth/session';
import { getUnreadCount } from '../../../api/notifications';
import { isAppLockEnabled, setAppLockEnabled, isDeviceSecure, authenticate } from '../../../auth/appLock';
import { rf, rs } from '../../../utils/responsive';

// Same palette and tile tones as the Partner app's My Account screen.
const G = '#035C6C';        // primary teal (header, key actions)
const G_DARK = '#02414C';   // header gradient end
const NAVY = '#1C3053';     // section headings
const G_LIGHT = '#E5F3F5';  // light green (badges, pills, footer)
const DARK = '#111111';     // text
const MUTED = '#6B7280';    // subtitles
const LIGHT = '#F3F4F6';    // borders, dividers, toggle off
const BG = '#F3F4F6';       // page
const DANGER = '#F32C26';
const MAX_W = 640;
const ICON_STROKE = 2;

// Solid tile colours, one per row (white glyph on top).
const TONE = { green: '#609138', amber: '#FAA700', blue: '#0788C9', purple: '#0788C9', orange: '#FAA700', pink: '#0788C9' };

// Filled glyphs (lucide only ships outlines), sized/coloured like a lucide icon.
const ion = (name) => function IonGlyph({ size = 20, color }) { return <Ionicons name={name} size={size} color={color} />; };
const mci = (name) => function MciGlyph({ size = 20, color }) { return <MaterialCommunityIcons name={name} size={size} color={color} />; };

const ACCOUNT = [
  { label: 'My Orders',        desc: 'Track & manage your orders',  icon: ion('bag-handle'),     to: 'MyOrders',      tone: 'green' },
  { label: 'My Cart',          desc: 'Items saved for checkout',    icon: ion('cart'),           to: 'MyCart',        tone: 'orange' },
  { label: 'Manage My Device', desc: 'Your saved devices',          icon: ion('phone-portrait'), to: 'ManageDevice',  tone: 'purple' },
  { label: 'Manage Addresses', desc: 'Delivery & pickup addresses', icon: ion('location'),       to: 'ManageAddress', tone: 'blue' },
];

const SUPPORT = [
  { label: 'Customer Support',   desc: "We're here to help",          icon: ion('headset'),            to: 'CustomerSupport', tone: 'orange' },
  { label: 'FAQ',                desc: 'Answers to common questions', icon: ion('help-circle'),        to: 'Faq',             tone: 'purple' },
  { label: 'About Us',           desc: 'Learn about NearGFix',           icon: ion('information-circle'), to: 'AboutUs',         tone: 'green' },
  { label: 'Terms & Conditions', desc: 'Policies & agreements',       icon: mci('script-text'),        to: 'Terms',           tone: 'blue' },
  { label: 'Privacy Policy',     desc: 'How we handle your data',     icon: mci('shield-check'),       to: 'PrivacyPolicy',   tone: 'green' },
];

// App version comes from the Expo app config (app.config.js `version`), with
// the installed binary's version as a fallback.
const APP_VERSION = Constants.expoConfig?.version || Constants.nativeApplicationVersion || '';

// Same rule as the shared rnr Avatar fallback: first two letters of the name.
function initialsOf(name) {
  return String(name || '?').trim().slice(0, 2).toUpperCase();
}

const softShadow = {
  shadowColor: '#111111', shadowOpacity: 0.05, shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 }, elevation: 2,
};

// One white card per section (Partner My Account); rows divider-separated.
const LIST_STYLE = { backgroundColor: '#FFFFFF', borderRadius: rs(18), paddingHorizontal: rs(12), ...softShadow };
const LIST_ROW = { flexDirection: 'row', alignItems: 'center', minHeight: rs(62), paddingVertical: rs(10) };
const ICON_TILE = { width: rs(40), height: rs(40), borderRadius: rs(12), alignItems: 'center', justifyContent: 'center', marginRight: rs(12) };
// Round translucent buttons on the teal header.
const HEADER_BTN = {
  width: rs(36), height: rs(36), borderRadius: rs(18), alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
};

function SectionLabel({ children, subtitle, count }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(16), marginBottom: rs(8) }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: rf(15), fontWeight: '800', color: NAVY }}>{children}</Text>
        {subtitle ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {typeof count === 'number' ? (
        <View style={{ borderRadius: 999, paddingHorizontal: rs(9), paddingVertical: rs(3), backgroundColor: G_LIGHT }}>
          <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: G }}>{count} Option{count === 1 ? '' : 's'}</Text>
        </View>
      ) : null}
    </View>
  );
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function Row({ item, onPress, last }) {
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: LIGHT }}
      className="active:opacity-80"
      style={{ ...LIST_ROW, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1F3F5' }}
    >
      <View style={{ ...ICON_TILE, backgroundColor: TONE[item.tone] || TONE.green }}>
        <Icon size={rf(19)} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: rf(13.5), fontWeight: '700', color: DARK }}>{item.label}</Text>
        <Text numberOfLines={1} style={{ fontSize: rf(11), color: MUTED, marginTop: 2 }}>{item.desc}</Text>
      </View>
      <ChevronRight size={rf(17)} color="#9CA3AF" strokeWidth={ICON_STROKE} />
    </Pressable>
  );
}

// App Lock toggle row — matches the menu-row shape. Requires the device
// fingerprint / pattern / PIN to open the app. Fails OPEN when the device has
// no lock (we tell the user to set one first).
function AppLockRow() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { (async () => { setOn(await isAppLockEnabled()); setReady(true); })(); }, []);
  const toggle = async (next) => {
    if (next) {
      if (!(await isDeviceSecure())) {
        Alert.alert('Set a screen lock', 'Add a fingerprint, pattern or PIN in your phone settings first, then turn on App Lock.');
        return;
      }
      if (!(await authenticate())) return;
    }
    await setAppLockEnabled(next);
    setOn(next);
  };
  return (
    <View style={LIST_ROW}>
      <View style={{ ...ICON_TILE, backgroundColor: TONE.blue }}>
        <Ionicons name="lock-closed" size={rf(18)} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: rf(13.5), fontWeight: '700', color: DARK }}>App Lock</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: rf(11), color: MUTED, marginTop: 2 }}>
          Require fingerprint / pattern / PIN to open
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={toggle}
        disabled={!ready}
        trackColor={{ true: G, false: LIGHT }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={LIGHT}
        style={{ marginLeft: 8 }}
      />
    </View>
  );
}

export default function ProfileScreen({ navigation, onLogout: parentLogout }) {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const [unread, setUnread] = useState(0);
  const isFocused = useIsFocused();

  // Unread badge on the bell — refreshed each time the tab gains focus.
  useFocusEffect(useCallback(() => {
    let alive = true;
    getUnreadCount().then((n) => { if (alive) setUnread(Number(n) || 0); }).catch(() => {});
    return () => { alive = false; };
  }, []));

  const onLogout = async () => {
    // Prefer the logout passed from RootNavigator — it both clears AsyncStorage
    // AND updates RootNavigator's local session useState, which is what
    // actually flips the navigator back to the LoginScreen. Falling back to a
    // local clearSession/dispatch only would leave the user stuck on Profile
    // because RootNavigator wouldn't notice.
    const ok = await confirm({
      title: 'Log out',
      message: 'Are you sure?',
      confirmText: 'Log out',
      destructive: true,
    });
    if (!ok) return;
    if (parentLogout) {
      await parentLogout();
    } else {
      await clearSession();
      dispatch(clearAuth());
    }
    showToast({ type: 'success', title: 'Logged out', message: 'You have been signed out.' });
  };

  const name = session?.fullName || 'Welcome User';
  const mobile = session?.mobile || '';
  const email = session?.email || '';
  const avatar = session?.profileImageUrl;
  const avatarSize = rs(64);
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Light status-bar icons over the teal header, only while this tab shows. */}
      {isFocused ? <StatusBar style="light" /> : null}

      {/* ---------- Fixed teal header: title bar + profile (Partner) ---------- */}
      <LinearGradient
        colors={[G, G_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: rs(26), borderBottomRightRadius: rs(26) }}
      >
        <SafeAreaView edges={['top']}>
          <View style={[centered, { paddingHorizontal: rs(16), paddingTop: rs(6), paddingBottom: rs(18) }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation.navigate('Home'))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back"
                className="active:opacity-70"
                style={HEADER_BTN}
              >
                <Ionicons name="chevron-back" size={19} color="#FFFFFF" />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center', marginHorizontal: rs(8) }}>
                <Text numberOfLines={1} style={{ fontSize: rf(17), fontWeight: '800', color: '#FFFFFF' }}>My Account</Text>
                <Text numberOfLines={1} style={{ fontSize: rf(11), color: 'rgba(255,255,255,0.75)', marginTop: rs(2) }}>Manage your profile, orders and preferences</Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('Notifications')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                className="active:opacity-70"
                style={HEADER_BTN}
              >
                <Bell size={rf(16)} color="#FFFFFF" strokeWidth={ICON_STROKE} />
                {unread > 0 ? (
                  <View style={{ position: 'absolute', top: rs(6), right: rs(7), height: 9, width: 9, borderRadius: 5, backgroundColor: DANGER, borderWidth: 1.5, borderColor: G }} />
                ) : null}
              </Pressable>
            </View>

            {/* Profile — avatar · name + VERIFIED · mobile / email · Edit. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(18) }}>
              <Pressable onPress={() => navigation.navigate('EditProfile')} accessibilityRole="button" accessibilityLabel="Edit profile photo">
                <View
                  style={{
                    width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#FFFFFF',
                  }}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={{ width: avatarSize, height: avatarSize }} resizeMode="cover" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(19), letterSpacing: 1 }}>{initialsOf(name)}</Text>
                  )}
                </View>
                <View
                  style={{
                    position: 'absolute', right: -rs(2), bottom: -rs(2), width: rs(22), height: rs(22), borderRadius: rs(11),
                    backgroundColor: '#FAA700', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF',
                  }}
                >
                  <Camera size={rf(11)} color="#FFFFFF" strokeWidth={ICON_STROKE} />
                </View>
              </Pressable>

              <View style={{ flex: 1, minWidth: 0, marginLeft: rs(14) }}>
                <Text numberOfLines={1} style={{ fontSize: rf(18), fontWeight: '800', color: '#FFFFFF' }}>{name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(5) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: rs(8), paddingVertical: rs(3), backgroundColor: '#609138' }}>
                    <BadgeCheck size={rf(10)} color="#FFFFFF" strokeWidth={ICON_STROKE} />
                    <Text style={{ fontSize: rf(9), fontWeight: '800', color: '#FFFFFF', marginLeft: rs(3), letterSpacing: 0.5 }}>VERIFIED</Text>
                  </View>
                </View>
                {mobile ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(6) }}>
                    <Phone size={rf(11)} color="rgba(255,255,255,0.8)" strokeWidth={ICON_STROKE} />
                    <Text numberOfLines={1} style={{ fontSize: rf(12), color: 'rgba(255,255,255,0.88)', marginLeft: rs(6) }}>{mobile}</Text>
                  </View>
                ) : null}
                {email ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(2) }}>
                    <Mail size={rf(11)} color="rgba(255,255,255,0.8)" strokeWidth={ICON_STROKE} />
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: rf(12), color: 'rgba(255,255,255,0.88)', marginLeft: rs(6) }}>{email}</Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={() => navigation.navigate('EditProfile')}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                className="active:opacity-80"
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: rs(12), minHeight: rs(34), marginLeft: rs(8) }}
              >
                <Pencil size={rf(13)} color={G} strokeWidth={ICON_STROKE} />
                <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: G, marginLeft: rs(4) }}>Edit</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ---------- Body — the only scroller; the tab bar sits below it ---------- */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: rs(16), paddingTop: rs(4), paddingBottom: rs(24) + getTabBarTotalHeight(isTabletWidth(winW), insets.bottom) }}
      >
        <View style={centered}>
          <SectionLabel subtitle="Orders, cart, devices and addresses" count={ACCOUNT.length}>Account</SectionLabel>
          <View style={LIST_STYLE}>
            {ACCOUNT.map((it, idx) => (
              <Row key={it.label} item={it} onPress={() => navigation.navigate(it.to)} last={idx === ACCOUNT.length - 1} />
            ))}
          </View>

          <SectionLabel subtitle="Keep your account safe and secure">Security</SectionLabel>
          <View style={LIST_STYLE}>
            <AppLockRow />
          </View>

          <SectionLabel subtitle="Help, legal and other information">Support</SectionLabel>
          <View style={LIST_STYLE}>
            {SUPPORT.map((it, idx) => (
              <Row key={it.label} item={it} onPress={() => navigation.navigate(it.to)} last={idx === SUPPORT.length - 1} />
            ))}
          </View>

          {/* Log out */}
          <Pressable
            onPress={onLogout}
            android_ripple={{ color: '#FEEBEA' }}
            accessibilityRole="button"
            className="active:opacity-80"
            style={{
              flexDirection: 'row', alignItems: 'center', marginTop: rs(14),
              backgroundColor: '#FFFFFF', borderRadius: rs(14), borderWidth: 1, borderColor: LIGHT,
              paddingHorizontal: rs(12), minHeight: rs(60), paddingVertical: rs(9),
              shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
            }}
          >
            <View style={{ ...ICON_TILE, backgroundColor: '#FEEBEA' }}>
              <LogOut size={rf(18)} color={DANGER} strokeWidth={ICON_STROKE} />
            </View>
            <Text style={{ flex: 1, fontSize: rf(13.5), fontWeight: '700', color: DANGER }}>Log Out</Text>
          </Pressable>

          {/* Trust footer — reassurance only, no state or navigation. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: rs(14), marginTop: rs(10), padding: rs(11), backgroundColor: G_LIGHT }}>
            <ShieldCheck size={rf(16)} color={G} strokeWidth={ICON_STROKE} />
            <Text style={{ flex: 1, fontSize: rf(11), color: DARK, marginLeft: rs(8), lineHeight: rf(15) }}>
              Your data is safe with us — we follow industry-standard security practices.
            </Text>
          </View>

          {/* Footer */}
          {APP_VERSION ? (
            <Text style={{ textAlign: 'center', fontSize: rf(11), color: MUTED, marginTop: rs(14) }}>
              App Version {APP_VERSION}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
            <Text style={{ fontSize: rf(11), color: MUTED }}>Made with </Text>
            <Heart size={12} color={DANGER} fill={DANGER} />
            <Text style={{ fontSize: rf(11), color: MUTED }}> in India</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
