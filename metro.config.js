// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `@expo/ngrok` (CLI-only, used for `expo start --tunnel`, never bundled
// into the app) pulls in `http2-wrapper`. This project lives inside a
// OneDrive-synced folder, and OneDrive's cloud-file placeholders make
// Windows report some node_modules files as symlink-like reparse points —
// Metro's file-map crawler then calls `readlink` on them and gets
// `EINVAL: invalid argument`. Since this package is irrelevant to the RN
// bundle, simplest fix is to keep Metro from watching/crawling it at all.
// (metro-config's `exclusionList` helper isn't a public export in this
// Metro version, so just assign the pattern directly — resolver.blockList
// accepts a RegExp or RegExp[].)
config.resolver.blockList = [/node_modules[\\/]http2-wrapper[\\/].*/];

module.exports = config;
