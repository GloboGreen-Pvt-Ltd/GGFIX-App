import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Plus, MapPin, Phone, Pencil, Trash2,
  CheckCircle2, Circle, Home, Briefcase, Tag, Bell,
} from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listAddresses, deleteAddress, setDefaultAddress } from '../../../api/customer';
import { rf, rlh } from '../../../utils/responsive';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';

const LABEL_META = {
  Home:   { icon: Home,      color: GREEN_DARK, bg: '#DCFCE7' },
  Office: { icon: Briefcase, color: '#7C3AED',  bg: '#F5F3FF' },
  Other:  { icon: Tag,       color: '#C2410C',  bg: '#FFEDD5' },
};

function ScreenHeader({ navigation, count }) {
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
              MANAGE ADDRESSES
            </Text>
            <Text style={{ color: '#fff', fontSize: rf(19), fontWeight: '800', marginTop: 2, letterSpacing: -0.2 }}>
              {count ? `${count} saved address${count > 1 ? 'es' : ''}` : 'Your delivery locations'}
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

function AddressCard({ a, onSetDefault, onEdit, onDelete }) {
  const meta = LABEL_META[a.label] || LABEL_META.Home;
  const Icon = meta.icon;
  // Door no. → Area → Taluk → District → State → Pincode. Fall back to the
  // legacy columns when the new ones aren't populated (pre-migration rows):
  //   area     ← locality
  //   district ← city
  const area = a.area || a.locality;
  const district = a.district || a.city;
  const fullAddr = [a.addressLine, area, a.taluk, district, a.state, a.pincode]
    .filter(Boolean).join(', ');
  return (
    <View
      style={{
        backgroundColor: '#fff', borderRadius: 18,
        padding: 14, marginBottom: 12,
        borderWidth: 1,
        borderColor: a.isDefault ? '#BBF7D0' : '#F1F5F9',
        shadowColor: '#0F172A', shadowOpacity: 0.05,
        shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            height: 36, width: 36, borderRadius: 18,
            backgroundColor: meta.bg,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Icon size={16} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: rf(14.5), fontWeight: '800', color: '#0F172A' }}>
            {a.label || 'Home'}
          </Text>
          {a.fullName ? (
            <Text style={{ fontSize: rf(12), color: '#475569', marginTop: 1 }} numberOfLines={1}>
              {a.fullName}
            </Text>
          ) : null}
        </View>
        {a.isDefault ? (
          <View
            style={{
              backgroundColor: '#DCFCE7', borderRadius: 999,
              paddingHorizontal: 10, paddingVertical: 4,
              flexDirection: 'row', alignItems: 'center',
            }}
          >
            <CheckCircle2 size={11} color={GREEN_DARK} />
            <Text style={{ color: GREEN_DARK, fontSize: rf(10), fontWeight: '800', marginLeft: 4, letterSpacing: 0.4 }}>
              DEFAULT
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}>
        <MapPin size={14} color="#64748B" style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontSize: rf(12.5), color: '#475569', marginLeft: 6, lineHeight: rlh(18) }}>
          {fullAddr}
        </Text>
      </View>
      {a.mobile ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <Phone size={13} color="#64748B" />
          <Text style={{ fontSize: rf(12.5), color: '#475569', marginLeft: 6 }}>
            +91 {a.mobile}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row', marginTop: 12,
          paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
        }}
      >
        {!a.isDefault ? (
          <>
            <Pressable
              onPress={() => onSetDefault(a.id)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
            >
              <Circle size={14} color={GREEN_DARK} />
              <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: GREEN_DARK }}>
                Set default
              </Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: '#F1F5F9' }} />
          </>
        ) : null}
        <Pressable
          onPress={onEdit}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
        >
          <Pencil size={13} color="#0F172A" />
          <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: '#0F172A' }}>Edit</Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: '#F1F5F9' }} />
        <Pressable
          onPress={() => onDelete(a.id)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
        >
          <Trash2 size={13} color="#EF4444" />
          <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: '#EF4444' }}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ManageAddressScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await listAddresses();
      setItems(list || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete',
      message: 'Are you sure you want to delete the address?',
      confirmText: 'Yes', cancelText: 'No', destructive: true,
    });
    if (!ok) return;
    try { await deleteAddress(id); load(); } catch (e) { notify('Error', e.message); }
  };

  const onSetDefault = async (id) => {
    try { await setDefaultAddress(id); load(); } catch (e) { notify('Error', e.message); }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader navigation={navigation} count={0} />
        <Loader label="Loading addresses..." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader navigation={navigation} count={items.length} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.navigate('AddressForm', {})}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#fff', borderRadius: 16,
            paddingVertical: 14, paddingHorizontal: 14,
            marginBottom: 16,
            borderWidth: 1, borderColor: '#BBF7D0',
            borderStyle: 'dashed',
          }}
        >
          <View
            style={{
              height: 36, width: 36, borderRadius: 18,
              backgroundColor: '#DCFCE7',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Plus size={18} color={GREEN_DARK} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: rf(14), fontWeight: '800', color: GREEN_DARK }}>
              Add a new address
            </Text>
            <Text style={{ fontSize: rf(11.5), color: '#64748B', marginTop: 2 }}>
              Save home, office, or any other location
            </Text>
          </View>
        </Pressable>

        {items.length === 0 ? (
          <EmptyState
            icon={<MapPin size={28} color={GREEN} />}
            title="No addresses yet"
            description="Add one to get started with pickup and delivery."
          />
        ) : (
          items.map((a) => (
            <AddressCard
              key={a.id}
              a={a}
              onSetDefault={onSetDefault}
              onEdit={() => navigation.navigate('AddressForm', { address: a })}
              onDelete={onDelete}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
