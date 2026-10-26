import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Bell, LifeBuoy, Phone, Mail, MessageCircle,
  Package, RotateCcw, IndianRupee, ShieldCheck, ChevronRight, Clock,
} from 'lucide-react-native';
import { Loader } from '../../../components/rnr';
import { getSupportContacts } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import PageHeader, { HeaderIconButton } from '../../../components/PageHeader';

const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const RED_SOFT = '#FEECEC';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 };

const DEFAULT_EMAIL = 'Support@globogreen.com';
const DEFAULT_PHONE = '+91 85476 54646';
const DEFAULT_WHATSAPP = '+91 85476 54646';

const QUICK_TOPICS = [
  { key: 'order',  icon: Package,      label: 'Track an order',   color: BRAND.green,  bg: MINT,        sub: 'Repair · Pickup · Buy · Sell' },
  { key: 'refund', icon: IndianRupee,  label: 'Refund status',    color: BRAND.yellow, bg: YELLOW_SOFT, sub: 'See refund timeline & status' },
  { key: 'return', icon: RotateCcw,    label: 'Return / Cancel',  color: BRAND.red,    bg: RED_SOFT,    sub: 'Cancel a booking or return item' },
  { key: 'warranty', icon: ShieldCheck, label: 'Warranty',        color: BRAND.green,  bg: MINT,        sub: 'Repair warranty queries' },
];

function ScreenHeader({ navigation }) {
  return (
    <PageHeader
      title="Customer Support"
      subtitle="We're here to help"
      onBack={() => navigation.goBack()}
      right={<HeaderIconButton icon={Bell} label="Notifications" onPress={() => navigation.navigate('Notifications')} />}
    />
  );
}

function SectionTitle({ title, sub }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 6 }}>
      <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink, letterSpacing: -0.2 }}>{title}</Text>
      <Text style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 1 }}>{sub}</Text>
    </View>
  );
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function ContactTile({ icon: Icon, label, value, tint, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: tint }}
      className="active:opacity-80"
      style={{
        flex: 1,
        marginHorizontal: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 10, paddingHorizontal: 8,
        alignItems: 'center',
        borderWidth: 1, borderColor: LINE,
        ...cardShadow,
      }}
    >
      <View
        style={{
          height: 34, width: 34, borderRadius: 17,
          backgroundColor: tint,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        <Icon size={16} color={color} />
      </View>
      <Text style={{ fontSize: rf(12), fontWeight: '800', color: BRAND.ink }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontSize: rf(10), color: BRAND.muted, marginTop: 1 }}>
        {value}
      </Text>
    </Pressable>
  );
}

function TopicRow({ topic, onPress, last }) {
  const Icon = topic.icon;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: BRAND.line }} className="active:opacity-80">
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, paddingVertical: 9,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: BRAND.line,
        }}
      >
        <View
          style={{
            height: 30, width: 30, borderRadius: 15,
            backgroundColor: topic.bg,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Icon size={15} color={topic.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: rf(13), fontWeight: '800', color: BRAND.ink }}>{topic.label}</Text>
          <Text style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 1 }} numberOfLines={1}>
            {topic.sub}
          </Text>
        </View>
        <ChevronRight size={15} color={BRAND.muted} />
      </View>
    </Pressable>
  );
}

function ContactRow({ icon: Icon, caption, value, tint, color, onPress, last }) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: tint }} className="active:opacity-80">
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, paddingVertical: 9,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: BRAND.line,
        }}
      >
        <View
          style={{
            height: 30, width: 30, borderRadius: 15,
            backgroundColor: tint,
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
          }}
        >
          <Icon size={15} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: rf(9.5), color: BRAND.muted, fontWeight: '700', letterSpacing: 0.6 }}>
            {caption}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: rf(13), color: BRAND.ink, fontWeight: '800', marginTop: 1 }}>
            {value}
          </Text>
        </View>
        <ChevronRight size={15} color={BRAND.muted} />
      </View>
    </Pressable>
  );
}

const groupCard = {
  marginHorizontal: 16,
  backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
  borderWidth: 1, borderColor: LINE,
  ...cardShadow,
};

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
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
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
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScreenHeader navigation={navigation} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={{ paddingHorizontal: 12, marginTop: 12, flexDirection: 'row' }}>
          <ContactTile
            icon={Phone} label="Call us" value="Tap to call"
            tint={MINT} color={BRAND.green} onPress={openTel}
          />
          <ContactTile
            icon={MessageCircle} label="WhatsApp" value="Chat now"
            tint={MINT} color={BRAND.green} onPress={openWhatsapp}
          />
          <ContactTile
            icon={Mail} label="Email" value="Within 24 hrs"
            tint={YELLOW_SOFT} color={BRAND.yellow} onPress={openMail}
          />
        </View>

        <SectionTitle title="Quick help" sub="Most asked topics — tap to view details" />
        <View style={groupCard}>
          {QUICK_TOPICS.map((t, i) => (
            <TopicRow
              key={t.key}
              topic={t}
              onPress={() => goTopic(t.key)}
              last={i === QUICK_TOPICS.length - 1}
            />
          ))}
        </View>

        <SectionTitle title="Reach us directly" sub="Available all 7 days" />
        <View style={groupCard}>
          <ContactRow icon={Phone} caption="CALL US" value={phoneRow} tint={MINT} color={BRAND.green} onPress={openTel} />
          <ContactRow icon={MessageCircle} caption="WHATSAPP" value={whatsappRow} tint={MINT} color={BRAND.green} onPress={openWhatsapp} />
          <ContactRow icon={Mail} caption="EMAIL" value={emailRow} tint={YELLOW_SOFT} color={BRAND.yellow} onPress={openMail} last />
        </View>

        <View
          style={{
            marginHorizontal: 16, marginTop: 10,
            backgroundColor: '#FFFFFF', borderRadius: 14,
            paddingHorizontal: 12, paddingVertical: 9,
            borderWidth: 1, borderColor: LINE,
            flexDirection: 'row', alignItems: 'center',
          }}
        >
          <View
            style={{
              height: 30, width: 30, borderRadius: 15,
              backgroundColor: YELLOW_SOFT,
              alignItems: 'center', justifyContent: 'center', marginRight: 10,
            }}
          >
            <Clock size={15} color={BRAND.yellow} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>
              Operating hours
            </Text>
            <Text numberOfLines={1} style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 1 }}>
              Mon - Sun · 9:00 AM to 9:00 PM IST
            </Text>
          </View>
        </View>

        <View
          style={{
            marginHorizontal: 16, marginTop: 14, marginBottom: 6,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LifeBuoy size={12} color={BRAND.green} />
          <Text style={{ fontSize: rf(10.5), color: BRAND.muted, marginLeft: 6, fontWeight: '600' }}>
            Globo Green · Mobile accessories, spares & services
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
