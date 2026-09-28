import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Bell, LifeBuoy, Phone, Mail, MessageCircle,
  Package, RotateCcw, IndianRupee, ShieldCheck, ChevronRight, Clock,
} from 'lucide-react-native';
import { Loader } from '../../../components/rnr';
import { getSupportContacts } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';

const DEFAULT_EMAIL = 'Support@globogreen.com';
const DEFAULT_PHONE = '+91 85476 54646';
const DEFAULT_WHATSAPP = '+91 85476 54646';

const QUICK_TOPICS = [
  { key: 'order',  icon: Package,      label: 'Track an order',   color: GREEN_DARK,  bg: '#DCFCE7', sub: 'Repair · Pickup · Buy · Sell' },
  { key: 'refund', icon: IndianRupee,  label: 'Refund status',    color: '#C2410C',   bg: '#FFEDD5', sub: 'See refund timeline & status' },
  { key: 'return', icon: RotateCcw,    label: 'Return / Cancel',  color: '#B45309',   bg: '#FEF3C7', sub: 'Cancel a booking or return item' },
  { key: 'warranty', icon: ShieldCheck, label: 'Warranty',        color: '#0369A1',   bg: '#F0F9FF', sub: 'Repair warranty queries' },
];

function ScreenHeader({ navigation }) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: GREEN_DARK }}>
      <LinearGradient
        colors={[GREEN_DARK, GREEN, GREEN_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: 12,
          paddingBottom: 18,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              height: 36, width: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <ArrowLeft size={18} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: rf(12.5), fontWeight: '800', letterSpacing: 0.6 }}>
              CUSTOMER SUPPORT
            </Text>
            <Text style={{ color: '#fff', fontSize: rf(19), fontWeight: '800', marginTop: 2, letterSpacing: -0.2 }}>
              We're here to help
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            style={{
              height: 36, width: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Bell size={18} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function ContactTile({ icon: Icon, label, value, tint, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: tint }}
      style={{
        flex: 1,
        marginHorizontal: 4,
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 14, paddingHorizontal: 10,
        alignItems: 'center',
        borderWidth: 1, borderColor: '#F1F5F9',
        shadowColor: '#0F172A', shadowOpacity: 0.05,
        shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
      }}
    >
      <View
        style={{
          height: 44, width: 44, borderRadius: 22,
          backgroundColor: tint,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Icon size={20} color={color} />
      </View>
      <Text style={{ fontSize: rf(12), fontWeight: '800', color: '#0F172A' }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontSize: rf(10.5), color: '#64748B', marginTop: 2 }}>
        {value}
      </Text>
    </Pressable>
  );
}

function TopicRow({ topic, onPress, last }) {
  const Icon = topic.icon;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#F1F5F9' }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 14, paddingVertical: 12,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: '#F1F5F9',
        }}
      >
        <View
          style={{
            height: 36, width: 36, borderRadius: 18,
            backgroundColor: topic.bg,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Icon size={16} color={topic.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: '#0F172A' }}>{topic.label}</Text>
          <Text style={{ fontSize: rf(11.5), color: '#64748B', marginTop: 1 }} numberOfLines={1}>
            {topic.sub}
          </Text>
        </View>
        <ChevronRight size={16} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

export default function CustomerSupportScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setContacts(await getSupportContacts()); } catch (_) {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader navigation={navigation} />
        <Loader label="Loading support..." />
      </View>
    );
  }

  // Pull canonical phone + email from admin-driven master_support_contacts
  // when available; fall back to the brand defaults otherwise.
  const phoneRow = contacts.find((c) => c.phone)?.phone || DEFAULT_PHONE;
  const emailRow = contacts.find((c) => c.email)?.email || DEFAULT_EMAIL;
  const whatsappRow = contacts.find((c) => c.whatsapp)?.whatsapp || DEFAULT_WHATSAPP;

  const openTel = () => Linking.openURL(`tel:${phoneRow.replace(/\s+/g, '')}`);
  const openMail = () => Linking.openURL(`mailto:${emailRow}`);
  const openWhatsapp = () => {
    const num = whatsappRow.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${num}`);
  };

  const goTopic = (key) => {
    if (key === 'order') navigation.navigate('MyOrders');
    else if (key === 'warranty') navigation.navigate('Faq');
    else navigation.navigate('Faq');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader navigation={navigation} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View style={{ paddingHorizontal: 12, marginTop: 16, flexDirection: 'row' }}>
          <ContactTile
            icon={Phone} label="Call us" value="Tap to call"
            tint="#DCFCE7" color={GREEN_DARK} onPress={openTel}
          />
          <ContactTile
            icon={MessageCircle} label="WhatsApp" value="Chat now"
            tint="#DCFCE7" color={GREEN_DARK} onPress={openWhatsapp}
          />
          <ContactTile
            icon={Mail} label="Email" value="Within 24 hrs"
            tint="#FFEDD5" color="#C2410C" onPress={openMail}
          />
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 22, marginBottom: 8 }}>
          <Text style={{ fontSize: rf(17), fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 }}>
            Quick help
          </Text>
          <Text style={{ fontSize: rf(12), color: '#64748B', marginTop: 2 }}>
            Most asked topics — tap to view details
          </Text>
        </View>
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
            borderWidth: 1, borderColor: '#F1F5F9',
            shadowColor: '#0F172A', shadowOpacity: 0.04,
            shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
          }}
        >
          {QUICK_TOPICS.map((t, i) => (
            <TopicRow
              key={t.key}
              topic={t}
              onPress={() => goTopic(t.key)}
              last={i === QUICK_TOPICS.length - 1}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 22, marginBottom: 8 }}>
          <Text style={{ fontSize: rf(17), fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 }}>
            Reach us directly
          </Text>
          <Text style={{ fontSize: rf(12), color: '#64748B', marginTop: 2 }}>
            Available all 7 days
          </Text>
        </View>

        <Pressable
          onPress={openTel}
          android_ripple={{ color: '#DCFCE7' }}
          style={{
            marginHorizontal: 16, marginBottom: 10,
            backgroundColor: '#fff', borderRadius: 16,
            paddingHorizontal: 14, paddingVertical: 14,
            borderWidth: 1, borderColor: '#F1F5F9',
            flexDirection: 'row', alignItems: 'center',
            shadowColor: '#0F172A', shadowOpacity: 0.04,
            shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
          }}
        >
          <View
            style={{
              height: 38, width: 38, borderRadius: 19,
              backgroundColor: '#DCFCE7',
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}
          >
            <Phone size={17} color={GREEN_DARK} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(11.5), color: '#64748B', fontWeight: '700', letterSpacing: 0.4 }}>
              CALL US
            </Text>
            <Text style={{ fontSize: rf(14.5), color: '#0F172A', fontWeight: '800', marginTop: 1 }}>
              {phoneRow}
            </Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>

        <Pressable
          onPress={openWhatsapp}
          android_ripple={{ color: '#DCFCE7' }}
          style={{
            marginHorizontal: 16, marginBottom: 10,
            backgroundColor: '#fff', borderRadius: 16,
            paddingHorizontal: 14, paddingVertical: 14,
            borderWidth: 1, borderColor: '#F1F5F9',
            flexDirection: 'row', alignItems: 'center',
            shadowColor: '#0F172A', shadowOpacity: 0.04,
            shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
          }}
        >
          <View
            style={{
              height: 38, width: 38, borderRadius: 19,
              backgroundColor: '#DCFCE7',
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}
          >
            <MessageCircle size={17} color={GREEN_DARK} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(11.5), color: '#64748B', fontWeight: '700', letterSpacing: 0.4 }}>
              WHATSAPP
            </Text>
            <Text style={{ fontSize: rf(14.5), color: '#0F172A', fontWeight: '800', marginTop: 1 }}>
              {whatsappRow}
            </Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>

        <Pressable
          onPress={openMail}
          android_ripple={{ color: '#FFEDD5' }}
          style={{
            marginHorizontal: 16, marginBottom: 10,
            backgroundColor: '#fff', borderRadius: 16,
            paddingHorizontal: 14, paddingVertical: 14,
            borderWidth: 1, borderColor: '#F1F5F9',
            flexDirection: 'row', alignItems: 'center',
            shadowColor: '#0F172A', shadowOpacity: 0.04,
            shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
          }}
        >
          <View
            style={{
              height: 38, width: 38, borderRadius: 19,
              backgroundColor: '#FFEDD5',
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}
          >
            <Mail size={17} color="#C2410C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(11.5), color: '#64748B', fontWeight: '700', letterSpacing: 0.4 }}>
              EMAIL
            </Text>
            <Text numberOfLines={1} style={{ fontSize: rf(14.5), color: '#0F172A', fontWeight: '800', marginTop: 1 }}>
              {emailRow}
            </Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>

        <View
          style={{
            marginHorizontal: 16, marginTop: 14,
            backgroundColor: '#fff', borderRadius: 16,
            paddingHorizontal: 14, paddingVertical: 14,
            borderWidth: 1, borderColor: '#F1F5F9',
            flexDirection: 'row', alignItems: 'center',
          }}
        >
          <View
            style={{
              height: 36, width: 36, borderRadius: 18,
              backgroundColor: '#FEF3C7',
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}
          >
            <Clock size={16} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#0F172A' }}>
              Operating hours
            </Text>
            <Text style={{ fontSize: rf(11.5), color: '#64748B', marginTop: 1 }}>
              Mon - Sun · 9:00 AM to 9:00 PM IST
            </Text>
          </View>
        </View>

        <View
          style={{
            marginHorizontal: 16, marginTop: 16, marginBottom: 6,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LifeBuoy size={12} color="#94A3B8" />
          <Text style={{ fontSize: rf(10.5), color: '#94A3B8', marginLeft: 6, fontWeight: '600' }}>
            Globo Green · Mobile accessories, spares & services
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
