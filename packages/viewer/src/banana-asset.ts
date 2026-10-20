/**
 * The six-inch (154 mm) reference model bundled with `@toolpath/viewer`.
 *
 * Resolved against this module, so an application's bundler finds the GLB
 * shipped beside the package's build and serves it wherever it puts assets.
 */
export const BANANA_MODEL_URL = new URL('./assets/banana.glb', import.meta.url).href
