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

// App code under src/ imports 'react-native' through src/shims/react-native.js
// (adds screen-level pull-to-refresh to vertical lists). The shim itself and
// node_modules still get the real package.
const path = require('path');
const SRC = (path.join(__dirname, 'src') + path.sep).toLowerCase();
const SHIM = path.join(__dirname, 'src', 'shims', 'react-native.js');
const SHIM_LC = SHIM.toLowerCase();
const prevResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native' && context.originModulePath.toLowerCase().startsWith(SRC) && context.originModulePath.toLowerCase() !== SHIM_LC) {
    return { type: 'sourceFile', filePath: SHIM };
  }
  return prevResolve ? prevResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
