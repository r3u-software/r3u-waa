// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// This project lives inside a OneDrive-synced folder, and OneDrive's
// cloud-file placeholders make Windows report some node_modules files as
// symlink-like reparse points — Metro's file-map crawler then calls
// `readlink` on them and gets `EINVAL: invalid argument`. Not tied to one
// specific package: `http2-wrapper` (pulled in by `@expo/ngrok`, CLI-only,
// never bundled) was the first one hit; a dependency-version bump later
// surfaced the exact same error on a *nested* `react-is` copy under
// `expo-router/node_modules/`. Both entries below are irrelevant to the
// actual RN bundle (ngrok is CLI-only; a package's own bundled nested
// react-is duplicate isn't what gets resolved at runtime), so the fix is
// the same each time: keep Metro from crawling them at all. (metro-config's
// `exclusionList` helper isn't a public export in this Metro version, so
// just assign the pattern directly — resolver.blockList accepts a RegExp
// or RegExp[].) If this recurs on yet another nested package after a future
// dependency bump, same fix: add that path here too.
config.resolver.blockList = [
  /node_modules[\\/]http2-wrapper[\\/].*/,
  /node_modules[\\/].*[\\/]node_modules[\\/]react-is[\\/].*/,
];

module.exports = config;
