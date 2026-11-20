import React, {
  KeyboardEvent,
  ReactNode,
  RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Popover, type PopoverRootChangeEventDetails } from '@base-ui/react/popover'
import { Button } from '../button'
import { cn } from '../common'
import { PopupArrow, popupMotion, popupSurface } from '../common/popup'

/** One stop on a tour: the element it points at, and what it says about it. */
export interface TourStep {
  id: string
  /** The element to point at, looked up when the step is shown. Null, or nothing laid out, skips it. */
  anchor: () => Element | null
  /**
   * Whether the tour keeps the step as it opens, in place of its anchor being on screen then: for a
   * step whose control the application brings on screen as the tour moves to it. Its anchor is
   * still looked up when the step is shown, and skipped as any other if it is not there.
   */
  available?: () => boolean
  title: ReactNode
  body: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

/**
 * Why a tour ended: `done` from the last step's button, `skip` from Skip or Escape, `anchor-lost`
 * when no step it could still show is on screen.
 */
export type TourCloseReason = 'done' | 'skip' | 'anchor-lost'

export interface TourLabels {
  back: string
  next: string
  done: string
  skip: string
  /** "2 of 4": the step shown, counted among the steps the tour kept. */
  progress: (step: number, of: number) => string
}

export interface TourProps {
  open: boolean
  steps: ReadonlyArray<TourStep>
  /** The index in `steps` to show. */
  step: number
  onStepChange: (index: number) => void
  onClose: (reason: TourCloseReason) => void
  /** Its words, for another language. English by default. */
  labels?: Partial<TourLabels>
  /** Where focus goes when it closes. By default, back where it was when it opened. */
  finalFocus?: RefObject<HTMLElement | null> | (() => HTMLElement | null)
  /** Classes for the popup. */
  className?: string
}

const ENGLISH: TourLabels = {
  back: 'Back',
  next: 'Next',
  done: 'Done',
  skip: 'Skip',
  progress: (step, of) => `${step} of ${of}`,
}

/** On the page and laid out: not removed, and not hidden with `display: none`. */
const laidOut = (element: Element | null): element is Element =>
  element !== null && element.isConnected && element.getClientRects().length > 0

/** The element a step points at, if the tour kept it and it is laid out now. */
const anchorOf = (
  steps: ReadonlyArray<TourStep>,
  kept: ReadonlyArray<string>,
  index: number,
): Element | null => {
  const step = steps[index]
  if (!step || !kept.includes(step.id)) {
    return null
  }
  const element = step.anchor()
  return laidOut(element) ? element : null
}

/**
 * Whether moving to a step would show it: the tour kept it, and its anchor is on screen now or its
 * application brings it on screen as the tour moves to it (`available`).
 */
const showable = (
  steps: ReadonlyArray<TourStep>,
  kept: ReadonlyArray<string>,
  index: number,
): boolean => {
  const step = steps[index]
  if (!step || !kept.includes(step.id)) {
    return false
  }
  return anchorOf(steps, kept, index) !== null || step.available?.() === true
}

/** The nearest step from `from` in the direction `by` that moving to would show, if any. */
const nearest = (
  steps: ReadonlyArray<TourStep>,
  kept: ReadonlyArray<string>,
  from: number,
  by: 1 | -1,
): number | undefined => {
  for (let index = from + by; index >= 0 && index < steps.length; index += by) {
    if (showable(steps, kept, index)) {
      return index
    }
  }
  return undefined
}

/**
 * A guided walk through the controls on screen, one step at a time, each pointing at the control
 * it explains. Controlled: the application decides when it opens, holds the step, and hears why it
 * closed; it remembers nothing itself.
 *
 * Steps whose anchors are not on screen when it opens are left out (but a step `available` says
 * to keep, whose control the application brings on screen for it), and a step whose anchor has
 * gone since, before or while it shows, is skipped in the direction of travel. With nothing left
 * to show it closes as `anchor-lost`; the last step still on screen offers Done. Each step scrolls
 * its anchor into view and moves focus to Next or Done, and its title and text are said as it
 * changes.
 *
 * Its popup is a non-modal dialog: the page stays usable, and a press elsewhere or focus leaving
 * does not close it. Escape skips the rest wherever focus is. With focus in the tour it is taken
 * from the page, so a page's own Escape does not also act; with focus on the page, handlers on
 * the page's elements (React's included) see it first. The popup is marked `data-tip`, so a
 * page's keyboard handling can tell it apart from its own dialogs.
 */
export const Tour = ({
  open,
  steps,
  step,
  onStepChange,
  onClose,
  labels,
  finalFocus,
  className,
}: TourProps) => {
  // A label given as undefined keeps the English one rather than blanking its button.
  const words: TourLabels = {
    back: labels?.back ?? ENGLISH.back,
    next: labels?.next ?? ENGLISH.next,
    done: labels?.done ?? ENGLISH.done,
    skip: labels?.skip ?? ENGLISH.skip,
    progress: labels?.progress ?? ENGLISH.progress,
  }
  // The steps it offers: those on screen as it opened, by id.
  const [kept, setKept] = useState<ReadonlyArray<string> | null>(null)
  const [shown, setShown] = useState<{ index: number; anchor: Element } | null>(null)
  // Bumped when the shown step's anchor goes, to look the step up again.
  const [lost, setLost] = useState(0)
  // Whether its words are a polite live region: not as it opens, when focus moving into the
  // dialog says them, but for every step after.
  const [live, setLive] = useState(false)
  const last = useRef<{ index: number; anchor: Element } | null>(null)
  const primary = useRef<HTMLButtonElement>(null)
  // The latest callbacks, so a parent passing new ones each render does not look the step up again.
  const callbacks = useRef({ onClose, onStepChange })
  useLayoutEffect(() => {
    callbacks.current = { onClose, onStepChange }
  })

  useLayoutEffect(() => {
    if (!open) {
      setKept(null)
      setShown(null)
      last.current = null
      return
    }
    setKept(
      (current) =>
        current ??
        steps
          .filter((candidate) =>
            candidate.available ? candidate.available() : laidOut(candidate.anchor()),
          )
          .map(({ id }) => id),
    )
  }, [open, steps])

  useLayoutEffect(() => {
    if (!open || kept === null) {
      return
    }
    const anchor = anchorOf(steps, kept, step)
    if (!anchor) {
      // Gone: on to the next step that is still there, or back the way it came.
      const back = last.current !== null && step < last.current.index
      const indices = steps.map((_, index) => index)
      const after = indices.filter((index) => index > step)
      const before = indices.filter((index) => index < step).reverse()
      const order = back ? [...before, ...after] : after
      const next = order.find((index) => anchorOf(steps, kept, index) !== null)
      if (next === undefined) {
        callbacks.current.onClose('anchor-lost')
      } else {
        callbacks.current.onStepChange(next)
      }
      return
    }
    if (last.current?.index !== step || last.current.anchor !== anchor) {
      last.current = { index: step, anchor }
      anchor.scrollIntoView?.({ block: 'nearest' })
      setShown({ index: step, anchor })
    }
  }, [open, kept, step, steps, lost])

  useEffect(() => {
    if (shown) {
      primary.current?.focus()
    }
  }, [shown])

  /*
    The steps Next and Back go to, read as a step shows and each frame after, since the controls
    are the page's and go without the tour drawing again: a step whose control has gone is passed
    over, and with none ahead the last step on screen offers Done. The shown anchor is watched the
    same way: removed or hidden, the step is looked up again and skipped as gone.
  */
  const [ends, setEnds] = useState<{ next?: number; back?: number }>({})
  useLayoutEffect(() => {
    if (!shown || !kept) {
      setEnds({})
      return
    }
    const read = () => {
      const next = nearest(steps, kept, shown.index, 1)
      const back = nearest(steps, kept, shown.index, -1)
      setEnds((current) =>
        current.next === next && current.back === back ? current : { next, back },
      )
    }
    read()
    let frame = 0
    const watch = () => {
      if (!laidOut(shown.anchor)) {
        setLost((count) => count + 1)
        return
      }
      read()
      frame = requestAnimationFrame(watch)
    }
    frame = requestAnimationFrame(watch)
    return () => cancelAnimationFrame(frame)
  }, [shown, kept, steps])

  // Live from the frame after the first step shows, so the popup's arrival is not said twice.
  const showing = shown !== null
  useEffect(() => {
    if (!showing) {
      setLive(false)
      return
    }
    const frame = requestAnimationFrame(() => setLive(true))
    return () => cancelAnimationFrame(frame)
  }, [showing])

  const current = shown ? steps[shown.index] : undefined
  const at = shown && current && kept ? kept.indexOf(current.id) : -1
  const nextIndex = ends.next
  const backIndex = ends.back
  // Read again as a button is pressed, should a control have gone since the last frame.
  const goNext = () => {
    const index = shown && kept ? nearest(steps, kept, shown.index, 1) : undefined
    if (index === undefined) {
      onClose('done')
    } else {
      onStepChange(index)
    }
  }
  const goBack = () => {
    const index = shown && kept ? nearest(steps, kept, shown.index, -1) : undefined
    if (index !== undefined) {
      onStepChange(index)
    }
  }

  /**
   * Escape skips the rest, once. From inside the popup it reaches the tour twice: through Base
   * UI's listener on the document, and through the popup's own handler, which keeps it from the
   * page's React handlers. Whichever comes first acts and marks it handled; the other finds it so.
   * From the page it reaches only the document listener, after the page's own handlers.
   */
  const skip = (event: Event | KeyboardEvent) => {
    if (event.defaultPrevented) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    onClose('skip')
  }

  const onOpenChange = (next: boolean, details: PopoverRootChangeEventDetails) => {
    // A press outside or focus moving away leave it open.
    if (!next && details.reason === 'escape-key') {
      skip(details.event)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      skip(event)
    }
  }

  return (
    <Popover.Root
      open={open && shown !== null && current !== undefined}
      onOpenChange={onOpenChange}
    >
      <Popover.Portal>
        <Popover.Positioner
          className="z-50 outline-none"
          anchor={shown?.anchor}
          side={current?.side ?? 'bottom'}
          align={current?.align ?? 'center'}
          sideOffset={8}
          sticky
        >
          <Popover.Popup
            data-tip=""
            initialFocus={primary}
            finalFocus={typeof finalFocus === 'function' ? () => finalFocus() ?? true : finalFocus}
            onKeyDown={onKeyDown}
            className={cn(
              ...popupSurface,
              'w-72 max-w-[min(18rem,calc(100vw-2rem))] px-3 py-2.5 outline-none',
              ...popupMotion,
              'motion-reduce:transition-none',
              className,
            )}
          >
            <PopupArrow />
            {current ? (
              <>
                {/* Focus stays on Next as the step changes, so its words are said from here. */}
                <div aria-live={live ? 'polite' : 'off'} aria-atomic="true">
                  <Popover.Title className="text-sm font-semibold text-gray-700 dark:text-zinc-50">
                    {current.title}
                  </Popover.Title>
                  <Popover.Description render={<div />} className="mt-1">
                    {current.body}
                  </Popover.Description>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="mr-auto tabular-nums text-gray-500 dark:text-zinc-400">
                    {words.progress(at + 1, kept?.length ?? 0)}
                  </span>
                  <Button variant="muted" onClick={() => onClose('skip')}>
                    {words.skip}
                  </Button>
                  {backIndex !== undefined ? (
                    <Button variant="secondary" onClick={goBack}>
                      {words.back}
                    </Button>
                  ) : null}
                  {/* Green, as the kit's other going-on buttons are (Dialog's Confirm, a toast's
                      action): the brand orange reads as a warning beside a page's own actions. */}
                  <Button ref={primary} variant="success" onClick={goNext}>
                    {nextIndex === undefined ? words.done : words.next}
                  </Button>
                </div>
              </>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
