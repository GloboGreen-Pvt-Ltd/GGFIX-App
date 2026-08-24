import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { confirm, notify } from '../../../components/confirm';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  MapPin,
  FileText,
  Info,
  HelpCircle,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Pencil,
  ShieldCheck,
  Bell,
  Fingerprint,
} from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { clearSession as clearAuth, selectSession } from '../../../store/authSlice';
import { clearSession } from '../../../auth/session';
import { Avatar } from '../../../components/rnr';
import { isAppLockEnabled, setAppLockEnabled, isDeviceSecure, authenticate } from '../../../auth/appLock';
import { rf } from '../../../utils/responsive';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';
const INK = '#0F172A';
const MUTED = '#64748B';
const SUBTLE = '#94A3B8';
const HAIRLINE = '#EEF1F4';
const DIVIDER = '#F4F6F8';

const ACCOUNT = [
  { label: 'My Orders',        desc: 'Track & manage your orders',   icon: ShoppingBag,  to: 'MyOrders',      color: GREEN_DARK, bg: '#DCFCE7' },
  { label: 'My Cart',          desc: 'Items saved for checkout',     icon: ShoppingCart, to: 'MyCart',        color: '#C2410C',  bg: '#FFEDD5' },
  { label: 'Manage My Device', desc: 'Your saved devices',           icon: Smartphone,   to: 'ManageDevice',  color: '#7C3AED',  bg: '#F5F3FF' },
  { label: 'Manage Addresses', desc: 'Delivery & pickup addresses',  icon: MapPin,       to: 'ManageAddress', color: '#0369A1',  bg: '#F0F9FF' },
];

const SUPPORT = [
  { label: 'Customer Support',   desc: "We're here to help",          icon: LifeBuoy,   to: 'CustomerSupport', color: '#B45309', bg: '#FEF3C7' },
  { label: 'FAQ',                desc: 'Answers to common questions',  icon: HelpCircle, to: 'Faq',             color: GREEN_DARK, bg: '#DCFCE7' },
  { label: 'About Us',           desc: 'Learn about GGFIX',            icon: Info,       to: 'AboutUs',         color: '#7C3AED',  bg: '#F5F3FF' },
  { label: 'Terms & Conditions', desc: 'Policies & agreements',        icon: FileText,   to: 'Terms',           color: '#475569',  bg: '#F1F5F9' },
];

// Rounded-square (squircle) tinted icon badge — the shared visual unit for
// every list row and quick action, so the whole screen reads as one system.
function IconChip({ icon: Icon, color, bg, size = 40, radius = 13 }) {
  return (
    <View style={{ height: size, width: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.46)} color={color} />
    </View>
  );
}

function SectionLabel({ children, style }) {
  return (
    <Text
      style={[{ fontSize: rf(11), fontWeight: '800', color: SUBTLE, paddingHorizontal: 22, marginTop: 22, marginBottom: 10, letterSpacing: 1 }, style]}
    >
      {children}
    </Text>
  );
}

// White grouped card that all the menu sections sit inside.
function Group({ children, style }) {
  return (
    <View
      style={[
        {
          marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20,
          overflow: 'hidden', borderWidth: 1, borderColor: HAIRLINE,
          shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 }, elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Row({ item, onPress, last }) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#F1F5F9' }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 14, paddingVertical: 13,
          borderBottomWidth: last ? 0 : 1, borderBottomColor: DIVIDER,
        }}
      >
        <IconChip icon={item.icon} color={item.color} bg={item.bg} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Text numberOfLines={1} style={{ fontSize: rf(14), fontWeight: '700', color: INK }}>
            {item.label}
          </Text>
          {item.desc ? (
            <Text numberOfLines={1} style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2 }}>
              {item.desc}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={18} color="#CBD5E1" style={{ marginLeft: 8 }} />
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
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 }}>
      <IconChip icon={Fingerprint} color={GREEN_DARK} bg="#DCFCE7" />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
        <Text numberOfLines={1} style={{ fontSize: rf(14), fontWeight: '700', color: INK }}>
          App Lock
        </Text>
        <Text numberOfLines={1} style={{ fontSize: rf(11.5), color: MUTED, marginTop: 2 }}>
          Require fingerprint / pattern / PIN to open
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={toggle}
        disabled={!ready}
        trackColor={{ true: GREEN, false: '#CBD5E1' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function ProfileScreen({ navigation, onLogout: parentLogout }) {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);

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

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* ---------- Header ---------- */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
        <LinearGradient
          colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 6, paddingBottom: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}
        >
          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 }}>
            <Text style={{ color: '#fff', fontSize: rf(17), fontWeight: '800', letterSpacing: 0.2 }}>My Account</Text>
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={8}
              style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Bell size={18} color="#fff" />
            </Pressable>
          </View>

          {/* Identity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <Avatar source={session?.profileImageUrl || undefined} fallback={name} size={60} className="border-2 border-white/50" />
            <View style={{ flex: 1, marginLeft: 13 }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: rf(18), fontWeight: '800' }}>
                {name}
              </Text>
              {mobile ? (
                <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.9)', fontSize: rf(12.5), marginTop: 2 }}>
                  {mobile}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999,
                    paddingHorizontal: 9, paddingVertical: 3,
                  }}
                >
                  <ShieldCheck size={11} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: rf(9.5), fontWeight: '800', marginLeft: 4, letterSpacing: 0.5 }}>
                    VERIFIED
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Edit profile */}
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <Pressable
              onPress={() => navigation.navigate('EditProfile')}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingVertical: 11,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
              }}
            >
              <Pencil size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: rf(13.5), fontWeight: '800', marginLeft: 7, letterSpacing: 0.2 }}>
                Edit Profile
              </Text>
            </Pressable>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* ---------- Body ---------- */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Account */}
        <SectionLabel>ACCOUNT</SectionLabel>
        <Group>
          {ACCOUNT.map((it, idx) => (
            <Row key={it.label} item={it} onPress={() => navigation.navigate(it.to)} last={idx === ACCOUNT.length - 1} />
          ))}
        </Group>

        {/* Security */}
        <SectionLabel>SECURITY</SectionLabel>
        <Group>
          <AppLockRow />
        </Group>

        {/* Support */}
        <SectionLabel>SUPPORT</SectionLabel>
        <Group>
          {SUPPORT.map((it, idx) => (
            <Row key={it.label} item={it} onPress={() => navigation.navigate(it.to)} last={idx === SUPPORT.length - 1} />
          ))}
        </Group>

        {/* Log out */}
        <Pressable onPress={onLogout} android_ripple={{ color: '#FEE2E2' }} style={{ marginHorizontal: 16, marginTop: 22 }}>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingVertical: 14, borderRadius: 16,
              backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
            }}
          >
            <LogOut size={17} color="#DC2626" />
            <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#DC2626', letterSpacing: 0.2, marginLeft: 9 }}>
              Log out
            </Text>
          </View>
        </Pressable>

        {/* Footer */}
        <Text style={{ textAlign: 'center', fontSize: rf(10.5), color: SUBTLE, marginTop: 20 }}>
          App Version 1.0.1
        </Text>
        <Text style={{ textAlign: 'center', fontSize: rf(10.5), color: SUBTLE, marginTop: 2 }}>
          Made with ❤️ in India
        </Text>
      </ScrollView>
    </View>
  );
}
