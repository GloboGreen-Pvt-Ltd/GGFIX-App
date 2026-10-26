import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  AlertTriangle,
  ChevronRight,
} from 'lucide-react-native';
import { BottomActionBar, useBottomBarInset } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { createAddress, updateAddress } from '../../../api/customer';
import { selectSession } from '../../../store/authSlice';
import { forceRelogin } from '../../../auth/session';
import { rf } from '../../../utils/responsive';
import PageHeader from '../../../components/PageHeader';
import { BRAND } from '../../../theme/brand';

// Palette: 09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141.
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const GREEN_LINE = 'rgba(9,173,42,0.45)';
const MUTED = '#6B6B6B';

const LABEL_OPTIONS = [
  { value: 'Home',   icon: Home },
  { value: 'Office', icon: Briefcase },
  { value: 'Other',  icon: Tag },
];

// Server field names → form fields (legacy mirrors map back to what's shown).
const FIELD_ALIASES = { locality: 'area', city: 'district' };

function SectionCard({ icon: Icon, iconColor, iconBg, title, subtitle, right, children }) {
  return (
    <View
      style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 12, marginBottom: 10, shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 9, backgroundColor: iconBg }}>
          <Icon size={15} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: rf(13.5), fontWeight: '800', color: BRAND.ink }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: rf(10.5), color: MUTED, marginTop: 1 }}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: rf(11.5), fontWeight: '700', color: MUTED, marginBottom: 5 }}>
        {label}{required ? <Text style={{ color: BRAND.red }}> *</Text> : null}
      </Text>
      {children}
      {hint ? <Text style={{ fontSize: rf(10), color: MUTED, marginTop: 3 }}>{hint}</Text> : null}
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
        borderWidth: 1, borderColor: error ? BRAND.red : LINE,
        paddingHorizontal: 12, paddingVertical: multiline ? 9 : 0,
      }}
    >
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={BRAND.muted}
        style={[{
          fontSize: rf(13.5), color: BRAND.ink,
          paddingVertical: multiline ? 0 : 10,
          minHeight: multiline ? 50 : undefined,
          textAlignVertical: multiline ? 'top' : 'auto',
        }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
      />
    </View>
  );
}

function FormHeader({ navigation, isEdit }) {
  return (
    <PageHeader
      title={isEdit ? 'Edit Address' : 'Add Address'}
      subtitle={isEdit ? 'Update your address' : 'Where should we deliver?'}
      onBack={() => navigation.goBack()}
    />
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
  const [saveError, setSaveError] = useState(null);
  const scrollRef = useRef(null);

  const setField = (k, v) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
    if (saveError) setSaveError(null);
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
    setSaveError(null);
    // Trim everything; optional fields left empty go as null ("not given")
    // rather than "" — an empty string fails server-side length/format checks
    // that a missing value passes.
    const t = (v) => String(v ?? '').trim();
    const opt = (v) => t(v) || null;
    // Send the legacy mirrors (locality, city) alongside the new canonical
    // fields (area, district). Belt-and-braces — works against the new backend
    // (dual-write logic prefers explicit locality/city when sent), AND against
    // an older user-service that hasn't been restarted yet and only knows
    // about the legacy field names.
    const payload = {
      label: data.label,
      fullName: t(data.fullName),
      mobile: t(data.mobile),
      pincode: t(data.pincode),
      addressLine: t(data.addressLine),
      area: opt(data.area),
      taluk: opt(data.taluk),
      district: t(data.district),
      state: t(data.state),
      latitude: data.latitude,
      longitude: data.longitude,
      locality: opt(data.area),
      city: t(data.district),
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
      // Field-level errors from the server (Spring style) highlight the field.
      const list = Array.isArray(e?.payload?.errors) ? e.payload.errors : [];
      const fieldErrs = {};
      list.forEach((x) => { const f = FIELD_ALIASES[x?.field] || x?.field; if (f && f in data) fieldErrs[f] = x.defaultMessage || x.message || 'Invalid'; });
      if (Object.keys(fieldErrs).length) setErrors((cur) => ({ ...cur, ...fieldErrs }));
      setSaveError(e?.authRejected
        ? { text: 'Your login has expired or is no longer accepted, so the server refused to save. Please log in again and re-add this address.', relogin: true }
        : { text: e?.status ? `${msg} (HTTP ${e.status})` : msg });
      // Bring the reason (last item in the form) into view above the Save bar.
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 120);
      notify('Save failed', e?.authRejected ? 'Please log in again.' : msg);
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
        ref={scrollRef}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: bottomSpace }}
      >
        <SectionCard
          icon={User}
          iconColor={GREEN_TEXT}
          iconBg={MINT}
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
          iconColor={BRAND.red}
          iconBg="#FEECEC"
          title="Address"
          subtitle="House, street, area & PIN code"
        >
          <Pressable
            onPress={useMyLocation}
            disabled={locating}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              borderRadius: 12, paddingVertical: 10, marginBottom: 10,
              backgroundColor: locating ? BRAND.bg : MINT,
              borderWidth: 1, borderColor: locating ? LINE : GREEN_LINE,
            }}
          >
            {locating ? (
              <ActivityIndicator size="small" color={GREEN_TEXT} />
            ) : (
              <Navigation size={15} color={GREEN_TEXT} />
            )}
            <Text style={{ marginLeft: 8, fontSize: rf(13), fontWeight: '800', color: locating ? MUTED : GREEN_TEXT }}>
              {locating ? 'Detecting your location…' : 'Use my current location'}
            </Text>
            {!locating ? <Crosshair size={13} color={GREEN_TEXT} style={{ marginLeft: 6 }} /> : null}
          </Pressable>
          <Text style={{ fontSize: rf(10.5), color: MUTED, marginTop: -4, marginBottom: 10, textAlign: 'center' }}>
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
              error={errors.area}
            />
            {errors.area ? <Text style={{ color: BRAND.red, marginTop: 3, fontSize: rf(10) }}>{errors.area}</Text> : null}
          </Field>

          <Field label="Taluk">
            <PlainInput
              placeholder="Taluk"
              value={data.taluk}
              onChangeText={(v) => setField('taluk', v)}
              error={errors.taluk}
            />
            {errors.taluk ? <Text style={{ color: BRAND.red, marginTop: 3, fontSize: rf(10) }}>{errors.taluk}</Text> : null}
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
          iconColor={BRAND.yellow}
          iconBg="#FEF6DA"
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
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    className="active:opacity-80"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 6, borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : LINE, backgroundColor: active ? MINT : '#FFFFFF' }}
                  >
                    <Icon size={15} color={active ? GREEN_TEXT : MUTED} />
                    <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: active ? GREEN_TEXT : BRAND.ink }}>
                      {l.value}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </SectionCard>

        {saveError ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, padding: 10, backgroundColor: '#FEECEC', borderWidth: 1, borderColor: 'rgba(248,65,65,0.35)' }}>
            <AlertTriangle size={16} color={BRAND.red} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>Couldn't save this address</Text>
              <Text style={{ fontSize: rf(11.5), color: BRAND.ink, marginTop: 2, lineHeight: rf(16) }} selectable>{saveError.text}</Text>
              {saveError.relogin ? (
                <Pressable
                  onPress={forceRelogin}
                  accessibilityRole="button"
                  accessibilityLabel="Log in again"
                  className="active:opacity-85"
                  style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: BRAND.green }}
                >
                  <Text style={{ fontSize: rf(12), fontWeight: '800', color: '#FFFFFF' }}>Log in again</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomActionBar>
        <Pressable
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={existing ? 'Update Address' : 'Save Address'}
          className="active:opacity-90"
          style={{ height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.green, opacity: saving ? 0.75 : 1, shadowColor: BRAND.green, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <Text style={{ fontSize: rf(15), fontWeight: '800', color: '#FFFFFF', marginRight: 4 }}>{existing ? 'Update Address' : 'Save Address'}</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </BottomActionBar>
    </KeyboardAvoidingView>
  );
}
