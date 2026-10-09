import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useFonts, Inter_400Regular, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';
import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import colors from './src/theme/colors';
import LaunchOverlay from './src/components/LaunchOverlay';
import { setBootProgress } from './src/boot/bootProgress';

const navTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.headerBg,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

export default function App() {
  // Inter for page titles + subtitles (PageHeader). Render once it's ready —
  // or straight away with the system font if loading fails.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_800ExtraBold });
  const fontsReady = !!(fontsLoaded || fontError);
  useEffect(() => { if (fontsReady) setBootProgress(0.25, 'Getting things ready…'); }, [fontsReady]);

  return (
    <Provider store={store}>
      <GluestackUIProvider config={config}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          {fontsReady ? (
            <NavigationContainer theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
          ) : null}
          {/* Launch screen over the app until the first page is fully loaded. */}
          <LaunchOverlay />
        </SafeAreaProvider>
      </GluestackUIProvider>
    </Provider>
  );
}
