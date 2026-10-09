import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { confirm, notify } from '../../../components/confirm';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BadgeCheck, Bell, Camera, Heart, LogOut, Mail, Pencil, Phone, ShieldCheck } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { clearSession as clearAuth, selectSession } from '../../../store/authSlice';
import { clearSession } from '../../../auth/session';
import { getUnreadCount } from '../../../api/notifications';
import { isAppLockEnabled, setAppLockEnabled, isDeviceSecure, authenticate } from '../../../auth/appLock';
import { rf, rs } from '../../../utils/responsive';

// Same palette and tile tones as the Partner app's My Account screen.
const G = '#09AD2A';        // primary green
const G_LIGHT = '#EAF8EC';  // light green (badges, pills, footer)
const DARK = '#1E1E1E';     // text
const MUTED = '#6B6B6B';    // subtitles
const LIGHT = '#F3F3F3';    // borders, dividers, toggle off
const BG = '#F8F8F8';       // page
const DANGER = '#DC2626';
const MAX_W = 640;
const ICON_STROKE = 2;

// Solid tile colours, one per row (white glyph on top).
const TONE = { green: '#16A34A', amber: '#F59E0B', blue: '#3B82F6', purple: '#A855F7', orange: '#F97316', pink: '#EC4899' };

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
  { label: 'About Us',           desc: 'Learn about GGFIX',           icon: ion('information-circle'), to: 'AboutUs',         tone: 'green' },
  { label: 'Terms & Conditions', desc: 'Policies & agreements',       icon: mci('script-text'),        to: 'Terms',           tone: 'blue' },
];

// App version comes from the Expo app config (app.config.js `version`), with
// the installed binary's version as a fallback.
const APP_VERSION = Constants.expoConfig?.version || Constants.nativeApplicationVersion || '';

// Same rule as the shared rnr Avatar fallback: first two letters of the name.
function initialsOf(name) {
  return String(name || '?').trim().slice(0, 2).toUpperCase();
}

const softShadow = {
  shadowColor: '#0B1F14', shadowOpacity: 0.05, shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 }, elevation: 2,
};

// One white list per section; rows inside are divider-separated.
const LIST_STYLE = { backgroundColor: '#FFFFFF', borderRadius: rs(16), borderWidth: 1, borderColor: LIGHT, paddingHorizontal: rs(12) };
const LIST_ROW = { flexDirection: 'row', alignItems: 'center', minHeight: rs(64), paddingVertical: rs(11) };
const ICON_TILE = { width: rs(36), height: rs(36), borderRadius: rs(10), alignItems: 'center', justifyContent: 'center', marginRight: rs(11) };

function SectionLabel({ children, subtitle, count }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(16), marginBottom: rs(8) }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: rf(15), fontWeight: '800', color: DARK }}>{children}</Text>
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
      style={{ ...LIST_ROW, borderBottomWidth: last ? 0 : 1, borderBottomColor: LIGHT }}
    >
      <View style={{ ...ICON_TILE, backgroundColor: TONE[item.tone] || TONE.green }}>
        <Icon size={rf(19)} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: rf(13.5), fontWeight: '700', color: DARK }}>{item.label}</Text>
        <Text numberOfLines={1} style={{ fontSize: rf(11), color: MUTED, marginTop: 2 }}>{item.desc}</Text>
      </View>
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
  const [unread, setUnread] = useState(0);

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
    notify('Logged out', '', { preset: 'done' });
  };

  const name = session?.fullName || 'Welcome User';
  const mobile = session?.mobile || '';
  const email = session?.email || '';
  const avatar = session?.profileImageUrl;
  const avatarSize = rs(54);
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ---------- Header ---------- */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG }}>
        <View style={[centered, { paddingHorizontal: rs(16), paddingTop: rs(4), paddingBottom: rs(8), flexDirection: 'row', alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: rf(10.5), fontWeight: '800', letterSpacing: 0.4, color: G }}>GGFIX</Text>
            <Text numberOfLines={1} style={{ fontSize: rf(17), fontWeight: '800', color: DARK, marginTop: rs(2) }}>My Account</Text>
            <Text numberOfLines={1} style={{ fontSize: rf(11), color: MUTED, marginTop: rs(2) }}>Manage your profile, orders and preferences</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={8}
            accessibilityLabel="Notifications"
            className="active:opacity-80"
            style={{
              height: rs(40), width: rs(40), borderRadius: rs(20), marginLeft: rs(10),
              backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LIGHT,
              alignItems: 'center', justifyContent: 'center', ...softShadow,
            }}
          >
            <Bell size={rf(19)} color={DARK} strokeWidth={ICON_STROKE} />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute', top: rs(8), right: rs(9),
                  height: 9, width: 9, borderRadius: 5,
                  backgroundColor: DANGER, borderWidth: 1.5, borderColor: '#FFFFFF',
                }}
              />
            ) : null}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ---------- Body ---------- */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: rs(16), paddingBottom: 110 }}
      >
        <View style={centered}>
          {/* Profile card — opens Edit Profile (name, mobile, email, photo). */}
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            className="active:opacity-90"
            style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
              borderRadius: rs(20), borderWidth: 1, borderColor: LIGHT,
              paddingHorizontal: rs(12), paddingVertical: rs(12), ...softShadow,
            }}
          >
            <View style={{ alignSelf: 'flex-start' }}>
              <View
                style={{
                  width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: G,
                  alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: G_LIGHT,
                }}
              >
                {avatar ? (
                  <Image source={{ uri: avatar }} style={{ width: avatarSize, height: avatarSize }} resizeMode="cover" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: rf(15), letterSpacing: 1 }}>{initialsOf(name)}</Text>
                )}
              </View>
              <View
                style={{
                  position: 'absolute', right: -1, bottom: -1, width: rs(18), height: rs(18), borderRadius: rs(9),
                  backgroundColor: G, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF',
                }}
              >
                <Camera size={rf(9)} color="#FFFFFF" strokeWidth={ICON_STROKE} />
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0, marginLeft: rs(12) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text numberOfLines={1} style={{ fontSize: rf(15), fontWeight: '800', color: DARK, marginRight: rs(6), flexShrink: 1 }}>{name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: rs(6), paddingVertical: rs(2), backgroundColor: G_LIGHT }}>
                  <BadgeCheck size={rf(10)} color={G} strokeWidth={ICON_STROKE} />
                  <Text style={{ fontSize: rf(8.5), fontWeight: '800', color: G, marginLeft: rs(2), letterSpacing: 0.4 }}>VERIFIED</Text>
                </View>
              </View>
              {mobile ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(4) }}>
                  <Phone size={rf(10)} color={MUTED} strokeWidth={ICON_STROKE} />
                  <Text numberOfLines={1} style={{ fontSize: rf(11), color: MUTED, marginLeft: rs(5) }}>{mobile}</Text>
                </View>
              ) : null}
              {email ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rs(2) }}>
                  <Mail size={rf(10)} color={MUTED} strokeWidth={ICON_STROKE} />
                  <Text numberOfLines={1} style={{ fontSize: rf(11), color: MUTED, marginLeft: rs(5), flexShrink: 1 }}>{email}</Text>
                </View>
              ) : null}
            </View>

            <View style={{ alignItems: 'center', marginLeft: rs(8) }}>
              <View style={{ width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: G_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <Pencil size={rf(16)} color={G} strokeWidth={ICON_STROKE} />
              </View>
              <Text style={{ fontSize: rf(10), fontWeight: '700', color: G, marginTop: rs(2) }}>Edit</Text>
            </View>
          </Pressable>

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
            android_ripple={{ color: '#FDEEEE' }}
            accessibilityRole="button"
            className="active:opacity-80"
            style={{
              flexDirection: 'row', alignItems: 'center', marginTop: rs(14),
              backgroundColor: '#FFFFFF', borderRadius: rs(14), borderWidth: 1, borderColor: LIGHT,
              paddingHorizontal: rs(12), minHeight: rs(60), paddingVertical: rs(9),
              shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
            }}
          >
            <View style={{ ...ICON_TILE, backgroundColor: '#FDEEEE' }}>
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
