import type { CanvasProps } from '@react-three/fiber'
import type { ReactNode } from 'react'
import type { Projection } from './render/camera.js'
import type { ViewerTheme } from './render/theme.js'

/** What `<Viewer>` asks of its canvas, whichever frame draws it. */
export interface CanvasSettings {
  projection: Projection
  camera: NonNullable<CanvasProps['camera']>
  gl: NonNullable<CanvasProps['gl']>
  frameloop: NonNullable<CanvasProps['frameloop']>
}

/**
 * What `<Viewer>` hands its frame on every platform. Each platform's
 * `viewer-frame` adds the props an application passes it through `<Viewer>`.
 */
export interface FrameSettings {
  canvas: CanvasSettings
  /** For labels drawn without a DOM: React Native only. The web's are styled by the application. */
  labels?: ViewerTheme['labels']
  onPointerMissed?: () => void
  children: ReactNode
}
