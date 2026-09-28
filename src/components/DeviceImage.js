import React from 'react';
import { Image } from 'react-native';
import { resolveDeviceImageSource } from '../utils/images';

/**
 * Renders catalog images (brand logos, category/model thumbnails). Runs the
 * { url, base64 } pair through resolveDeviceImageSource, which normalizes
 * Cloudinary `.avif` URLs to `f_jpg` so RN's built-in <Image> decodes them on
 * Android (raw AVIF renders blank). Returns null when there's no image so
 * callers can render their own fallback.
 *
 * Accepts expo-image's `contentFit` prop name (for API-parity with the shop
 * app's DeviceImage) and maps it to RN <Image>'s `resizeMode`. We use RN
 * <Image> — not expo-image — because the customer app does not depend on
 * expo-image, keeping this a pure-JS component (no native rebuild needed).
 */
export default function DeviceImage({ url, base64, style, contentFit = 'contain', transition, ...rest }) {
  const uri = resolveDeviceImageSource({ url, base64 });
  if (!uri) return null;
  return <Image source={{ uri }} style={style} resizeMode={contentFit} {...rest} />;
}
