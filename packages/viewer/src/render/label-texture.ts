import { CanvasTexture, SRGBColorSpace } from 'three'
import { cssHex } from './theme.js'
import { CUBE_LABEL_WIDTH } from './view-cube.js'

/**
 * The view cube's face names, drawn with the browser's 2D canvas.
 *
 * Apart from `render/view-cube.ts` because it is the one piece of the cube that
 * needs a DOM: everything else there is geometry.
 */

/** A face name, drawn on a transparent canvas and sized to fit. */
export function labelTexture(label: string, color: number): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (context) {
    const text = label.toUpperCase()
    const hex = cssHex(color)

    context.font = `600 ${size / 4}px system-ui, sans-serif`
    // Measured at a reference size, and the rest of them set to fit it.
    const width = context.measureText('BOTTOM').width || 1
    const scale = Math.min(1, (size * CUBE_LABEL_WIDTH) / width)

    context.font = `600 ${(size / 4) * scale}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = hex
    context.fillText(text, size / 2, size / 2)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true

  return texture
}
