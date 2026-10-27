import type { PartModel } from '../model/types.js'
import { createPartCollectionLoader, type LoadedCollectionItem } from './collection.js'
import type { LoadPartGeometryOptions } from './geometry.js'

/**
 * A body to show: its model, kept the same object while it is unchanged, or a
 * `key` and a function that builds the model, called only when the key changes.
 */
export type PartCollectionModel =
  | { id: string; model: PartModel; key?: unknown }
  | { id: string; key: unknown; model: () => PartModel }

/** What identifies a body's model: its key, or the model object itself. */
const keyOf = (model: PartCollectionModel): unknown => model.key ?? model.model

export interface PartCollectionState {
  /** One item per model, in order, once every model has loaded; `null` until then. */
  items: ReadonlyArray<LoadedCollectionItem> | null
  /**
   * Models whose latest build or load failed, and which: a model that did not
   * build needs new input, a mesh that did not load can be fetched again. An
   * item already shown for one stays in `items`.
   */
  failures: ReadonlyArray<{ id: string; error: Error; kind: 'build' | 'load' }>
  /** The ids whose latest model is not on screen yet, and has not failed. */
  waiting: ReadonlyArray<string>
}

/** The session's own state: the key of each item on screen, from which `waiting` is read. */
export interface PartCollectionSnapshot {
  items: PartCollectionState['items']
  failures: PartCollectionState['failures']
  shown: ReadonlyMap<string, unknown>
}

/**
 * The bodies of `models` whose model is not the one on screen. Read against the
 * models being rendered, not the ones the session was last given, so a body
 * whose model has just changed is waiting in the very render that changed it.
 */
export const waitingFor = (
  models: ReadonlyArray<PartCollectionModel>,
  { failures, shown }: PartCollectionSnapshot,
): Array<string> =>
  models.flatMap((model) =>
    shown.get(model.id) !== keyOf(model) && !failures.some(({ id }) => id === model.id)
      ? [model.id]
      : [],
  )

export type PartCollectionOptions = LoadPartGeometryOptions & { concurrency?: number }

/** What `usePartCollection` runs: the models asked for, what has loaded, and what to free. */
export interface PartCollectionSession {
  /** The models to show, in order. A model whose key changed loads and replaces its item. */
  show(models: ReadonlyArray<PartCollectionModel>): void
  /** Loads failed models again, or only `id`'s. */
  retry(id?: string): void
  /** Call with the items the scene shows once it has rendered them. */
  keep(items: ReadonlyArray<LoadedCollectionItem>): void
  subscribe(listener: () => void): () => void
  get(): PartCollectionSnapshot
  dispose(): void
}

export const createPartCollectionSession = (
  options: PartCollectionOptions = {},
): PartCollectionSession => {
  const { concurrency = 3, ...loading } = options
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('Collection concurrency must be a positive integer.')
  }
  // One item at a time, so this session's limit holds across every model that changes.
  const loader = createPartCollectionLoader({ ...loading, concurrency: 1 })
  let order: Array<string> = []
  // Each id's key and builder as last given, and the model built for that key.
  const keys = new Map<string, unknown>()
  const builders = new Map<string, () => PartModel>()
  const requested = new Map<string, PartModel>()
  const shown = new Map<string, LoadedCollectionItem>()
  // The key each shown item was built for.
  const shownKeys = new Map<string, unknown>()
  const failed = new Map<string, { error: Error; kind: 'build' | 'load' }>()
  const queue: Array<string> = []
  let running = 0
  let complete = false
  let disposed = false
  let state: PartCollectionSnapshot = { items: null, failures: [], shown: new Map() }
  const listeners = new Set<() => void>()

  // Only a change to what is shown or what failed is published, so a consumer renders for nothing else.
  const publish = () => {
    complete ||= order.every((id) => shown.has(id))
    const items = complete ? order.flatMap((id) => shown.get(id) ?? []) : null
    const failures = order.flatMap((id) => {
      const failure = failed.get(id)
      return failure ? [{ id, ...failure }] : []
    })
    const keysShown = new Map(
      order.flatMap((id) => (shownKeys.has(id) ? [[id, shownKeys.get(id)]] : [])),
    )
    const sameKeys =
      keysShown.size === state.shown.size &&
      [...keysShown].every(([id, key]) => state.shown.has(id) && state.shown.get(id) === key)
    const sameItems =
      items === null
        ? state.items === null
        : state.items !== null &&
          items.length === state.items.length &&
          items.every((item, index) => item === state.items![index])
    const sameFailures =
      failures.length === state.failures.length &&
      failures.every(
        (failure, index) =>
          failure.id === state.failures[index]!.id &&
          failure.error === state.failures[index]!.error &&
          failure.kind === state.failures[index]!.kind,
      )
    if (sameItems && sameFailures && sameKeys) {
      return
    }
    state = {
      items: sameItems ? state.items : items,
      failures: sameFailures ? state.failures : failures,
      shown: sameKeys ? state.shown : keysShown,
    }
    for (const listener of listeners) {
      listener()
    }
  }

  const enqueue = (id: string) => {
    if (!queue.includes(id)) {
      queue.push(id)
    }
  }

  // A builder that throws is that body's failure, as a mesh that will not load is.
  const build = (id: string) => {
    // Back to the key on screen: that item is the model, with nothing to build or load.
    if (shown.has(id) && shownKeys.get(id) === keys.get(id)) {
      requested.set(id, shown.get(id)!.model)
      failed.delete(id)
      return
    }
    try {
      requested.set(id, builders.get(id)!())
    } catch (error) {
      requested.delete(id)
      failed.set(id, {
        error: error instanceof Error ? error : new Error(String(error)),
        kind: 'build',
      })
      return
    }
    failed.delete(id)
    enqueue(id)
  }

  // Each load is for the model asked for when it starts; a result for a model since replaced is dropped.
  const pump = () => {
    while (!disposed && running < concurrency && queue.length > 0) {
      const id = queue.shift()!
      const model = requested.get(id)
      const key = keys.get(id)
      if (!model || shown.get(id)?.model === model) {
        continue
      }
      running += 1
      void loader
        .load([{ id, model }])
        .then(
          ({ items: [item], failures: [failure] }) => {
            if (disposed || requested.get(id) !== model) {
              return
            }
            if (item) {
              shown.set(id, item)
              shownKeys.set(id, key)
              failed.delete(id)
            } else if (failure) {
              failed.set(id, { error: failure.error, kind: 'load' })
            }
            publish()
          },
          (error: unknown) => {
            if (disposed || requested.get(id) !== model) {
              return
            }
            failed.set(id, {
              error: error instanceof Error ? error : new Error(String(error)),
              kind: 'load',
            })
            publish()
          },
        )
        .finally(() => {
          running -= 1
          pump()
        })
    }
  }

  return {
    show(models) {
      const ids = models.map((model) => model.id)
      if (new Set(ids).size !== ids.length) {
        throw new Error('Collection item ids must be unique.')
      }
      let changed = ids.length !== order.length || ids.some((id, index) => id !== order[index])
      order = ids
      for (const map of [keys, builders, requested, shown, shownKeys, failed]) {
        for (const id of map.keys()) {
          if (!ids.includes(id)) {
            map.delete(id)
          }
        }
      }
      for (const entry of models) {
        const { id, model } = entry
        builders.set(id, typeof model === 'function' ? model : () => model)
        const next = keyOf(entry)
        if (keys.has(id) && keys.get(id) === next) {
          continue
        }
        keys.set(id, next)
        changed = true
        build(id)
      }
      if (changed) {
        publish()
        pump()
      }
    },
    retry(id) {
      const ids = id === undefined ? [...failed.keys()] : failed.has(id) ? [id] : []
      if (ids.length === 0) {
        return
      }
      for (const each of ids) {
        failed.delete(each)
        // A model that did not build is built again; one that did is loaded again.
        if (requested.has(each)) {
          enqueue(each)
        } else {
          build(each)
        }
      }
      publish()
      pump()
    },
    keep(items) {
      loader.keep(items)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get: () => state,
    dispose() {
      disposed = true
      listeners.clear()
      loader.dispose()
    },
  }
}
