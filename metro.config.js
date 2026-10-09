const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Gradle/Kotlin compile output under expo-*-gradle-plugin packages gets
// rewritten while Metro is still crawling node_modules, and the watcher's
// fs.watch() call on a directory that just got replaced dies with ENOENT
// (-4058). Nothing under build/classes is ever imported by the bundle, so
// keep it out of the crawl entirely.
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /node_modules[\\/].*[\\/]build[\\/]classes[\\/].*/,
];

module.exports = withNativeWind(config, { input: './global.css' });
