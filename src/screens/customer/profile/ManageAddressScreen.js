import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus, MapPin, Phone, Pencil, Trash2,
  CheckCircle2, Circle, Home, Briefcase, Tag, Bell,
} from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { confirm, notify } from '../../../components/confirm';
import { listAddresses, deleteAddress, setDefaultAddress } from '../../../api/customer';
import { rf, rlh } from '../../../utils/responsive';
import PageHeader, { HeaderIconButton } from '../../../components/PageHeader';
import { BRAND } from '../../../theme/brand';

// Palette: 09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141.
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const GREEN_LINE = 'rgba(9,173,42,0.45)';

const LABEL_META = {
  Home:   { icon: Home,      color: GREEN_TEXT, bg: MINT },
  Office: { icon: Briefcase, color: BRAND.ink,  bg: '#FEF6DA' },
  Other:  { icon: Tag,       color: BRAND.red,  bg: '#FEECEC' },
};

function ScreenHeader({ navigation, count }) {
  return (
    <PageHeader
      title="Manage Addresses"
      subtitle={count ? `${count} saved address${count > 1 ? 'es' : ''}` : 'Your delivery locations'}
      onBack={() => navigation.goBack()}
      right={<HeaderIconButton icon={Bell} label="Notifications" onPress={() => navigation.navigate('Notifications')} />}
    />
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
  const action = { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 };
  return (
    <View
      style={{
        backgroundColor: '#fff', borderRadius: 14, padding: 11, marginBottom: 9,
        borderWidth: 1, borderColor: a.isDefault ? GREEN_LINE : LINE,
        shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ height: 32, width: 32, borderRadius: 10, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
          <Icon size={15} color={meta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>
            {a.label || 'Home'}
          </Text>
          {a.fullName ? (
            <Text style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 1 }} numberOfLines={1}>
              {a.fullName}
            </Text>
          ) : null}
        </View>
        {a.isDefault ? (
          <View style={{ backgroundColor: MINT, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' }}>
            <CheckCircle2 size={10} color={GREEN_TEXT} />
            <Text style={{ color: GREEN_TEXT, fontSize: rf(9), fontWeight: '800', marginLeft: 3, letterSpacing: 0.4 }}>
              DEFAULT
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
        <MapPin size={13} color={BRAND.red} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: rf(11.5), color: BRAND.body, marginLeft: 6, lineHeight: rlh(16) }} numberOfLines={3}>
          {fullAddr}
        </Text>
      </View>
      {a.mobile ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Phone size={12} color={BRAND.muted} />
          <Text style={{ fontSize: rf(11.5), color: BRAND.body, marginLeft: 6 }}>
            +91 {a.mobile}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', marginTop: 9, paddingTop: 7, borderTopWidth: 1, borderTopColor: BRAND.line }}>
        {!a.isDefault ? (
          <>
            <Pressable onPress={() => onSetDefault(a.id)} className="active:opacity-70" style={action}>
              <Circle size={13} color={GREEN_TEXT} />
              <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: GREEN_TEXT }}>
                Set default
              </Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: BRAND.line }} />
          </>
        ) : null}
        <Pressable onPress={onEdit} className="active:opacity-70" style={action}>
          <Pencil size={12} color={BRAND.ink} />
          <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: BRAND.ink }}>Edit</Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: BRAND.line }} />
        <Pressable onPress={() => onDelete(a.id)} className="active:opacity-70" style={action}>
          <Trash2 size={12} color={BRAND.red} />
          <Text style={{ marginLeft: 5, fontSize: rf(11.5), fontWeight: '800', color: BRAND.red }}>Delete</Text>
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
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <ScreenHeader navigation={navigation} count={0} />
        <Loader label="Loading addresses..." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScreenHeader navigation={navigation} count={items.length} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.navigate('AddressForm', {})}
          className="active:opacity-85"
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#F4FBF5', borderRadius: 14,
            paddingVertical: 8, paddingHorizontal: 10,
            marginBottom: 10,
            borderWidth: 1, borderColor: GREEN_LINE,
            borderStyle: 'dashed',
          }}
        >
          <View
            style={{
              height: 30, width: 30, borderRadius: 15,
              backgroundColor: MINT,
              alignItems: 'center', justifyContent: 'center',
              marginRight: 9,
            }}
          >
            <Plus size={16} color={GREEN_TEXT} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(13), fontWeight: '800', color: GREEN_TEXT }} numberOfLines={1}>
              Add a new address
            </Text>
            <Text style={{ fontSize: rf(10.5), color: BRAND.muted, marginTop: 1 }} numberOfLines={1}>
              Save home, office, or any other location
            </Text>
          </View>
        </Pressable>

        {items.length === 0 ? (
          <EmptyState
            icon={<MapPin size={28} color={BRAND.green} />}
            accent={BRAND.green}
            accentSoft={MINT}
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
