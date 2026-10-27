import type { PartModel } from '../model/types.js'
import {
  createPartCollectionLoader,
  type CollectionModel,
  type LoadedCollectionItem,
} from './collection.js'
import type { LoadPartGeometryOptions } from './geometry.js'

export interface PartCollectionState {
  /** One item per model, in order, once every model has loaded; `null` until then. */
  items: ReadonlyArray<LoadedCollectionItem> | null
  /** Models whose latest load failed. An item already shown for one stays in `items`. */
  failures: ReadonlyArray<{ id: string; error: Error }>
}

export type PartCollectionOptions = LoadPartGeometryOptions & { concurrency?: number }

/** What `usePartCollection` runs: the models asked for, what has loaded, and what to free. */
export interface PartCollectionSession {
  /** The models to show, in order. A model whose object changed loads and replaces its item. */
  show(models: ReadonlyArray<CollectionModel>): void
  /** Loads failed models again, or only `id`'s. */
  retry(id?: string): void
  /** Call with the items the scene shows once it has rendered them. */
  keep(items: ReadonlyArray<LoadedCollectionItem>): void
  subscribe(listener: () => void): () => void
  get(): PartCollectionState
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
  const requested = new Map<string, PartModel>()
  const shown = new Map<string, LoadedCollectionItem>()
  const failed = new Map<string, Error>()
  const queue: Array<string> = []
  let running = 0
  let complete = false
  let disposed = false
  let state: PartCollectionState = { items: null, failures: [] }
  const listeners = new Set<() => void>()

  // Only a change to what is shown or what failed is published, so a consumer renders for nothing else.
  const publish = () => {
    complete ||= order.every((id) => shown.has(id))
    const items = complete ? order.flatMap((id) => shown.get(id) ?? []) : null
    const failures = order.flatMap((id) => {
      const error = failed.get(id)
      return error ? [{ id, error }] : []
    })
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
          failure.error === state.failures[index]!.error,
      )
    if (sameItems && sameFailures) {
      return
    }
    state = {
      items: sameItems ? state.items : items,
      failures: sameFailures ? state.failures : failures,
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

  // Each load is for the model asked for when it starts; a result for a model since replaced is dropped.
  const pump = () => {
    while (!disposed && running < concurrency && queue.length > 0) {
      const id = queue.shift()!
      const model = requested.get(id)
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
              failed.delete(id)
            } else if (failure) {
              failed.set(id, failure.error)
            }
            publish()
          },
          (error: unknown) => {
            if (disposed || requested.get(id) !== model) {
              return
            }
            failed.set(id, error instanceof Error ? error : new Error(String(error)))
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
      for (const map of [requested, shown, failed]) {
        for (const id of map.keys()) {
          if (!ids.includes(id)) {
            map.delete(id)
          }
        }
      }
      for (const { id, model } of models) {
        if (requested.get(id) === model) {
          continue
        }
        requested.set(id, model)
        failed.delete(id)
        changed = true
        enqueue(id)
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
        enqueue(each)
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
