import { useCallback, useEffect, useRef, useState } from 'react'
import { disposeFileMesh, type FileMeshBody, loadFileMesh } from './file-mesh.js'
import type { LoadPartGeometryOptions } from './geometry.js'

export interface FileMesh {
  /** Each body the mesh draws, by index, once it has loaded; `null` until then and after a failure. */
  bodies: ReadonlyMap<number, FileMeshBody> | null
  error: Error | null
  /** Fetches the mesh again, from the latest `url`, after a failure. */
  retry: () => void
}

interface Loaded {
  path: string
  attempt: number
  bodies: ReadonlyMap<number, FileMeshBody> | null
  error: Error | null
}

/**
 * A file's mesh (`GET /v1/files/{id}/mesh`), split into its bodies, for
 * `usePartCollection` or `<PartCollection items>`. Pass `null` until there is
 * a URL. A new presigned URL for the same mesh is not fetched again; another
 * mesh replaces this one, and its bodies are freed once nothing draws them, as
 * they are on unmounting. `options` are read once.
 */
export const useFileMesh = (url: string | null, options?: LoadPartGeometryOptions): FileMesh => {
  const [initial] = useState(options)
  // The artifact, not the presign: its query string changes with every response.
  const path = url?.split('?')[0] ?? null
  // Read by the effect below, which runs after this one, without refetching when only the query changes.
  const latest = useRef(url)
  useEffect(() => {
    latest.current = url
  })
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    const current = latest.current
    if (path === null || current === null) {
      return
    }
    const controller = new AbortController()
    let bodies: ReadonlyMap<number, FileMeshBody> | null = null
    loadFileMesh(current, { ...initial, signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) {
          disposeFileMesh(result)
          return
        }
        bodies = result
        setLoaded({ path, attempt, bodies: result, error: null })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          const reason = error instanceof Error ? error : new Error(String(error))
          setLoaded({ path, attempt, bodies: null, error: reason })
        }
      },
    )
    // Runs after the render that stopped returning these bodies has been drawn.
    return () => {
      controller.abort()
      if (bodies) {
        disposeFileMesh(bodies)
      }
    }
  }, [path, attempt, initial])
  const current = loaded?.path === path && loaded.attempt === attempt ? loaded : null
  const failed = current?.error != null
  const retry = useCallback(() => {
    if (failed) {
      setAttempt((value) => value + 1)
    }
  }, [failed])
  return { bodies: current?.bodies ?? null, error: current?.error ?? null, retry }
}
