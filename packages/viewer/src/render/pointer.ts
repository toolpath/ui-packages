/**
 * One way to read a pointer event, whichever renderer sent it.
 *
 * A DOM `PointerEvent` and the event React Native hands R3F carry different
 * fields. React Native's has no `clientX`/`clientY`, `button`, `timeStamp` or
 * modifier keys; it has `offsetX`/`offsetY` (R3F copies them from
 * `locationX`/`locationY`), `pageX`/`pageY` and `timestamp`. Everything in the package that judges a gesture reads through
 * {@link readPointer}, so it reads both the same way.
 */
export interface PointerReading {
  /** Canvas-local CSS pixels. */
  x: number
  y: number
  /** Viewport pixels on the web; page pixels on native. Only ever compared with each other. */
  clientX: number
  clientY: number
  button: number
  timeStamp: number
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

/** A DOM `PointerEvent`, React Native's, or anything else {@link readPointer} can read. */
export type PointerLike = Partial<
  Record<
    | 'clientX'
    | 'clientY'
    | 'offsetX'
    | 'offsetY'
    | 'pageX'
    | 'pageY'
    | 'button'
    | 'timeStamp'
    | 'timestamp'
    | 'altKey'
    | 'ctrlKey'
    | 'metaKey'
    | 'shiftKey',
    unknown
  >
>

const number = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined

/** `element` is the canvas the event's coordinates should be local to, when the event has client coordinates. */
export function readPointer(
  event: unknown,
  element?: { getBoundingClientRect?: () => DOMRectReadOnly },
): PointerReading {
  const source = (event ?? {}) as PointerLike

  let x: number
  let y: number
  let clientX: number
  let clientY: number

  const webX = number(source.clientX)
  if (webX !== undefined) {
    clientX = webX
    clientY = number(source.clientY) ?? 0
    const rect = element?.getBoundingClientRect?.()
    if (rect) {
      x = clientX - rect.left
      y = clientY - rect.top
    } else {
      x = number(source.offsetX) ?? 0
      y = number(source.offsetY) ?? 0
    }
  } else {
    x = number(source.offsetX) ?? 0
    y = number(source.offsetY) ?? 0
    clientX = number(source.pageX) ?? number(source.offsetX) ?? 0
    clientY = number(source.pageY) ?? number(source.offsetY) ?? 0
  }

  return {
    x,
    y,
    clientX,
    clientY,
    button: number(source.button) ?? 0,
    timeStamp: number(source.timeStamp) ?? number(source.timestamp) ?? performance.now(),
    altKey: source.altKey === true,
    ctrlKey: source.ctrlKey === true,
    metaKey: source.metaKey === true,
    shiftKey: source.shiftKey === true,
  }
}

/** Calls the event's `preventDefault` when it has one; React Native's events may not. */
export function preventPointerDefault(event: unknown): void {
  const prevent = (event as { preventDefault?: unknown } | null)?.preventDefault
  if (typeof prevent === 'function') prevent.call(event)
}
