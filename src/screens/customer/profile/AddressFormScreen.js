import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';
import {
  User,
  MapPin,
  Home,
  Briefcase,
  Tag,
  Crosshair,
  Navigation,
  ArrowLeft,
} from 'lucide-react-native';
import { BottomActionBar, useBottomBarInset } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { createAddress, updateAddress } from '../../../api/customer';
import { selectSession } from '../../../store/authSlice';
import { rf } from '../../../utils/responsive';

const GREEN = '#004C40';
const GREEN_LIGHT = '#00695C';
const GREEN_DARK = '#003830';

const LABEL_OPTIONS = [
  { value: 'Home',   icon: Home,       color: GREEN_DARK, tint: '#DCFCE7' },
  { value: 'Office', icon: Briefcase,  color: '#7C3AED',  tint: '#F5F3FF' },
  { value: 'Other',  icon: Tag,        color: '#C2410C',  tint: '#FFEDD5' },
];

function SectionCard({ icon: Icon, iconColor, iconBg, title, subtitle, right, children }) {
  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
    >
      <View className="flex-row items-center mb-3">
        <View className="h-9 w-9 rounded-full items-center justify-center mr-2.5" style={{ backgroundColor: iconBg }}>
          <Icon size={16} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }}>{title}</Text>
          {subtitle ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <View className="mb-3">
      <Text className="font-semibold text-text-muted mb-1.5" style={{ fontSize: rf(12) }}>
        {label}{required ? <Text className="text-danger"> *</Text> : null}
      </Text>
      {children}
      {hint ? <Text className="text-text-muted mt-1" style={{ fontSize: rf(10) }}>{hint}</Text> : null}
    </View>
  );
}

// Bare-bones text input. No internal state, no nested wrappers — every form
// field is the same shape so React can keep stable instances across renders
// (any unmount = keyboard dismiss = "typing not working").
function PlainInput({ error, multiline, ...props }) {
  return (
    <View
      style={{
        backgroundColor: '#fff', borderRadius: 12,
        borderWidth: 1, borderColor: error ? '#EF4444' : '#E5E7EB',
        paddingHorizontal: 14, paddingVertical: multiline ? 10 : 0,
      }}
    >
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#94A3B8"
        style={{
          fontSize: rf(14), color: '#0F172A',
          paddingVertical: multiline ? 0 : 12,
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? 'top' : 'auto',
        }}
      />
    </View>
  );
}

function FormHeader({ navigation, isEdit }) {
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
              {isEdit ? 'EDIT ADDRESS' : 'ADD ADDRESS'}
            </Text>
            <Text style={{ color: '#fff', fontSize: rf(19), fontWeight: '800', marginTop: 2, letterSpacing: -0.2 }}>
              {isEdit ? 'Update your address' : 'Where should we deliver?'}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

export default function AddressFormScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  const existing = route?.params?.address;
  const session = useSelector(selectSession);
  // For a new address, seed contact from the logged-in customer's profile so
  // they don't retype name/mobile every time. For an edit, the existing
  // address's values win.
  const [data, setData] = useState({
    label: existing?.label || 'Home',
    fullName: existing?.fullName || session?.fullName || '',
    mobile: existing?.mobile || session?.mobile || '',
    pincode: existing?.pincode || '',
    area: existing?.area || existing?.locality || '',            // Form label "Area"
    addressLine: existing?.addressLine || '',                    // Door no. / Street
    district: existing?.district || existing?.city || '',
    taluk: existing?.taluk || '',
    state: existing?.state || '',
    // Hidden — captured by "Use my current location" so the backend can compute
    // nearby-shop distances. Not shown in the form UI.
    latitude: existing?.latitude ?? null,
    longitude: existing?.longitude ?? null,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const setField = (k, v) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = async () => {
    const next = {};
    if (!data.fullName.trim()) next.fullName = 'Required';
    if (!data.mobile.trim()) next.mobile = 'Required';
    else if (!/^[6-9]\d{9}$/.test(data.mobile.trim())) next.mobile = 'Enter a 10-digit Indian mobile';
    if (!data.pincode.trim()) next.pincode = 'Required';
    else if (!/^\d{6}$/.test(data.pincode.trim())) next.pincode = 'Enter a 6-digit PIN';
    if (!data.addressLine.trim()) next.addressLine = 'Required';
    if (!data.district.trim()) next.district = 'Required';
    if (!data.state.trim()) next.state = 'Required';
    setErrors(next);
    if (Object.keys(next).length) {
      notify('Check the form', 'Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    // Send the legacy mirrors (locality, city) alongside the new canonical
    // fields (area, district). Belt-and-braces — works against the new backend
    // (dual-write logic prefers explicit locality/city when sent), AND against
    // an older user-service that hasn't been restarted yet and only knows
    // about the legacy field names.
    const payload = {
      ...data,
      locality: data.area || data.locality || '',
      city: data.district || data.city || '',
      // Preserve the default flag on edit. A full-replace PUT that omits it would
      // reset the currently-default address back to non-default.
      ...(existing?.id ? { isDefault: existing.isDefault ?? existing.default ?? false } : {}),
    };
    try {
      if (existing?.id) await updateAddress(existing.id, payload);
      else await createAddress(payload);
      navigation.goBack();
    } catch (e) {
      const msg = e?.message || 'Could not save the address.';
      notify('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  // Autofill State/District/Taluk/Area/Door-no./Pincode from a (lat, lng).
  // All fields remain manually editable at all times — this only PRE-FILLS
  // empty fields. If the user has already typed something (e.g. corrected a
  // wrong area), we preserve their entry: `d.field || autofillValue`.
  //
  // Uses expo-location's native reverse geocoder first (works offline, no
  // rate limits), then falls back to Nominatim if the native one can't
  // resolve a pincode. Indian-address mapping:
  //   pincode  ← postalCode / postcode
  //   area     ← suburb / neighbourhood / village (Nominatim) | name (native)
  //   taluk    ← subregion / municipality / town  (Nominatim) | subregion (native)
  //   district ← city / county / district          (Nominatim) | city / subregion (native)
  //   state    ← region (native) | state (Nominatim)
  const keepOrFill = (current, ...candidates) => {
    if (current && String(current).trim()) return current;
    for (const c of candidates) if (c && String(c).trim()) return c;
    return current || '';
  };
  const fillFromCoords = async (latitude, longitude) => {
    // Always persist the raw GPS coords (hidden form fields). Even if reverse
    // geocoding fails, the backend still gets lat/lng for distance calculations.
    setData((d) => ({ ...d, latitude, longitude }));

    let filled = false;
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const a = (places && places[0]) || null;
      if (a) {
        setData((d) => ({
          ...d,
          pincode:     keepOrFill(d.pincode,     a.postalCode),
          area:        keepOrFill(d.area,        a.name, a.district),
          addressLine: keepOrFill(d.addressLine, [a.streetNumber, a.street].filter(Boolean).join(', ')),
          taluk:       keepOrFill(d.taluk,       a.subregion),
          district:    keepOrFill(d.district,    a.city, a.subregion),
          state:       keepOrFill(d.state,       a.region),
        }));
        filled = !!(a.postalCode || a.city || a.region);
      }
    } catch (_) { /* fall through to Nominatim */ }
    if (!filled) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          { headers: { 'Accept': 'application/json' } },
        );
        if (res.ok) {
          const j = await res.json();
          const a = j.address || {};
          const fallbackLine = [a.house_number, a.road].filter(Boolean).join(', ')
            || j.display_name?.split(',').slice(0, 2).join(', ');
          setData((d) => ({
            ...d,
            pincode:     keepOrFill(d.pincode,     a.postcode),
            area:        keepOrFill(d.area,        a.suburb, a.neighbourhood, a.village),
            addressLine: keepOrFill(d.addressLine, fallbackLine),
            taluk:       keepOrFill(d.taluk,       a.municipality, a.town, a.taluk),
            district:    keepOrFill(d.district,    a.county, a.state_district, a.city),
            state:       keepOrFill(d.state,       a.state),
          }));
          filled = true;
        }
      } catch (_) { /* swallow */ }
    }
    if (!filled) {
      notify('Location captured', `Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)} saved. Couldn't look up the address — fill the rest manually.`);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.status !== 'granted') {
        notify('Location blocked', 'Please allow location access from your device settings to autofill your address.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude, accuracy } = pos.coords;

      const ACCURACY_MAX_METERS = 5000;
      if (accuracy && accuracy > ACCURACY_MAX_METERS) {
        notify(
          'Location too imprecise',
          `Got a fix accurate only to ~${Math.round(accuracy / 1000)} km. Fill the address manually so shop distances stay accurate.`,
        );
        return;
      }

      await fillFromCoords(latitude, longitude);
    } catch (e) {
      notify('Could not get your location', e?.message || 'Please fill the address manually.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <FormHeader navigation={navigation} isEdit={!!existing} />
      <ScrollView
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: bottomSpace }}
      >
        <SectionCard
          icon={User}
          iconColor={GREEN_DARK}
          iconBg="#DCFCE7"
          title="Contact"
          subtitle="Who should the delivery agent call?"
        >
          <Field label="Full Name" required>
            <PlainInput
              placeholder="Recipient full name"
              value={data.fullName}
              onChangeText={(v) => setField('fullName', v)}
              error={errors.fullName}
            />
            {errors.fullName ? <Text className="text-danger mt-1" style={{ fontSize: rf(10) }}>{errors.fullName}</Text> : null}
          </Field>
          <Field label="Mobile Number" required>
            <PlainInput
              placeholder="10-digit mobile"
              keyboardType="phone-pad"
              maxLength={10}
              value={data.mobile}
              onChangeText={(v) => setField('mobile', v.replace(/\D/g, ''))}
              error={errors.mobile}
            />
            {errors.mobile ? <Text className="text-danger mt-1" style={{ fontSize: rf(10) }}>{errors.mobile}</Text> : null}
          </Field>
        </SectionCard>

        <SectionCard
          icon={MapPin}
          iconColor={GREEN_DARK}
          iconBg="#DCFCE7"
          title="Address"
          subtitle="House, street, area & PIN code"
        >
          <Pressable
            onPress={useMyLocation}
            disabled={locating}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              borderRadius: 12, paddingVertical: 12, marginBottom: 12,
              backgroundColor: locating ? '#F6F7F9' : '#DCFCE7',
              borderWidth: 1, borderColor: locating ? '#E5E7EB' : '#BBF7D0',
            }}
          >
            {locating ? (
              <ActivityIndicator size="small" color={GREEN_DARK} />
            ) : (
              <Navigation size={15} color={GREEN_DARK} />
            )}
            <Text style={{ marginLeft: 8, fontSize: rf(13), fontWeight: '800', color: locating ? '#64748B' : GREEN_DARK }}>
              {locating ? 'Detecting your location…' : 'Use my current location'}
            </Text>
            {!locating ? <Crosshair size={13} color={GREEN_DARK} style={{ marginLeft: 6 }} /> : null}
          </Pressable>
          <Text style={{ fontSize: rf(10.5), color: '#64748B', marginTop: -4, marginBottom: 10, textAlign: 'center' }}>
            Autofills empty fields only — you can edit any field by typing.
          </Text>

          <Field label="Door no. / Street" required>
            <PlainInput
              placeholder="Door no, building, street, landmark"
              value={data.addressLine}
              onChangeText={(v) => setField('addressLine', v)}
              multiline
              error={errors.addressLine}
            />
            {errors.addressLine ? <Text className="text-danger mt-1" style={{ fontSize: rf(10) }}>{errors.addressLine}</Text> : null}
          </Field>

          <Field label="Area">
            <PlainInput
              placeholder="e.g. Anna Nagar"
              value={data.area}
              onChangeText={(v) => setField('area', v)}
            />
          </Field>

          <Field label="Taluk">
            <PlainInput
              placeholder="Taluk"
              value={data.taluk}
              onChangeText={(v) => setField('taluk', v)}
            />
          </Field>

          <Field label="District" required>
            <PlainInput
              placeholder="District"
              value={data.district}
              onChangeText={(v) => setField('district', v)}
              error={errors.district}
            />
            {errors.district ? <Text className="text-danger mt-1" style={{ fontSize: rf(10) }}>{errors.district}</Text> : null}
          </Field>

          <Field label="State" required>
            <PlainInput
              placeholder="State"
              value={data.state}
              onChangeText={(v) => setField('state', v)}
              error={errors.state}
            />
            {errors.state ? <Text className="text-danger mt-1" style={{ fontSize: rf(10) }}>{errors.state}</Text> : null}
          </Field>

          <Field label="Pincode" required>
            <PlainInput
              placeholder="6-digit PIN"
              keyboardType="number-pad"
              maxLength={6}
              value={data.pincode}
              onChangeText={(v) => setField('pincode', v.replace(/\D/g, ''))}
              error={errors.pincode}
            />
            {errors.pincode ? <Text className="text-danger mt-1" style={{ fontSize: rf(10) }}>{errors.pincode}</Text> : null}
          </Field>
        </SectionCard>

        {/* Save as */}
        <SectionCard
          icon={Tag}
          iconColor="#F59E0B"
          iconBg="#FEF3C7"
          title="Save as"
          subtitle="Pick a label so you can find it later"
        >
          <View className="flex-row -mx-1">
            {LABEL_OPTIONS.map((l) => {
              const Icon = l.icon;
              const active = data.label === l.value;
              return (
                <View key={l.value} className="px-1 flex-1">
                  <Pressable
                    onPress={() => setField('label', l.value)}
                    className={`rounded-xl border py-3 px-2 items-center flex-row justify-center ${active ? '' : 'bg-card border-border'}`}
                    style={active ? { backgroundColor: l.tint, borderColor: l.color } : null}
                  >
                    <Icon size={15} color={active ? l.color : '#64748B'} />
                    <Text
                      className={` font-extrabold ml-1.5 ${active ? '' : 'text-text'}`}
                      style={[active ? { color: l.color } : null, { fontSize: rf(13) }]}
                    >
                      {l.value}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </SectionCard>
      </ScrollView>

      <BottomActionBar
        title={existing ? 'Update Address' : 'Save Address'}
        onPress={save}
        loading={saving}
      />
    </KeyboardAvoidingView>
  );
}
