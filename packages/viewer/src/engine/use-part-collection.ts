import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { CollectionModel } from './collection.js'
import {
  createPartCollectionSession,
  type PartCollectionOptions,
  type PartCollectionSession,
  type PartCollectionState,
} from './collection-session.js'

export interface PartCollection extends PartCollectionState {
  /** Loads every failed model again, or only `id`'s. Meshes that loaded are reused. */
  retry: (id?: string) => void
}

const NOTHING: PartCollectionState = { items: null, failures: [] }
const subscribeToNothing = () => () => {}
const getNothing = () => NOTHING

/**
 * The meshes for a collection's models, ready for `<PartCollection items>`.
 *
 * Pass every model the scene should show, keeping each model object the same
 * while it is unchanged, as `PartMesh` needs anyway. `items` stays `null` until
 * every model has loaded. Afterwards a model that changes — a body's analysis
 * replacing its display mesh — loads while its current item stays shown, and
 * replaces it once ready. Meshes the scene stops showing are freed, results
 * for models since replaced are dropped, and unmounting aborts what is loading.
 * `options` are read once.
 */
export const usePartCollection = (
  models: ReadonlyArray<CollectionModel>,
  options?: PartCollectionOptions,
): PartCollection => {
  const [initial] = useState(options)
  const [session, setSession] = useState<PartCollectionSession | null>(null)
  useEffect(() => {
    const created = createPartCollectionSession(initial)
    setSession(created)
    return () => created.dispose()
  }, [initial])
  useEffect(() => {
    session?.show(models)
  }, [models, session])
  const state = useSyncExternalStore(
    session?.subscribe ?? subscribeToNothing,
    session?.get ?? getNothing,
    getNothing,
  )
  // After the commit that shows these items, so a mesh is freed only once nothing draws it.
  useEffect(() => {
    if (state.items) {
      session?.keep(state.items)
    }
  }, [session, state.items])
  const retry = useCallback((id?: string) => session?.retry(id), [session])
  return { ...state, retry }
}
