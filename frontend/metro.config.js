// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// body_model.smplmesh (frontend/assets/smpl/) is plain JSON text, but at ~6MB for the real SMPL
// mesh (see backend/scripts/convert_smpl.py) it must NOT go through Metro's default .json source
// transform — that inlines the whole parsed object into the JS bundle every screen that imports it
// has to download/parse before it can render. Treating this one extension as a binary asset instead
// makes Metro serve it as a separate, on-demand file (via expo-asset), keeping it out of the JS
// bundle entirely. See frontend/src/lib/smpl/bodyModel.ts for the loader.
config.resolver.assetExts.push('smplmesh');

module.exports = config;
