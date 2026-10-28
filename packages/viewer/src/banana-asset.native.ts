import { Asset } from 'expo-asset'
import banana from './assets/banana.glb'

/**
 * The six-inch (154 mm) reference model bundled with `@toolpath/viewer`.
 *
 * On React Native the model is one of the app's assets: Metro bundles the GLB
 * the import names, and `expo-asset` gives the URI it can be loaded from — a
 * file in development and a bundled resource in a release build.
 */
export const BANANA_MODEL_URL = Asset.fromModule(banana).uri
