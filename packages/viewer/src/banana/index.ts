// The scale banana on its own, so that only an application that imports it
// bundles its model: on React Native, Metro bundles every asset an import
// reaches. The web root re-exports it as well.
export { Banana } from '../banana.js'
export type { BananaProps } from '../banana.js'
export { BANANA_MODEL_URL } from '../banana-asset.js'
