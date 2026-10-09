import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getSession, clearSession, setAuthExpiredHandler, isTokenExpired } from '../auth/session';
import { logout } from '../api/auth';
import { setSession, clearSession as clearAuth } from '../store/authSlice';
import LoginScreen from '../screens/LoginScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ForgotPasswordOtpScreen from '../screens/ForgotPasswordOtpScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import CustomerNavigator from './CustomerNavigator';
import { setBootProgress, finishBoot } from '../boot/bootProgress';
import AppLockGate from '../components/AppLockGate';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const dispatch = useDispatch();
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then(async (s) => {
      const live = s?.accessToken && isTokenExpired(s.accessToken) ? null : s;
      if (s && !live) await clearSession();
      setSessionState(live);
      dispatch(setSession(live));
      setLoading(false);
      // Logged in → Home finishes the launch screen once it's loaded;
      // logged out → the Login screen is ready now.
      if (live?.accessToken) setBootProgress(0.4, 'Loading your home…');
      else finishBoot();
    });
  }, [dispatch]);

  // When the API client detects an expired/invalid token, drop to Login.
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setSessionState(null);
      dispatch(clearAuth());
    });
    return () => setAuthExpiredHandler(null);
  }, [dispatch]);

  const handleLogin = (newSession) => {
    setSessionState(newSession);
    dispatch(setSession(newSession));
  };
  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    await clearSession();
    setSessionState(null);
    dispatch(clearAuth());
  };

  if (loading) {
    return null;
  }

  if (!session?.accessToken) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login">
          {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
        </Stack.Screen>
        <Stack.Screen name="CreateAccount">
          {(props) => <CreateAccountScreen {...props} onLogin={handleLogin} />}
        </Stack.Screen>
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpScreen} />
        <Stack.Screen name="ResetPassword">
          {(props) => <ResetPasswordScreen {...props} onLogin={handleLogin} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return (
    <AppLockGate onLogout={handleLogout}>
      <CustomerNavigator session={session} onLogout={handleLogout} />
    </AppLockGate>
  );
}
