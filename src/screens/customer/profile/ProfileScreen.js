import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { confirm, notify } from '../../../components/confirm';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import {
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  MapPin,
  FileText,
  Info,
  CircleHelp,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Pencil,
  CheckCircle2,
  Bell,
  Fingerprint,
  Heart,
} from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { clearSession as clearAuth, selectSession } from '../../../store/authSlice';
import { clearSession } from '../../../auth/session';
import { getUnreadCount } from '../../../api/notifications';
import { isAppLockEnabled, setAppLockEnabled, isDeviceSecure, authenticate } from '../../../auth/appLock';
import { rf } from '../../../utils/responsive';

const DEEP = '#004C40';
const PRIMARY = '#006B57';
const BRIGHT = '#00A86B';
const PAGE_BG = '#F8FCFA';
const BORDER = '#DCE7E2';
const DIVIDER = '#EDF2EF';
const INK = '#111827';
const MUTED = '#667085';
const LABEL = '#4B6B7F';
const MAX_W = 640;

const ACCOUNT = [
  { label: 'My Orders',        desc: 'Track & manage your orders',   icon: ShoppingBag,  to: 'MyOrders',      color: '#047857', bg: '#DCF7EA' },
  { label: 'My Cart',          desc: 'Items saved for checkout',     icon: ShoppingCart, to: 'MyCart',        color: '#EA580C', bg: '#FFEBDD' },
  { label: 'Manage My Device', desc: 'Your saved devices',           icon: Smartphone,   to: 'ManageDevice',  color: '#7C3AED', bg: '#EFE8FD' },
  { label: 'Manage Addresses', desc: 'Delivery & pickup addresses',  icon: MapPin,       to: 'ManageAddress', color: '#1D4ED8', bg: '#E3EDFD' },
];

const SUPPORT = [
  { label: 'Customer Support',   desc: "We're here to help",          icon: LifeBuoy,   to: 'CustomerSupport', color: '#EA580C', bg: '#FEF0D6' },
  { label: 'FAQ',                desc: 'Answers to common questions', icon: CircleHelp, to: 'Faq',             color: '#047857', bg: '#DCF7EA' },
  { label: 'About Us',           desc: 'Learn about GGFIX',           icon: Info,       to: 'AboutUs',         color: '#7C3AED', bg: '#EFE8FD' },
  { label: 'Terms & Conditions', desc: 'Policies & agreements',       icon: FileText,   to: 'Terms',           color: '#1D4ED8', bg: '#E3EDFD' },
];

// App version comes from the Expo app config (app.config.js `version`), with
// the installed binary's version as a fallback.
const APP_VERSION = Constants.expoConfig?.version || Constants.nativeApplicationVersion || '';

// Same rule as the shared rnr Avatar fallback: first two letters of the name.
function initialsOf(name) {
  return String(name || '?').trim().slice(0, 2).toUpperCase();
}

// Rounded-square tinted icon badge — the shared visual unit for every row.
function IconChip({ icon: Icon, color, bg, size = 44, radius = 14 }) {
  return (
    <View style={{ height: size, width: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.48)} color={color} />
    </View>
  );
}

function SectionLabel({ children }) {
  return (
    <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: LABEL, paddingHorizontal: 22, marginTop: 16, marginBottom: 8, letterSpacing: 1.6 }}>
      {children}
    </Text>
  );
}

// White grouped card that all the menu sections sit inside.
function Group({ children }) {
  return (
    <View
      style={{
        marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 20,
        overflow: 'hidden', borderWidth: 1, borderColor: BORDER,
        shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 }, elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function Row({ item, onPress, last }) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#F1F5F9' }} className="active:opacity-80">
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 14, paddingVertical: 11, minHeight: 66,
        }}
      >
        <IconChip icon={item.icon} color={item.color} bg={item.bg} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 13 }}>
          <Text numberOfLines={1} style={{ fontSize: rf(14.5), fontWeight: '700', color: INK }}>
            {item.label}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: rf(12), color: MUTED, marginTop: 2 }}>
            {item.desc}
          </Text>
        </View>
        <ChevronRight size={19} color="#8A97A8" style={{ marginLeft: 8 }} />
      </View>
      {last ? null : <View style={{ height: 1, backgroundColor: DIVIDER, marginLeft: 14, marginRight: 14 }} />}
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
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, minHeight: 66 }}>
      <IconChip icon={Fingerprint} color="#047857" bg="#DCF7EA" />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 13 }}>
        <Text numberOfLines={1} style={{ fontSize: rf(14.5), fontWeight: '700', color: INK }}>
          App Lock
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: rf(11), color: MUTED, marginTop: 2 }}>
          Require fingerprint / pattern / PIN to open
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={toggle}
        disabled={!ready}
        trackColor={{ true: '#047857', false: '#CBD5E1' }}
        thumbColor="#FFFFFF"
        style={{ marginLeft: 8 }}
      />
    </View>
  );
}

// Large initials avatar on a green gradient with a mint ring; shows the
// profile photo instead when the session has one.
function ProfileAvatar({ uri, name, size }) {
  return (
    <View
      style={{
        height: size, width: size, borderRadius: size / 2,
        borderWidth: 3, borderColor: 'rgba(167,243,208,0.85)', overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[PRIMARY, DEEP]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: rf(size * 0.34), fontWeight: '800', letterSpacing: 0.5 }}>
            {initialsOf(name)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

export default function ProfileScreen({ navigation, onLogout: parentLogout }) {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);
  const { width } = useWindowDimensions();
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
  const mobile = session?.mobile || session?.email || '';
  const avatarSize = width >= 600 ? 104 : 96;
  const centered = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* ---------- Hero ---------- */}
      <LinearGradient
        colors={['#003D33', DEEP, PRIMARY, '#0B8A68']}
        locations={[0, 0.4, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 1.1, height: width * 1.1, borderRadius: width,
            right: -width * 0.6, top: -width * 0.5, backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 0.8, height: width * 0.8, borderRadius: width,
            right: -width * 0.35, bottom: -width * 0.5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width,
            left: -width * 0.55, bottom: -width * 0.6, backgroundColor: 'rgba(0,0,0,0.10)',
          }}
        />

        <SafeAreaView edges={['top']}>
          <View style={[centered, { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 }]}>
            {/* Top bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ color: '#FFFFFF', fontSize: rf(24), fontWeight: '800', letterSpacing: -0.3 }}>My Account</Text>
              <Pressable
                onPress={() => navigation.navigate('Notifications')}
                hitSlop={8}
                accessibilityLabel="Notifications"
                className="active:opacity-80"
                style={{
                  height: 46, width: 46, borderRadius: 15,
                  backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Bell size={21} color="#FFFFFF" />
                {unread > 0 ? (
                  <View
                    style={{
                      position: 'absolute', top: 7, right: 8,
                      height: 10, width: 10, borderRadius: 5,
                      backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#0B6B5C',
                    }}
                  />
                ) : null}
              </Pressable>
            </View>

            {/* Identity */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ProfileAvatar uri={session?.profileImageUrl} name={name} size={avatarSize} />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
                <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: rf(21), fontWeight: '800', letterSpacing: -0.2 }}>
                  {name}
                </Text>
                {mobile ? (
                  <Text numberOfLines={1} style={{ color: 'rgba(236,253,245,0.92)', fontSize: rf(14), marginTop: 3 }}>
                    {mobile}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: 'rgba(0,168,107,0.28)', borderRadius: 999,
                      borderWidth: 1, borderColor: 'rgba(167,243,208,0.35)',
                      paddingHorizontal: 10, paddingVertical: 4,
                    }}
                  >
                    <CheckCircle2 size={14} color="#FFFFFF" fill={BRIGHT} />
                    <Text style={{ color: '#FFFFFF', fontSize: rf(11), fontWeight: '800', marginLeft: 5, letterSpacing: 0.6 }}>
                      VERIFIED
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Edit profile */}
            <Pressable
              onPress={() => navigation.navigate('EditProfile')}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
              className="active:opacity-90"
              style={{ marginTop: 18, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(110,231,183,0.75)' }}
            >
              <LinearGradient
                colors={['rgba(0,168,107,0.55)', 'rgba(0,168,107,0.30)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}
              >
                <Pencil size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: rf(15.5), fontWeight: '800', marginLeft: 10 }}>
                  Edit Profile
                </Text>
                <ChevronRight size={20} color="#FFFFFF" style={{ position: 'absolute', right: 14 }} />
              </LinearGradient>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ---------- Body ---------- */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <View style={centered}>
          <SectionLabel>ACCOUNT</SectionLabel>
          <Group>
            {ACCOUNT.map((it, idx) => (
              <Row key={it.label} item={it} onPress={() => navigation.navigate(it.to)} last={idx === ACCOUNT.length - 1} />
            ))}
          </Group>

          <SectionLabel>SECURITY</SectionLabel>
          <Group>
            <AppLockRow />
          </Group>

          <SectionLabel>SUPPORT</SectionLabel>
          <Group>
            {SUPPORT.map((it, idx) => (
              <Row key={it.label} item={it} onPress={() => navigation.navigate(it.to)} last={idx === SUPPORT.length - 1} />
            ))}
          </Group>

          {/* Log out */}
          <Pressable
            onPress={onLogout}
            android_ripple={{ color: '#FEE2E2' }}
            accessibilityRole="button"
            className="active:opacity-80"
            style={{
              marginHorizontal: 16, marginTop: 18, height: 54, borderRadius: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#FFF5F5', borderWidth: 1.5, borderColor: '#F87171',
            }}
          >
            <LogOut size={19} color="#DC2626" />
            <Text style={{ fontSize: rf(15), fontWeight: '800', color: '#DC2626', marginLeft: 10 }}>
              Log out
            </Text>
          </Pressable>

          {/* Footer */}
          {APP_VERSION ? (
            <Text style={{ textAlign: 'center', fontSize: rf(11), color: '#8A97A8', marginTop: 14 }}>
              App Version {APP_VERSION}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
            <Text style={{ fontSize: rf(11), color: '#8A97A8' }}>Made with </Text>
            <Heart size={12} color="#EF4444" fill="#EF4444" />
            <Text style={{ fontSize: rf(11), color: '#8A97A8' }}> in India</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
