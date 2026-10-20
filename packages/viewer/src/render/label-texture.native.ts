import type { CanvasTexture } from 'three'

/**
 * React Native's `render/label-texture.ts`. There is no 2D canvas to draw a
 * face name with; the native view cube draws its names as glyph geometry
 * (`cube-label.native.tsx`) instead.
 */
export function labelTexture(_label: string, _color: number): CanvasTexture {
  throw new Error('@toolpath/viewer: labelTexture is not available on React Native.')
}
