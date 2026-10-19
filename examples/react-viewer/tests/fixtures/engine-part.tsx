import { Component, StrictMode, Suspense, useCallback, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Viewer } from '@toolpath/viewer'
import { EnginePart, engineGeometryCache } from '@toolpath/viewer/engine'

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    return this.state.error ? <p role="alert">{this.state.error.message}</p> : this.props.children
  }
}

const initialReport = await fetch('/engine-test-report.json').then(
  (response) => response.json() as Promise<Record<string, unknown>>,
)

const App = () => {
  const [report, setReport] = useState(initialReport)
  const [attempt, setAttempt] = useState(0)
  const [ready, setReady] = useState(false)
  const onAdjacency = useCallback(() => setReady(true), [])

  return (
    <>
      <button
        onClick={() => {
          setReady(false)
          setReport({
            ...initialReport,
            meshGlbUrl: '/engine-test.glb?signature=renewed',
            meshStlUrl: '/engine-test.stl?signature=renewed',
          })
          setAttempt((current) => current + 1)
        }}
      >
        Refresh URLs
      </button>
      <button
        onClick={() => {
          // The failed boundary has unmounted the only viewer using this cache.
          engineGeometryCache.clear()
          setReady(false)
          setAttempt((current) => current + 1)
        }}
      >
        Retry same URLs
      </button>
      <span data-testid="mesh-ready">{ready ? 'ready' : 'loading'}</span>
      <Boundary key={attempt}>
        <Suspense fallback={<p role="status">Loading mesh</p>}>
          <Viewer style={{ height: 400 }}>
            <EnginePart report={report} onAdjacency={onAdjacency} />
          </Viewer>
        </Suspense>
      </Boundary>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
