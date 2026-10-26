import React from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from './cn';

/**
 * SafeAreaView wrapper that normalises top/bottom inset handling and gives
 * every screen the same light-grey background. Children can opt out of the
 * default content padding by passing `padded={false}`.
 */
export function ScreenContainer({
  children,
  className,
  contentClassName,
  edges = ['top'],
  padded = false,
  scroll = false,
  withBottomBar = false,
  background = 'bg-background',
}) {
  const insets = useSafeAreaInsets();
  // Reserve room for the absolute BottomActionBar. Its height grows with the
  // system nav bar (bigger in 3-button mode), so derive the clearance from the
  // real bottom inset instead of a fixed 96 that clipped content in 3-button
  // navigation. 84 = button + top padding + a small gap above the bar's own
  // inset padding.
  return (
    <SafeAreaView edges={edges} className={cn('flex-1', background, className)}>
      {Platform.OS === 'android' ? <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" /> : null}
      <View
        className={cn('flex-1', padded && 'px-4', contentClassName)}
        style={withBottomBar ? { paddingBottom: insets.bottom + 84 } : null}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

// Inset-aware bottom clearance for content that sits under a sticky element.
// Returns Math.max(insets.bottom, 12) + extra as a plain number for use in
// contentContainerStyle.paddingBottom. Pass extra ≈ 96 to clear a full
// BottomActionBar (button + chrome) in BOTH 3-button and gesture nav modes.
export function useBottomBarInset(extra = 24) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + extra;
}
