import React, { useState, useEffect, useCallback } from 'react';
import { Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getSession, saveSession, clearSession, setAuthExpiredHandler } from '../auth/session';
import { logout } from '../api/auth';
import { setSession, clearSession as clearAuth } from '../store/authSlice';
import { resolveShell, suggestedEntry, ENTRY_LABEL, KIND_LABEL } from '../auth/roleRouting';

// ---- chooser ---------------------------------------------------------------
import LoginSelectScreen from '../screens/LoginSelectScreen';

// ---- customer shell --------------------------------------------------------
import CustomerLoginScreen from '../screens/LoginScreen';
import CustomerCreateAccountScreen from '../screens/CreateAccountScreen';
import CustomerForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import CustomerForgotPasswordOtpScreen from '../screens/ForgotPasswordOtpScreen';
import CustomerResetPasswordScreen from '../screens/ResetPasswordScreen';
import CustomerNavigator from './CustomerNavigator';
import CustomerAppLockGate from '../components/AppLockGate';

// ---- shop shell (ggfix shop app, vendored under shop/) ----------------------
import ShopLoginScreen from '../../shop/src/screens/LoginScreen';
import ShopCreateAccountScreen from '../../shop/src/screens/CreateAccountScreen';
import ShopForgotPasswordScreen from '../../shop/src/screens/ForgotPasswordScreen';
import ShopForgotPasswordOtpScreen from '../../shop/src/screens/ForgotPasswordOtpScreen';
import ShopResetPasswordScreen from '../../shop/src/screens/ResetPasswordScreen';
import ShopOwnerNavigator from '../../shop/src/navigation/OwnerNavigator';
import ShopTechnicianNavigator from '../../shop/src/navigation/TechnicianNavigator';
import ShopAppLockGate from '../../shop/src/components/AppLockGate';

// ---- employee shell (ggfix employee app, vendored under employee/) ----------
import EmployeeLoginScreen from '../../employee/src/screens/LoginScreen';
import EmployeeTechnicianNavigator from '../../employee/src/navigation/TechnicianNavigator';
import EmployeeAppLockGate from '../../employee/src/components/AppLockGate';
import GeofenceGate from '../../employee/src/components/GeofenceGate';

import colors from '../theme/colors';

const RootStack = createNativeStackNavigator();
const CustomerAuthStack = createNativeStackNavigator();
const ShopAuthStack = createNativeStackNavigator();
const EmployeeAuthStack = createNativeStackNavigator();

/* ══════════════════════════════════════════════════════════════════════════
   Logged-out flows — one nested stack per shell.

   Each product was written with its own 'Login' / 'CreateAccount' /
   'ForgotPassword' / 'ResetPassword' route names, and all three define screens
   under those same names. Nesting gives each its own route namespace, so
   `navigation.navigate('CreateAccount')` inside a shop screen reaches the SHOP
   sign-up rather than the customer one, with no edits to the vendored trees.
   ══════════════════════════════════════════════════════════════════════════ */

function CustomerAuthFlow({ onLogin }) {
  return (
    <CustomerAuthStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomerAuthStack.Screen name="Login">
        {(props) => <CustomerLoginScreen {...props} onLogin={onLogin} />}
      </CustomerAuthStack.Screen>
      <CustomerAuthStack.Screen name="CreateAccount">
        {(props) => <CustomerCreateAccountScreen {...props} onLogin={onLogin} />}
      </CustomerAuthStack.Screen>
      <CustomerAuthStack.Screen name="ForgotPassword" component={CustomerForgotPasswordScreen} />
      <CustomerAuthStack.Screen name="ForgotPasswordOtp" component={CustomerForgotPasswordOtpScreen} />
      <CustomerAuthStack.Screen name="ResetPassword">
        {(props) => <CustomerResetPasswordScreen {...props} onLogin={onLogin} />}
      </CustomerAuthStack.Screen>
    </CustomerAuthStack.Navigator>
  );
}

function ShopAuthFlow({ onLogin }) {
  return (
    <ShopAuthStack.Navigator screenOptions={{ headerShown: false }}>
      {/* Shop sign-in sits on pure white, not the app's wash — override the
          card too so the wash can't flash behind it mid-transition. */}
      <ShopAuthStack.Screen name="Login" options={{ contentStyle: { backgroundColor: '#FFFFFF' } }}>
        {(props) => <ShopLoginScreen {...props} onLogin={onLogin} />}
      </ShopAuthStack.Screen>
      <ShopAuthStack.Screen name="CreateAccount" component={ShopCreateAccountScreen} />
      <ShopAuthStack.Screen name="ForgotPassword" component={ShopForgotPasswordScreen} />
      <ShopAuthStack.Screen name="ForgotPasswordOtp" component={ShopForgotPasswordOtpScreen} />
      <ShopAuthStack.Screen name="ResetPassword">
        {(props) => <ShopResetPasswordScreen {...props} onLogin={onLogin} />}
      </ShopAuthStack.Screen>
    </ShopAuthStack.Navigator>
  );
}

function EmployeeAuthFlow({ onLogin }) {
  return (
    <EmployeeAuthStack.Navigator screenOptions={{ headerShown: false }}>
      <EmployeeAuthStack.Screen name="Login">
        {(props) => <EmployeeLoginScreen {...props} onLogin={onLogin} />}
      </EmployeeAuthStack.Screen>
    </EmployeeAuthStack.Navigator>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Blocked-account screen
   ══════════════════════════════════════════════════════════════════════════ */

function BlockedAccountScreen({ title, message, onLogout }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
        {title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: 12,
          lineHeight: 21,
        }}
      >
        {message}
      </Text>
      <Text
        accessibilityRole="button"
        onPress={onLogout}
        style={{
          marginTop: 26,
          overflow: 'hidden',
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingHorizontal: 28,
          paddingVertical: 14,
          color: '#FFFFFF',
          fontWeight: '800',
          fontSize: 15,
        }}
      >
        Back to sign in
      </Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Root
   ══════════════════════════════════════════════════════════════════════════ */

export default function RootNavigator() {
  const dispatch = useDispatch();
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSessionState(s);
      dispatch(setSession(s));
      setLoading(false);
    });
  }, [dispatch]);

  // When the API client detects an expired/invalid token, drop to the chooser.
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setSessionState(null);
      dispatch(clearAuth());
    });
    return () => setAuthExpiredHandler(null);
  }, [dispatch]);

  /**
   * Tag the session with the chooser entry that produced it and re-persist.
   *
   * Each shell's own `api/auth.js` has already written the raw login response
   * to storage by the time onLogin fires; re-saving here is what adds
   * `loginShell` so a cold start restores the same shell. Later writes
   * (fetchMe, profile edits) spread the previous session, so the tag survives.
   */
  const handleLogin = useCallback(
    (entry) => async (newSession) => {
      const tagged = { ...(newSession || {}), loginShell: entry };
      try {
        await saveSession(tagged);
      } catch (_) {
        // Storage failure must not strand the user on the login screen — the
        // in-memory session below still routes them into the app.
      }
      setSessionState(tagged);
      dispatch(setSession(tagged));
    },
    [dispatch],
  );

  const handleLogout = useCallback(async () => {
    try { await logout(); } catch (_) {}
    await clearSession();
    setSessionState(null);
    dispatch(clearAuth());
  }, [dispatch]);

  const onCustomerLogin = useCallback((s) => handleLogin('CUSTOMER')(s), [handleLogin]);
  const onShopLogin = useCallback((s) => handleLogin('SHOP')(s), [handleLogin]);
  const onEmployeeLogin = useCallback((s) => handleLogin('EMPLOYEE')(s), [handleLogin]);

  if (loading) return null;

  if (!session?.accessToken) {
    return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="LoginSelect" component={LoginSelectScreen} />
        <RootStack.Screen name="CustomerLogin">
          {(props) => <CustomerAuthFlow {...props} onLogin={onCustomerLogin} />}
        </RootStack.Screen>
        <RootStack.Screen name="ShopLogin">
          {(props) => <ShopAuthFlow {...props} onLogin={onShopLogin} />}
        </RootStack.Screen>
        <RootStack.Screen name="EmployeeLogin">
          {(props) => <EmployeeAuthFlow {...props} onLogin={onEmployeeLogin} />}
        </RootStack.Screen>
      </RootStack.Navigator>
    );
  }

  const { shell, kind, chosen } = resolveShell(session);

  if (shell === 'CUSTOMER') {
    return (
      <CustomerAppLockGate onLogout={handleLogout}>
        <CustomerNavigator session={session} onLogout={handleLogout} />
      </CustomerAppLockGate>
    );
  }

  if (shell === 'SHOP_OWNER' || shell === 'SHOP_TECHNICIAN') {
    return (
      <ShopAppLockGate onLogout={handleLogout}>
        {shell === 'SHOP_OWNER' ? (
          <ShopOwnerNavigator session={session} onLogout={handleLogout} />
        ) : (
          <ShopTechnicianNavigator session={session} onLogout={handleLogout} />
        )}
      </ShopAppLockGate>
    );
  }

  if (shell === 'EMPLOYEE') {
    // The geofence gate wraps the whole authenticated employee app so the
    // location check runs right after login — out of the shop's 100m range
    // shows a blocking lock screen instead of the technician stack.
    return (
      <EmployeeAppLockGate onLogout={handleLogout}>
        <GeofenceGate onLogout={handleLogout}>
          <EmployeeTechnicianNavigator session={session} onLogout={handleLogout} />
        </GeofenceGate>
      </EmployeeAppLockGate>
    );
  }

  if (shell === 'MISMATCH') {
    return (
      <BlockedAccountScreen
        title="Wrong sign-in option"
        message={
          `You chose ${ENTRY_LABEL[chosen] || 'that option'}, but this is ` +
          `${KIND_LABEL[kind] || 'a different kind of account'}. Go back and pick ` +
          `${ENTRY_LABEL[suggestedEntry(kind)]} instead.`
        }
        onLogout={handleLogout}
      />
    );
  }

  return (
    <BlockedAccountScreen
      title="Account not supported here"
      message={
        kind === 'ADMIN'
          ? 'Admin and market-person accounts sign in on the admin web dashboard, not in the mobile app.'
          : "This account doesn't have a role the GGFIX app can open. Contact your shop owner if you think that's wrong."
      }
      onLogout={handleLogout}
    />
  );
}
