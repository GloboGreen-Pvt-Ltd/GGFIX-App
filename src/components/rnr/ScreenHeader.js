import React from 'react';
import { useRoute } from '@react-navigation/native';
import PageHeader from '../PageHeader';
import { HEADER_SUBTITLES } from '../../navigation/headerSubtitles';

/**
 * In-screen page header — the app-wide PageHeader (back · title + subtitle ·
 * right action). Without a `subtitle`, the route's HEADER_SUBTITLES entry is
 * used. `transparent`: the screen already pads for the status bar.
 */
export function ScreenHeader({ title, subtitle, onBack, right, transparent = false }) {
  const route = useRoute();
  return (
    <PageHeader
      title={title}
      subtitle={subtitle ?? HEADER_SUBTITLES[route.name]}
      onBack={onBack}
      right={right}
      safeTop={!transparent}
    />
  );
}

// Alias for the name in the user's spec.
export const AppHeader = ScreenHeader;
