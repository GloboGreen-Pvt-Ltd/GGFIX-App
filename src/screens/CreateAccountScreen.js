import React, { useEffect, useRef, useState } from 'react';
import {
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Mail, Smartphone, User } from 'lucide-react-native';
import { customerRegister, requestSignupOtp, verifySignupOtp } from '../api/auth';
import { AUTH_BASE } from '../api/config';
import { Button } from '../components/rnr';
import { notify } from '../components/confirm';
import { tokens } from '../theme/colors';
import { rf, rlh, rs } from '../utils/responsive';

/**
 * Customer sign-up: mobile number → OTP → name. Three steps in ONE screen (local
 * state, not three navigator routes) for the same reason LoginScreen keeps its
 * two together — the auth stack mounts a single "CreateAccount" route, and the
 * entered number has to stay in scope for the resend and the final register call.
 *
 * There is no password field anywhere in this flow. Customers sign in with an
 * OTP (see LoginScreen), so a password was a credential nobody would ever use;
 * the account is created with none, and `/auth/customer/forgot-password/reset`
 * can still set one later if that ever changes.
 *
 * Wire-level flow (auth-service, all three are pre-auth):
 *   1. POST /auth/customer/signup/otp/send   { mobile }       — 409 when the
 *      number already has an account, which is how the duplicate toast fires.
 *   2. POST /auth/customer/signup/otp/verify { mobile, otp }   — checks without
 *      consuming, so step 3 can re-verify.
 *   3. POST /auth/customer-register          { fullName, email, mobile, otp }
 *
 * NOTE the sign-up issuer is NOT `/auth/customer/otp/send`: that one requires an
 * EXISTING customer_users row and 400s for every new number. Two issuers, two
 * opposite existence checks.
 */

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const MOBILE_DIGITS = 10;

const GREEN = tokens.primary;
const TEXT = tokens.text;
const MUTED = tokens.textMuted;
const SUBTLE = tokens.textSubtle;
const BORDER = tokens.border;
const DANGER = tokens.danger;
// Dark amber: the plain #F59E0B warning token is 2.4:1 on white, too weak for a
// text link. The customer theme has no `attentionDark`, so it is literal here.
const AMBER_DARK = '#B45309';

// White, matching the sign-in screen this is reached from — the two are one
// flow, and the brand logo PNG has an opaque white background, so any tinted
// wash would draw a visible square around it.
const PAGE_BG = '#FFFFFF';
// Fixed, deliberately NOT rs(), so the logo's corner radius is identical on
// every device instead of drifting with the width scale.
const LOGO_RADIUS = 10;
// Tablets: stop the form stretching to a 10" edge-to-edge line length.
const CONTENT_MAX_WIDTH = 440;

export default function CreateAccountScreen({ navigation, onLogin }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('MOBILE'); // MOBILE | OTP | DETAILS
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const otpRef = useRef(null);
  // Guards the auto-submit that fires when the 6th digit lands, so a slow
  // request can't be double-sent by another keystroke (or by paste + tap).
  const verifyingRef = useRef(false);

  // Resend countdown.
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const goToLogin = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate('Login');
  };

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

  /**
   * 409 = the number already has an account. Surfaced as a toast (the app's
   * existing Burnt notifier) rather than only inline, because it is not a
   * correction to make in place — the useful next move is signing in instead,
   * so the inline copy below the field says exactly that.
   */
  const handleTaken = () => {
    notify('This mobile number is already registered.', 'Sign in with this number instead.', {
      preset: 'error',
      haptic: 'error',
      duration: 3,
    });
    setError('This mobile number is already registered. Sign in instead.');
  };

  const sendOtp = async ({ resend = false } = {}) => {
    setError(null);
    setNote(null);
    if (mobile.length !== MOBILE_DIGITS) {
      setError(`Enter your ${MOBILE_DIGITS}-digit mobile number`);
      return;
    }
    try {
      setLoading(true);
      await requestSignupOtp(mobile);
      setSeconds(RESEND_SECONDS);
      if (resend) setNote('A new code has been sent.');
      else setStep('OTP');
    } catch (e) {
      if (e?.status === 409) {
        handleTaken();
        setStep('MOBILE');
      } else {
        setError(describeError(e, 'Could not send the code.'));
      }
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
      await verifySignupOtp(mobile, entered);
      setStep('DETAILS');
    } catch (e) {
      if (e?.status === 409) {
        handleTaken();
        setOtp('');
        setStep('MOBILE');
      } else {
        setError(describeError(e, 'Could not verify the code.'));
        // Wrong code → wipe the boxes and re-focus so the retry is one action.
        // A network/server failure keeps the digits: they were probably right
        // and re-typing six of them to retry a dropped request is pure friction.
        if (e?.status === 401) {
          setOtp('');
          otpRef.current?.focus();
        }
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

  const createAccount = async () => {
    setError(null);
    setNote(null);
    if (!fullName.trim()) {
      setError('Enter your name');
      return;
    }
    try {
      setLoading(true);
      // Same code the verify step checked — the server re-verifies here and
      // consumes it, so the account can only be created for a number this
      // device actually proved control of.
      const data = await customerRegister({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        mobile,
        otp,
      });
      onLogin?.(data);
    } catch (e) {
      if (e?.status === 409) {
        // Either the number was claimed between steps, or the email is taken.
        // Only the mobile sends the user back to step 1.
        const isMobileClash = /mobile/i.test(String(e?.message || ''));
        if (isMobileClash) {
          handleTaken();
          setOtp('');
          setStep('MOBILE');
        } else {
          setError(e?.message || 'That email is already registered.');
        }
      } else {
        setError(describeError(e, 'Could not create your account.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const backFromOtp = () => {
    setStep('MOBILE');
    setOtp('');
    setError(null);
    setNote(null);
  };

  const backFromDetails = () => {
    setStep('OTP');
    setError(null);
    setNote(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={PAGE_BG} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + rs(24), paddingBottom: insets.bottom + rs(28) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {step === 'MOBILE' ? (
            <MobileStep
              mobile={mobile}
              setMobile={setMobile}
              loading={loading}
              error={error}
              onBack={goToLogin}
              onSubmit={sendOtp}
              onSignIn={goToLogin}
            />
          ) : null}

          {step === 'OTP' ? (
            <OtpStep
              mobile={mobile}
              otp={otp}
              otpRef={otpRef}
              onOtpChange={onOtpChange}
              onSubmit={() => verify()}
              onBack={backFromOtp}
              onResend={() => sendOtp({ resend: true })}
              seconds={seconds}
              loading={loading}
              error={error}
              note={note}
            />
          ) : null}

          {step === 'DETAILS' ? (
            <DetailsStep
              fullName={fullName}
              setFullName={setFullName}
              email={email}
              setEmail={setEmail}
              mobile={mobile}
              loading={loading}
              error={error}
              onBack={backFromDetails}
              onSubmit={createAccount}
            />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ step 1 */

function MobileStep({ mobile, setMobile, loading, error, onBack, onSubmit, onSignIn }) {
  return (
    <View>
      <BackButton onPress={onBack} />

      <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="cover" />

      <Text style={styles.h1}>Create your{'\n'}account</Text>
      <Text style={styles.sub}>We'll send a verification code to this number.</Text>

      <View style={styles.fieldCard}>
        <Smartphone size={rs(18)} color={MUTED} />
        <TextInput
          value={mobile}
          onChangeText={(v) => setMobile(v.replace(/[^0-9]/g, '').slice(0, MOBILE_DIGITS))}
          placeholder="9876543210"
          placeholderTextColor={SUBTLE}
          keyboardType="number-pad"
          maxLength={MOBILE_DIGITS}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={styles.fieldInput}
        />
      </View>

      <ErrorBox msg={error} />

      <PrimaryButton label="CONTINUE" loading={loading} onPress={onSubmit} />

      <View style={styles.signupRow}>
        <Text style={styles.signupMuted}>Already have an account? </Text>
        <Pressable onPress={onSignIn} hitSlop={8}>
          <Text style={styles.signupLink}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ step 2 */

function OtpStep({
  mobile, otp, otpRef, onOtpChange, onSubmit, onBack, onResend, seconds, loading, error, note,
}) {
  const boxes = Array.from({ length: OTP_LENGTH });
  const canResend = seconds <= 0 && !loading;

  return (
    <View>
      <BackButton onPress={onBack} />

      <Text style={styles.h1Center}>Verify Phone</Text>
      <Text style={styles.subCenter}>Code is sent to {mobile}</Text>

      {/* The visible boxes are display-only; one transparent input sits on top
          of the whole row so backspace, paste and SMS autofill all behave like
          a normal single field instead of six that fight over focus. */}
      <Pressable onPress={() => otpRef.current?.focus()} style={styles.otpRow}>
        {boxes.map((_, i) => {
          const char = otp[i] || '';
          const active = otp.length === i;
          return (
            <View key={i} style={[styles.otpBox, active && styles.otpBoxActive]}>
              <Text style={char ? styles.otpChar : styles.otpCharEmpty}>{char || '0'}</Text>
            </View>
          );
        })}
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
          style={styles.otpHiddenInput}
        />
      </Pressable>

      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ErrorBox msg={error} />

      <PrimaryButton label="VERIFY" loading={loading} onPress={onSubmit} />

      <View style={styles.resendRow}>
        <Text style={styles.resendMuted}>Not yet code? </Text>
        <Pressable onPress={onResend} disabled={!canResend} hitSlop={8}>
          <Text style={[styles.resendLink, !canResend && styles.resendLinkOff]}>
            {seconds > 0 ? `Resend in ${seconds}s` : 'Resend Now'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ step 3 */

function DetailsStep({ fullName, setFullName, email, setEmail, mobile, loading, error, onBack, onSubmit }) {
  return (
    <View>
      <BackButton onPress={onBack} />

      <Text style={styles.h1}>Almost there</Text>
      <Text style={styles.sub}>{mobile} verified. Tell us what to call you.</Text>

      <Text style={styles.fieldLabel}>Your name</Text>
      <View style={styles.fieldCard}>
        <User size={rs(18)} color={MUTED} />
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={SUBTLE}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
          style={styles.fieldInput}
        />
      </View>

      <Text style={styles.fieldLabel}>Email (optional)</Text>
      <View style={styles.fieldCard}>
        <Mail size={rs(18)} color={MUTED} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={SUBTLE}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={styles.fieldInput}
        />
      </View>

      <ErrorBox msg={error} />

      <PrimaryButton label="CREATE ACCOUNT" loading={loading} onPress={onSubmit} />
    </View>
  );
}

/* ------------------------------------------------------------------- parts */

function BackButton({ onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.backBtn}>
      <ArrowLeft size={rs(20)} color={TEXT} />
    </Pressable>
  );
}

function PrimaryButton({ label, loading, onPress }) {
  return (
    <Button
      onPress={onPress}
      loading={loading}
      fullWidth
      elevated={false}
      // twMerge drops Button's own `rounded-2xl`/`py-3.5`/`bg-primary` in favour
      // of these, so the CTA keeps the design's squarer 10px corners at a fixed
      // 56px height. The hex must stay literal here — Tailwind's JIT only
      // compiles arbitrary values it can see as source text, so a constant
      // would emit no class.
      className="rounded-[10px] py-0 bg-[#004C40]"
      style={styles.cta}
    >
      <View style={styles.ctaInner}>
        <Text style={styles.ctaText}>{label}</Text>
        <ArrowRight size={rs(18)} color="#FFFFFF" strokeWidth={2.5} />
      </View>
    </Button>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{msg}</Text>
    </View>
  );
}

const cardSurface = {
  borderRadius: rs(12),
  borderWidth: 1,
  borderColor: BORDER,
  backgroundColor: tokens.card,
  shadowColor: '#0B1F14',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: rs(24) },
  content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },

  logo: {
    height: rs(100),
    width: rs(100),
    borderRadius: LOGO_RADIUS,
    marginBottom: rs(22),
    alignSelf: 'center',
  },

  h1: { fontSize: rf(28), lineHeight: rlh(36), fontWeight: '800', color: TEXT, letterSpacing: -0.4 },
  h1Center: { fontSize: rf(26), lineHeight: rlh(32), fontWeight: '800', color: TEXT, textAlign: 'center' },
  sub: { fontSize: rf(13.5), lineHeight: rlh(20), color: MUTED, marginTop: rs(8) },
  subCenter: { fontSize: rf(13.5), lineHeight: rlh(20), color: MUTED, textAlign: 'center', marginTop: rs(8) },

  fieldLabel: { fontSize: rf(12), fontWeight: '600', color: TEXT, marginTop: rs(20), marginBottom: rs(8), marginLeft: rs(2) },
  fieldCard: {
    ...cardSurface,
    flexDirection: 'row',
    alignItems: 'center',
    height: rs(54),
    paddingHorizontal: rs(14),
    marginTop: rs(20),
  },
  // The icon owns the left gutter, so the text starts after it rather than
  // under it — `padding: 0` keeps RN's default vertical inset off the glyphs.
  fieldInput: { flex: 1, marginLeft: rs(10), fontSize: rf(15.5), fontWeight: '600', color: TEXT, padding: 0 },

  backBtn: { alignSelf: 'flex-start', height: rs(36), width: rs(36), alignItems: 'center', justifyContent: 'center', marginBottom: rs(8), marginLeft: -rs(8) },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: rs(26) },
  otpBox: {
    ...cardSurface,
    flex: 1,
    height: rs(56),
    marginHorizontal: rs(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: { borderColor: GREEN, borderWidth: 1.5 },
  otpChar: { fontSize: rf(20), fontWeight: '700', color: TEXT },
  otpCharEmpty: { fontSize: rf(20), fontWeight: '700', color: tokens.borderStrong },
  otpHiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0, color: 'transparent' },

  note: { fontSize: rf(12.5), color: GREEN, marginTop: rs(10), textAlign: 'center' },

  cta: { height: rs(56), borderRadius: rs(10), marginTop: rs(26), paddingVertical: 0 },
  ctaInner: { flexDirection: 'row', alignItems: 'center' },
  // White, because the CTA fill is dark (#004C40, luminance 0.055): white on it
  // is 10:1, the dark text token only 1.7:1.
  ctaText: { color: '#FFFFFF', fontSize: rf(14.5), fontWeight: '500', letterSpacing: 1.6, marginRight: rs(10) },

  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: rs(30) },
  resendMuted: { fontSize: rf(12.5), color: MUTED },
  resendLink: { fontSize: rf(12.5), fontWeight: '700', color: AMBER_DARK },
  resendLinkOff: { color: MUTED, fontWeight: '600' },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: rs(24) },
  signupMuted: { fontSize: rf(13), color: MUTED },
  signupLink: { fontSize: rf(13), fontWeight: '800', color: GREEN },

  errorBox: {
    marginTop: rs(14),
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    backgroundColor: 'rgba(220,38,38,0.08)',
    paddingHorizontal: rs(12),
    paddingVertical: rs(9),
  },
  errorText: { fontSize: rf(12), lineHeight: rlh(17), color: DANGER },
});
