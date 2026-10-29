import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  createPartCollectionSession,
  type PartCollectionModel,
  type PartCollectionOptions,
  type PartCollectionSession,
  type PartCollectionSnapshot,
  type PartCollectionState,
  waitingFor,
} from './collection-session.js'

export interface UsePartCollectionResult extends PartCollectionState {
  /** Loads every failed model again, or only `id`'s. Meshes that loaded are reused. */
  retry: (id?: string) => void
}

const NOTHING: PartCollectionSnapshot = { items: null, failures: [], shown: new Map() }
const subscribeToNothing = () => () => {}
const getNothing = () => NOTHING

/**
 * The meshes for a collection's models, ready for `<PartCollection items>`.
 *
 * Pass every body the scene should show: `{ id, model }`, the model kept the
 * same object while it is unchanged, or `{ id, key, model: () => PartModel }`,
 * built only when its key changes; a builder that throws is that body's
 * failure. `items` stays `null` until every body has loaded. Afterwards a body
 * whose model changes — its analysis replacing its display mesh — keeps its
 * current item, listed in `waiting`, until the new one has loaded. Meshes the
 * scene stops showing are freed, results for models since replaced are
 * dropped, and unmounting aborts what is loading. `options` are read once.
 */
export const usePartCollection = (
  models: ReadonlyArray<PartCollectionModel>,
  options?: PartCollectionOptions,
): UsePartCollectionResult => {
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
  const waiting = useMemo(() => waitingFor(models, state), [models, state])
  const retry = useCallback((id?: string) => session?.retry(id), [session])
  return { items: state.items, failures: state.failures, waiting, retry }
}
