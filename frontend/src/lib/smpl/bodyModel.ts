import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { SmplAssetJson } from './types';

// A `.smplmesh` extension (not `.json`) so Metro treats it as a binary asset (see
// frontend/metro.config.js) instead of inlining the whole ~6MB parsed object into the JS bundle
// every screen that renders a body has to download before it can even start rendering.
// Metro's asset registry only recognizes statically-analyzable `require()` calls — an ESM import
// or a dynamic require wouldn't get asset-extracted, so this has to stay a plain require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bodyModelModule = require('../../../assets/smpl/body_model.smplmesh');

let cached: Promise<SmplAssetJson> | null = null;

/** Loads the SMPL (or placeholder) body mesh once and caches it — every subsequent call across
 * the app (SmplViewer, Smpl3DOverlay, repeat screen visits) reuses the same in-flight/resolved
 * promise instead of re-fetching and re-parsing several MB of JSON each time. */
export function loadBodyModel(): Promise<SmplAssetJson> {
  if (!cached) {
    cached = (async () => {
      const asset = Asset.fromModule(bodyModelModule);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      return (await new File(uri).json()) as SmplAssetJson;
    })();
  }
  return cached;
}
