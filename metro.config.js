const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Gradle writes compile output under expo-modules-autolinking/android whenever
// the app is built locally, and rewrites it while Metro is still crawling. The
// watcher then calls fs.watch() on a directory that has already been replaced
// and `expo start` dies with ENOENT (-4058). Nothing in there is ever imported
// by the bundle, so keep it out of the crawl entirely. This app now ships a
// local native module (modules/ggfix-downloads), which is what makes gradle
// touch that tree in the first place.
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /node_modules[\\/]expo-modules-autolinking[\\/]android[\\/].*[\\/]build([\\/]|$)/,
];

// NOTE: `inlineRem` is deliberately left at its default (14).
//
// The shop app sets `inlineRem: false` and pairs it with its own
// src/theme/remScaling.js so className spacing tracks the device. That pairing
// is all-or-nothing for a binary: turning it off here without also loading
// remScaling would leave rem unresolved, and loading remScaling would retune
// the CUSTOMER app's spacing on every non-reference device. The vendored shop
// screens render at the same values they always did on the 392pt reference
// device (its REM_BASE is 14 too) — they simply don't scale beyond it.
module.exports = withNativeWind(config, { input: './global.css' });
