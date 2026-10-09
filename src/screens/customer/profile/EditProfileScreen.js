import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch } from 'react-redux';
import { Camera, Pencil, Save, User, Phone, Smartphone, Mail } from 'lucide-react-native';
import { Avatar, Input, Loader } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import { getProfile, updateProfile } from '../../../api/customer';
import { uploadMedia } from '../../../api/masterData';
import { setSession } from '../../../store/authSlice';
import { getSession, saveSession } from '../../../auth/session';
import { rf } from '../../../utils/responsive';

// Brand palette: green #09AD2A, green text #078F23, ink #1E1E1E, neutrals.
const GREEN = '#09AD2A';
const GREEN_DARK = '#078F23';
const CHIP_BG = '#EAF8EC';
const INK = '#1E1E1E';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const PAGE_BG = '#F8F8F8';

// Left-icon labelled fields, driven from a table so the row layout stays
// identical across all four inputs (icon chip · label · input).
const FIELDS = [
  { key: 'fullName',        label: 'Full Name',               icon: User,       placeholder: 'Enter your full name',          autoCapitalize: 'words' },
  { key: 'mobile',          label: 'Mobile Number',           icon: Phone,      placeholder: 'Enter your mobile number',      keyboardType: 'phone-pad' },
  { key: 'alternateMobile', label: 'Alternate Mobile Number', icon: Smartphone, placeholder: 'Enter alternate mobile number', keyboardType: 'phone-pad' },
  { key: 'email',           label: 'Email Address',           icon: Mail,       placeholder: 'Enter your email address',      keyboardType: 'email-address', autoCapitalize: 'none' },
];

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [data, setData] = useState({ fullName: '', mobile: '', alternateMobile: '', email: '', profileImageUrl: '' });

  // Load the current profile. If this fails we must NOT fall through to a blank
  // form — saving from a blank form would overwrite the real account with empty
  // strings. Show a retry state instead so the fields are never silently wiped.
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const p = await getProfile();
      setData({
        fullName: p.fullName || '',
        mobile: p.mobile || '',
        alternateMobile: p.alternateMobile || '',
        email: p.email || '',
        profileImageUrl: p.profileImageUrl || '',
      });
    } catch (_) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Pick a new profile photo, upload to media.ggfix.in (folder "profile"), then set
  // the resulting URL so the avatar previews it immediately. Saved on "Save".
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      notify('Permission needed', 'Allow photo access to change your picture.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(true);
      const url = await uploadMedia(result.assets[0], 'profile');
      if (!url) throw new Error('Upload returned no URL');
      setData((d) => ({ ...d, profileImageUrl: url }));
    } catch (e) {
      notify('Upload failed', e?.message || 'Try again');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = (await updateProfile(data)) || {};
      const cur = (await getSession()) || {};
      const newSession = {
        ...cur,
        // Fall back to the edited values when the server returns an empty/204
        // body (json → null) so a successful save never blanks the session.
        fullName: saved.fullName ?? data.fullName,
        email: saved.email ?? data.email,
        mobile: saved.mobile ?? data.mobile,
        // Keep the avatar in the session so the Profile header reflects it too.
        profileImageUrl: saved.profileImageUrl ?? data.profileImageUrl,
      };
      await saveSession(newSession);
      dispatch(setSession(newSession));
      notify('Saved', 'Your profile has been updated.', { preset: 'done' });
      navigation.goBack();
    } catch (e) {
      notify('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading profile..." />;

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: PAGE_BG, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: rf(15.5), fontWeight: '800', color: INK, textAlign: 'center' }}>
          Couldn't load your profile
        </Text>
        <Text style={{ fontSize: rf(13), color: MUTED, textAlign: 'center', marginTop: 6 }}>
          Check your connection and try again — your details are safe and unchanged.
        </Text>
        <Pressable
          onPress={loadProfile}
          style={{ marginTop: 18, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 30 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(14) }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const busy = saving || uploading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: PAGE_BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar with camera edit badge */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 12,
            backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: LINE,
            shadowColor: INK, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
          }}
        >
          <View style={{ width: 72, height: 72 }}>
            <View style={{ borderRadius: 36, overflow: 'hidden', borderWidth: 2, borderColor: CHIP_BG }}>
              {data.profileImageUrl ? (
                <Image source={{ uri: data.profileImageUrl }} style={{ width: 68, height: 68 }} resizeMode="cover" />
              ) : (
                <Avatar fallback={data.fullName || 'U'} size={68} />
              )}
            </View>

            {uploading ? (
              <View
                style={{
                  position: 'absolute', top: 2, left: 2, width: 68, height: 68,
                  borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.4)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}

            <Pressable
              onPress={pickAvatar}
              disabled={uploading}
              accessibilityLabel="Change profile photo"
              style={{
                position: 'absolute', right: -2, bottom: -2,
                height: 28, width: 28, borderRadius: 14,
                backgroundColor: GREEN, borderWidth: 2, borderColor: '#fff',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Camera size={13} color="#fff" />
            </Pressable>
          </View>

          <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <Text style={{ fontSize: rf(15.5), fontWeight: '800', color: INK }} numberOfLines={1}>
              {data.fullName || 'Your name'}
            </Text>
            {data.mobile ? (
              <Text style={{ fontSize: rf(12), color: MUTED, marginTop: 1 }}>{data.mobile}</Text>
            ) : null}
            <Pressable
              onPress={pickAvatar}
              disabled={uploading}
              hitSlop={8}
              className="active:opacity-70"
              style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 7, backgroundColor: CHIP_BG, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
            >
              <Pencil size={12} color={GREEN_DARK} />
              <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: GREEN_DARK, marginLeft: 5 }}>
                {uploading ? 'Uploading…' : 'Change photo'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Details card — each row: icon chip · label · input */}
        <View
          style={{
            backgroundColor: '#fff', borderRadius: 16,
            borderWidth: 1, borderColor: LINE, paddingHorizontal: 12, paddingVertical: 4,
            shadowColor: INK, shadowOpacity: 0.04, shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 }, elevation: 1,
          }}
        >
          {FIELDS.map((f, idx) => {
            const Icon = f.icon;
            return (
              <View
                key={f.key}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: idx ? 1 : 0, borderTopColor: '#F3F3F3' }}
              >
                <View
                  style={{
                    height: 34, width: 34, borderRadius: 11,
                    backgroundColor: CHIP_BG, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={16} color={GREEN_DARK} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: rf(11), fontWeight: '700', color: MUTED, marginBottom: 4 }}>
                    {f.label}
                  </Text>
                  <Input
                    placeholder={f.placeholder}
                    value={data[f.key]}
                    onChangeText={(v) => setData((d) => ({ ...d, [f.key]: v }))}
                    keyboardType={f.keyboardType}
                    autoCapitalize={f.autoCapitalize}
                    style={{ fontSize: rf(13.5), color: INK, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 11, backgroundColor: PAGE_BG }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 14 }} />

        {/* Save button — green pill with a save icon. */}
        <Pressable
          onPress={save}
          disabled={busy}
          android_ripple={{ color: GREEN_DARK }}
          style={{
            backgroundColor: GREEN, borderRadius: 14, paddingVertical: 13,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            opacity: busy ? 0.75 : 1,
            shadowColor: GREEN, shadowOpacity: 0.22, shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 }, elevation: 3,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(14), marginLeft: 7, letterSpacing: 0.2 }}>
                Save Changes
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
