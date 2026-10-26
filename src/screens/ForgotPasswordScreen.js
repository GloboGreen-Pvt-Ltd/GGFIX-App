import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AtSign, ChevronRight, Smartphone, X } from 'lucide-react-native';
import { requestOtp } from '../api/auth';
import { Button, Input } from '../components/rnr';
import { AuthShell, ErrorBox, authStyles as s, MUTED } from './authUi';

export default function ForgotPasswordScreen({ navigation, route }) {
  const [identifier, setIdentifier] = useState(route?.params?.identifier || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = identifier.trim();
  const isPhone = trimmed.length > 0 && !trimmed.includes('@') && /^[0-9 +]+$/.test(trimmed);
  const phoneDigits = trimmed.replace(/\D/g, '');

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate('Login');
  };

  const onContinue = async () => {
    setError(null);
    if (!trimmed) { setError('Enter your email or mobile number'); return; }
    if (isPhone && phoneDigits.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    try {
      setLoading(true);
      const id = isPhone ? phoneDigits : trimmed;
      const res = await requestOtp(id);
      navigation.navigate('ForgotPasswordOtp', {
        identifier: id,
        channel: res?.channel || (isPhone ? 'MOBILE' : 'EMAIL'),
        target: res?.target,
        devOtp: res?.devOtp || res?.defaultOtp || null,
      });
    } catch (e) {
      setError(e?.message || 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell onBack={goBack}>
      <Text style={s.h1}>Password assistance</Text>
      <Text style={s.sub}>Enter the email or mobile number associated with your GGFIX account.</Text>

      <Text style={s.fieldLabel}>Email or mobile number</Text>
      <View style={s.fieldRow}>
        {/* A phone identifier gets a handset glyph, not a 🇮🇳 +91 chip: the
            backend matches a bare 10-digit mobile, so the prefix was decoration. */}
        {isPhone ? (
          <Smartphone size={18} color={MUTED} />
        ) : (
          <AtSign size={18} color={MUTED} />
        )}
        <Input
          placeholder="you@example.com or mobile"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="email-address"
          className="flex-1 bg-transparent border-0 ml-2"
          style={s.fieldInput}
        />
        {trimmed.length > 0 && (
          <Pressable onPress={() => setIdentifier('')} hitSlop={8}>
            <X size={18} color={MUTED} />
          </Pressable>
        )}
      </View>

      <ErrorBox msg={error} />

      <Button
        onPress={onContinue}
        loading={loading}
        fullWidth
        size="lg"
        rightIcon={!loading ? <ChevronRight size={18} color="#fff" /> : null}
        style={{ marginTop: 14, height: 54, borderRadius: 16 }}
        textClassName="font-extrabold tracking-wide"
      >
        Continue
      </Button>
    </AuthShell>
  );
}
