import type { CSSProperties, ReactNode } from 'react'

const STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  height: '100%',
  padding: '1rem',
  boxSizing: 'border-box',
  textAlign: 'center',
}

const DEFAULT_MESSAGE = (
  <>
    <strong>3D view unavailable</strong>
    <span>
      WebGL is blocked in this browser. Turn on graphics (hardware) acceleration in your browser
      settings, then restart the browser.
    </span>
  </>
)

/** What `Viewer` renders in place of its canvas when the browser will not create a WebGL context. */
export const WebGLUnavailable = ({ children = DEFAULT_MESSAGE }: { children?: ReactNode }) => (
  <div
    className="viewer-webgl-unavailable"
    data-viewer-webgl-unavailable="true"
    role="alert"
    style={STYLE}
  >
    {children}
  </div>
)
