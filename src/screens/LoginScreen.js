import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { ArrowRight, CalendarClock, Phone, ShieldCheck, ShoppingCart } from 'lucide-react-native';
import { customerLogin, requestOtp } from '../api/auth';
import { showToast } from '../components/AppToast';
import { AUTH_BASE } from '../api/config';
import LegalAgreement from '../legal/LegalAgreement';
import { hasDeviceAgreed, setLegalAgreed } from '../legal/legalConsent';

/**
 * Customer sign-in: mobile number → OTP. Both steps live in this one screen
 * (rather than two navigator routes) because the customer auth stack mounts a
 * single "Login" screen — keeping the step in local state avoids touching the
 * navigator and keeps the entered number in scope for the resend.
 *
 * Wire-level flow, both endpoints already exist in auth-service:
 *   1. POST /auth/customer/otp/send { mobile }  — customer_users. 400s with
 *      "No account found…" when the mobile isn't registered, so it doubles as
 *      the existence check before we show the code step.
 *   2. POST /auth/customer-login    { mobile, otp }
 *
 * NOTE this is the CUSTOMER issuer, not the shop/employee one. `/auth/otp/send`
 * reads the `users` table and would 400 for every customer; customers live in
 * `customer_users` and have their own OTP column. Two issuers, two audiences.
 *
 * OTP is SIX digits. There is no SMS gateway yet, so a mobile identifier always
 * resolves to the account's static customer_users.otp_code (123456 by default).
 *
 * Layout follows the approved login mock (941×1672 → 390 dp wide): every size
 * below is the mock's dp value times `k` (screen width / 390, clamped), so the
 * page keeps the same proportions on every phone. The device illustration is
 * the mock's own artwork (assets/login-hero.png, edges feathered so it melts
 * into the page); the background shapes are drawn as vectors.
 */

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const MOBILE_DIGITS = 10;

const PAGE_BG = '#F3F4F6';
const INK = '#111111';
const GREEN_TEXT = '#035C6C';
const MUTED = '#606E87';
const SOFT = '#606E87';
const LINE = '#E8EAEE';
const DANGER = '#F32C26';
const HERO = require('../../assets/login-hero.png');
const HERO_RATIO = 700 / 546; // height / width of login-hero.png

export default function LoginScreen({ onLogin, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState('MOBILE'); // MOBILE | OTP
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Terms/Privacy checkbox: asked unticked the first time; once this device
  // has agreed to the current versions it shows as a notice instead.
  const [agreed, setAgreed] = useState(false);
  const [deviceAgreed, setDeviceAgreed] = useState(false);
  const otpRef = useRef(null);

  useEffect(() => {
    hasDeviceAgreed().then(setDeviceAgreed);
  }, []);
  // Guards the auto-submit that fires when the 6th digit lands, so a slow
  // request can't be double-sent by another keystroke (or by paste + tap).
  const verifyingRef = useRef(false);

  // Resend countdown.
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  /**
   * Only surface internal host/URL topology (AUTH_BASE, tried URL) in dev
   * builds — leaking the backend IP/port map to end users aids attackers and
   * adds nothing for them. Production shows a generic, non-revealing message.
   */
  const describeError = (e, fallback) => {
    const msg = e?.message || fallback;
    if (__DEV__) {
      const isLocalhost = /localhost|127\.0\.0\.1/.test(String(msg));
      if (!isLocalhost) return msg;
      const urlMatch = String(msg).match(/URL:\s*(\S+)/i);
      const triedUrl = urlMatch ? urlMatch[1] : '(unknown)';
      return (
        `Can't reach server (trying localhost). Tried: ${triedUrl}. ` +
        `Current AUTH_BASE: ${AUTH_BASE}. Restart Expo with EXPO_PUBLIC_API_HOST=YOUR_PC_IP.`
      );
    }
    const status = e?.status;
    if (!status || status === 0) return "Can't reach the server. Check your connection and try again.";
    return msg;
  };

  const otpFailToast = (e, fallback) => (/expired/i.test(String(e?.message || ''))
    ? { type: 'warning', title: 'OTP expired', message: 'Request a new code and try again.' }
    : e?.status === 401 || /invalid (otp|code)/i.test(String(e?.message || ''))
      ? { type: 'error', title: 'Invalid OTP', message: 'The code you entered is incorrect.' }
      : { type: 'error', title: 'Verification failed', message: describeError(e, fallback) });

  const sendOtp = async ({ resend = false } = {}) => {
    setError(null);
    setNote(null);
    if (mobile.length !== MOBILE_DIGITS) {
      setError(`Enter your ${MOBILE_DIGITS}-digit mobile number`);
      return;
    }
    if (!deviceAgreed && !agreed) {
      setError('Please agree to the Terms & Conditions and Privacy Policy to continue.');
      return;
    }
    setLegalAgreed(agreed);
    try {
      setLoading(true);
      try {
        await requestOtp(mobile);
      } catch (e) {
        // A 400 is the issuer saying the number isn't a customer. Reword it:
        // the server's copy talks about "email or mobile", but this form only
        // takes a mobile, and the useful next step is signing up.
        if (e?.status !== 400) throw e;
        const notFound = new Error(
          'No customer account for that mobile number. Tap "Create account" to sign up.',
        );
        notFound.status = 400;
        throw notFound;
      }
      setSeconds(RESEND_SECONDS);
      if (resend) setNote('A new code has been sent.');
      else setStep('OTP');
      showToast(resend
        ? { type: 'info', title: 'OTP resent', message: `New code sent to +91 ${mobile}` }
        : { type: 'success', title: 'OTP sent', message: `Code sent to +91 ${mobile}` });
    } catch (e) {
      setError(describeError(e, 'Could not send the code.'));
      showToast(e?.status === 400
        ? { type: 'warning', title: 'Account not found', message: 'Tap "Create account" to sign up.' }
        : { type: 'error', title: 'Could not send OTP', message: describeError(e, 'Could not send the code.') });
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code) => {
    const entered = (code ?? otp).trim();
    setError(null);
    setNote(null);
    if (entered.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    try {
      setLoading(true);
      const data = await customerLogin({ mobile, otp: entered });
      showToast({ type: 'success', title: 'Login successful', message: 'OTP verified. Welcome back!' });
      onLogin(data);
    } catch (e) {
      setError(describeError(e, 'Authentication failed'));
      showToast(otpFailToast(e, 'Authentication failed'));
      // Wrong code → wipe the boxes and re-focus so the retry is one action.
      // A network/server failure keeps the digits: they were probably right and
      // re-typing six of them to retry a dropped request is pure friction.
      if (e?.status === 401) {
        setOtp('');
        otpRef.current?.focus();
      }
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  };

  const onOtpChange = (v) => {
    const digits = v.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    if (digits.length === OTP_LENGTH) verify(digits);
  };

  const backToMobile = () => {
    setStep('MOBILE');
    setOtp('');
    setError(null);
    setNote(null);
  };

  // Mock dp → this screen: k scales every size by width (clamped for tablets).
  const k = Math.min(Math.max(width / 390, 0.82), 1.25);
  const s = makeStyles(k);
  const heroW = 226 * k;

  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Backdrop k={k} />
      {/* Device illustration, top-right — aligned to the logo like the mock. */}
      <Image
        source={HERO}
        style={{ position: 'absolute', right: 0, top: insets.top - 47 * k, width: heroW, height: heroW * HERO_RATIO }}
        resizeMode="contain"
        accessible={false}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 34 * k, paddingBottom: insets.bottom + 18 * k }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 40 * k }}>
          <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" accessibilityLabel="NearGFix" />
          {step === 'MOBILE' ? (
            <>
              <Text style={s.h1}>Login with{'\n'}<Text style={{ color: GREEN_TEXT }}>mobile number</Text></Text>
              <Text style={s.sub}>Welcome to NearGFix Customer App</Text>
            </>
          ) : (
            <>
              <Text style={s.h1}>Verify with{'\n'}<Text style={{ color: GREEN_TEXT }}>OTP code</Text></Text>
              <Text style={s.sub}>Code sent to <Text style={{ color: INK, fontWeight: '700' }}>+91 {mobile}</Text></Text>
            </>
          )}
        </View>

        <View style={s.card}>
          {step === 'MOBILE' ? (
            <MobileStep
              s={s}
              k={k}
              mobile={mobile}
              setMobile={setMobile}
              loading={loading}
              error={error}
              onSubmit={sendOtp}
              onCreateAccount={() => navigation?.navigate('CreateAccount')}
              agreed={agreed}
              deviceAgreed={deviceAgreed}
              onAgreedChange={(v) => { setAgreed(v); setError(null); }}
              onOpenLegal={(type) => navigation?.navigate(type === 'PRIVACY' ? 'PrivacyPolicy' : 'Terms')}
            />
          ) : (
            <OtpStep
              s={s}
              k={k}
              otp={otp}
              otpRef={otpRef}
              onOtpChange={onOtpChange}
              onSubmit={() => verify()}
              onBack={backToMobile}
              onResend={() => sendOtp({ resend: true })}
              seconds={seconds}
              loading={loading}
              error={error}
              note={note}
            />
          )}
        </View>

        <Features s={s} k={k} />
        <View style={{ flex: 1 }} />
        <Text style={s.footnote}>GGFix — book repairs, buy and sell your devices.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ step 1 */

function MobileStep({ s, k, mobile, setMobile, loading, error, onSubmit, onCreateAccount, agreed, deviceAgreed, onAgreedChange, onOpenLegal }) {
  return (
    <View>
      <Text style={s.label}>Mobile number</Text>
      <View style={s.inputBox}>
        <Phone size={19 * k} color="#606E87" strokeWidth={2} />
        <View style={s.inputDivider} />
        <TextInput
          value={mobile}
          onChangeText={(v) => setMobile(v.replace(/[^0-9]/g, '').slice(0, MOBILE_DIGITS))}
          placeholder="9876543210"
          placeholderTextColor="#8E97A9"
          keyboardType="number-pad"
          maxLength={MOBILE_DIGITS}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          accessibilityLabel="Mobile number"
          style={[s.input, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
        />
      </View>

      <ErrorBox s={s} msg={error} />

      <LegalAgreement
        checked={agreed}
        accepted={deviceAgreed}
        onChange={onAgreedChange}
        onOpen={onOpenLegal}
        color={GREEN_TEXT}
        style={{ marginTop: 14 * k }}
      />

      <PillButton s={s} k={k} label="LOGIN" loading={loading} onPress={onSubmit} />

      <View style={s.orRow}>
        <View style={s.orLine} />
        <Text style={s.orText}>OR</Text>
        <View style={s.orLine} />
      </View>

      <Pressable onPress={onCreateAccount} hitSlop={8} accessibilityRole="button" accessibilityLabel="Create Your account" style={s.signupRow}>
        <Text style={s.signupMuted}>New customer? </Text>
        <Text style={s.signupLink}>Create Your account</Text>
        <ArrowRight size={16 * k} color={GREEN_TEXT} strokeWidth={2.5} style={{ marginLeft: 8 * k }} />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ step 2 */

function OtpStep({ s, k, otp, otpRef, onOtpChange, onSubmit, onBack, onResend, seconds, loading, error, note }) {
  const boxes = Array.from({ length: OTP_LENGTH });
  const canResend = seconds <= 0 && !loading;

  return (
    <View>
      <View style={s.labelRow}>
        <Text style={[s.label, { marginBottom: 0 }]}>Enter {OTP_LENGTH}-digit OTP</Text>
        <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change number">
          <Text style={s.changeLink}>Change number</Text>
        </Pressable>
      </View>

      {/* The visible boxes are display-only; one transparent input sits on top
          of the whole row so backspace, paste and SMS autofill all behave like
          a normal single field instead of six that fight over focus. */}
      <Pressable onPress={() => otpRef.current?.focus()} style={s.otpWrap}>
        {/* Boxes live in their own fixed row so typing never re-spaces them. */}
        <View style={s.otpRow} pointerEvents="none">
        {boxes.map((_, i) => {
          const char = otp[i] || '';
          const active = otp.length === i;
          return (
            <View key={i} style={[s.otpBox, active && s.otpBoxActive, char ? s.otpBoxFilled : null]}>
              <Text style={char ? s.otpChar : s.otpCharEmpty}>{char || '•'}</Text>
            </View>
          );
        })}
        </View>
        <TextInput
          ref={otpRef}
          value={otp}
          onChangeText={onOtpChange}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoFocus
          caretHidden
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          contextMenuHidden
          underlineColorAndroid="transparent"
          accessibilityLabel="OTP code"
          style={s.otpHiddenInput}
        />
      </Pressable>

      {note ? <Text style={s.note}>{note}</Text> : null}
      <ErrorBox s={s} msg={error} />

      <PillButton s={s} k={k} label="VERIFY" loading={loading} onPress={onSubmit} />

      <View style={s.resendRow}>
        <Text style={s.signupMuted}>Didn't get the code? </Text>
        <Pressable onPress={onResend} disabled={!canResend} hitSlop={8} accessibilityRole="button">
          <Text style={[s.signupLink, !canResend && { color: SOFT, fontWeight: '600' }]}>
            {seconds > 0 ? `Resend in ${seconds}s` : 'Resend Now'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- parts */

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function PillButton({ s, k, label, loading, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-90"
      style={s.ctaShadow}
    >
      <LinearGradient colors={['#035C6C', '#035C6C']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.cta}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={s.ctaText}>{label}</Text>
            <ArrowRight size={18 * k} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 12 * k }} />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function ErrorBox({ s, msg }) {
  if (!msg) return null;
  return (
    <View style={s.errorBox}>
      <Text style={s.errorText}>{msg}</Text>
    </View>
  );
}

function Features({ s, k }) {
  const items = [
    { Icon: CalendarClock, label: 'Book\nrepairs', color: '#035C6C', bg: '#E5F3F5' },
    { Icon: ShoppingCart, label: 'Buy and sell\nyour devices', color: '#FAA700', bg: '#FFF4D6' },
    { Icon: ShieldCheck, label: 'Trusted\n& secure', color: '#F32C26', bg: '#FEEBEA' },
  ];
  return (
    <View style={s.features}>
      {items.map(({ Icon, label, color, bg }, i) => (
        <React.Fragment key={label}>
          {i > 0 ? <View style={s.featureDivider} /> : null}
          <View style={s.feature}>
            <View style={[s.featureIcon, { backgroundColor: bg }]}>
              <Icon size={18 * k} color={color} strokeWidth={2} />
            </View>
            <Text style={s.featureText}>{label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// Soft brand shapes behind the page (mock: mint washes, a green wedge on the
// right edge and layered green waves in both bottom corners).
function Backdrop({ k }) {
  const { width: W, height: H } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={W} height={H}>
        <Defs>
          <SvgGradient id="wedge" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#C7E6EA" />
            <Stop offset="1" stopColor="#609138" />
          </SvgGradient>
          <SvgGradient id="deep" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#609138" />
            <Stop offset="1" stopColor="#609138" />
          </SvgGradient>
        </Defs>
        {/* faint washes, top-left and mid-left */}
        <Circle cx={30 * k} cy={70 * k} r={210 * k} fill="#F3F4F6" fillOpacity={0.7} />
        <Circle cx={-30 * k} cy={330 * k} r={150 * k} fill="#E5F3F5" fillOpacity={0.8} />
        {/* green wedge on the right edge, behind the card's top corner */}
        <Path d={`M${W} ${245 * k} L${W} ${345 * k} L${W - 66 * k} ${310 * k} Z`} fill="url(#wedge)" />
        {/* bottom-left waves */}
        <Ellipse cx={-6 * k} cy={H + 22 * k} rx={128 * k} ry={140 * k} fill="#C7E6EA" />
        <Ellipse cx={-16 * k} cy={H + 26 * k} rx={104 * k} ry={116 * k} fill="#9ABEC4" />
        <Ellipse cx={-28 * k} cy={H + 18 * k} rx={78 * k} ry={86 * k} fill="url(#deep)" />
        {/* bottom-right waves */}
        <Ellipse cx={W + 8 * k} cy={H + 30 * k} rx={124 * k} ry={128 * k} fill="#C7E6EA" />
        <Ellipse cx={W + 16 * k} cy={H + 34 * k} rx={100 * k} ry={104 * k} fill="#9ABEC4" />
        <Ellipse cx={W + 26 * k} cy={H + 28 * k} rx={80 * k} ry={82 * k} fill="url(#deep)" />
      </Svg>
    </View>
  );
}

const makeStyles = (k) => StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE_BG },
  logo: { width: 90 * k, height: 90 * k, borderRadius: 45 * k },
  h1: { marginTop: 26 * k, fontFamily: 'Inter_800ExtraBold', fontWeight: Platform.OS === 'web' ? '800' : undefined, fontSize: 22.5 * k, lineHeight: 28 * k, color: INK },
  sub: { marginTop: 6 * k, fontSize: 13 * k, color: MUTED },

  card: {
    marginTop: 30 * k, marginHorizontal: 16 * k, paddingTop: 22 * k, paddingHorizontal: 21 * k, paddingBottom: 20 * k,
    backgroundColor: '#FFFFFF', borderRadius: 20 * k,
    shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  label: { fontSize: 12.5 * k, color: MUTED, marginLeft: 4 * k, marginBottom: 7 * k },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 * k },
  changeLink: { fontSize: 12.5 * k, fontWeight: '700', color: GREEN_TEXT },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', height: 46 * k, paddingLeft: 17 * k, borderRadius: 13 * k,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EAEE',
    shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  inputDivider: { width: 1, height: 22 * k, backgroundColor: '#E8EAEE', marginHorizontal: 14 * k },
  input: { flex: 1, height: '100%', fontSize: 14.5 * k, color: INK, letterSpacing: 0.3 },

  ctaShadow: {
    marginTop: 18 * k, borderRadius: 24 * k,
    shadowColor: '#035C6C', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  cta: { height: 48 * k, borderRadius: 24 * k, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 13.5 * k, fontWeight: '800', letterSpacing: 2.2 * k },

  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 * k, paddingHorizontal: 6 * k },
  orLine: { flex: 1, height: 1, backgroundColor: LINE },
  orText: { marginHorizontal: 22 * k, fontSize: 12 * k, color: SOFT },
  signupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 * k },
  signupMuted: { fontSize: 13 * k, color: INK },
  signupLink: { fontSize: 13 * k, fontWeight: '800', color: GREEN_TEXT },

  otpWrap: { position: 'relative', height: 50 * k },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', height: 50 * k },
  otpBox: {
    width: 42 * k, height: 50 * k, borderRadius: 12 * k, borderWidth: 1, borderColor: '#E8EAEE', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: { borderColor: '#035C6C', borderWidth: 1.5 },
  otpBoxFilled: { borderColor: '#C7E6EA', backgroundColor: '#F0F8F9' },
  otpChar: { fontSize: 20 * k, fontWeight: '800', color: INK },
  otpCharEmpty: { fontSize: 16 * k, color: '#8E97A9' },
  // Fixed-size overlay (never part of the row's layout) — invisible, catches typing / paste / SMS autofill.
  otpHiddenInput: { position: 'absolute', left: 0, top: 0, width: '100%', height: 50 * k, padding: 0, margin: 0, opacity: 0, color: 'transparent', backgroundColor: 'transparent' },
  note: { fontSize: 12.5 * k, color: GREEN_TEXT, marginTop: 10 * k, textAlign: 'center' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22 * k },

  errorBox: { marginTop: 12 * k, borderRadius: 12 * k, paddingHorizontal: 12 * k, paddingVertical: 9 * k, backgroundColor: '#FEEBEA', borderWidth: 1, borderColor: 'rgba(243,44,38,0.3)' },
  errorText: { fontSize: 12.5 * k, lineHeight: 17 * k, color: DANGER },

  features: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 18 * k, paddingHorizontal: 16 * k },
  feature: { flex: 1, alignItems: 'center' },
  featureIcon: { width: 35 * k, height: 35 * k, borderRadius: 17.5 * k, alignItems: 'center', justifyContent: 'center' },
  featureText: { marginTop: 8 * k, fontSize: 12 * k, lineHeight: 15 * k, color: '#111111', textAlign: 'center' },
  featureDivider: { width: 1, height: 30 * k, marginTop: 18 * k, backgroundColor: '#E8EAEE' },
  footnote: { marginTop: 26 * k, fontSize: 11.5 * k, color: SOFT, textAlign: 'center' },
});
