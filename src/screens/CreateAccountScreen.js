import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { User, Mail, Lock, ChevronRight } from 'lucide-react-native';
import { customerRegister } from '../api/auth';
import { AUTH_BASE } from '../api/config';
import { Button, Input } from '../components/rnr';
import { AuthShell, ErrorBox, authStyles as s, MUTED, INK } from './authUi';
import { rf } from '../utils/responsive';

export default function CreateAccountScreen({ navigation, onLogin }) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate('Login');
  };

  const onSubmit = async () => {
    setError(null);
    if (!fullName.trim()) { setError('Enter your name'); return; }
    if (mobile.trim().length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    if (password.trim().length < 6) { setError('Password must be at least 6 characters'); return; }
    try {
      setLoading(true);
      const data = await customerRegister({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        mobile: mobile.trim(),
        password,
      });
      onLogin?.(data);
    } catch (e) {
      const msg = e?.message || 'Could not create your account';
      const isLocalhost = /localhost|127\.0\.0\.1/.test(String(msg));
      if (isLocalhost) {
        setError(`Can't reach server. Current AUTH_BASE: ${AUTH_BASE}. Restart Expo with EXPO_PUBLIC_API_HOST=YOUR_PC_IP.`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell onBack={goBack}>
      <Text style={s.h1}>Create account</Text>
      <Text style={s.sub}>Sign up in seconds to book trusted repairs, buy and sell nearby.</Text>

      <Text style={s.fieldLabel}>Your name</Text>
      <View style={s.fieldRow}>
        <User size={18} color={MUTED} />
        <Input
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
          className="flex-1 bg-transparent border-0 ml-2"
          style={s.fieldInput}
        />
      </View>

      <Text style={s.fieldLabel}>Mobile number</Text>
      {/* No 🇮🇳 +91 chip: the backend stores and matches a bare 10-digit mobile,
          so the prefix was decoration — and the sign-in screen this links back
          to doesn't show one either. */}
      <View style={s.fieldRow}>
        <Input
          placeholder="10-digit mobile"
          value={mobile}
          onChangeText={(v) => setMobile(v.replace(/[^0-9]/g, '').slice(0, 10))}
          keyboardType="phone-pad"
          maxLength={10}
          className="flex-1 bg-transparent border-0"
          style={s.fieldInput}
        />
      </View>

      <Text style={s.fieldLabel}>Email (optional)</Text>
      <View style={s.fieldRow}>
        <Mail size={18} color={MUTED} />
        <Input
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          className="flex-1 bg-transparent border-0 ml-2"
          style={s.fieldInput}
        />
      </View>

      <Text style={s.fieldLabel}>Password</Text>
      <View style={s.fieldRow}>
        <Lock size={18} color={MUTED} />
        <Input
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          className="flex-1 bg-transparent border-0 ml-2"
          style={s.fieldInput}
        />
      </View>

      <ErrorBox msg={error} />

      <Button
        onPress={onSubmit}
        loading={loading}
        fullWidth
        size="lg"
        rightIcon={!loading ? <ChevronRight size={18} color="#fff" /> : null}
        style={{ marginTop: 18, height: 54, borderRadius: 16 }}
        textClassName="font-extrabold tracking-wide"
      >
        Create account
      </Button>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 }}>
        <Text style={{ fontSize: rf(13), color: MUTED }}>Already have an account? </Text>
        <Text onPress={goBack} style={{ fontSize: rf(13), fontWeight: '800', color: INK }}>Sign in</Text>
      </View>
    </AuthShell>
  );
}
