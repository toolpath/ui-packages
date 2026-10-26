import type { CanvasTexture } from 'three'
import { webOnly } from '../../render/web-only.js'

/**
 * React Native's `render/label-texture.ts`. There is no 2D canvas to draw a
 * face name with; the native view cube draws its names as glyph geometry
 * (`native/cube-label.tsx`) instead.
 */
export function labelTexture(_label: string, _color: number): CanvasTexture {
  return webOnly('labelTexture')
}
