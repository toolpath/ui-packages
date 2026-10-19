import type { KeyboardEvent } from 'react'

/**
 * Arrow keys through a list, for every list on the page: the rules, a rule's
 * features, a face's candidate features, the colour swatches.
 *
 * A list's rows are the elements marked `data-list-item` with the list's
 * name, found afresh on each key in the order they are drawn, so rows that
 * are shut or not mounted are passed over. Up and down (left and right, for
 * a row of swatches) move one row, Home and End to either end. A row marked
 * `data-follow` is chosen as it is reached, as a click would — for rows
 * whose choosing only highlights, so walking the list shows each in turn.
 * From outside the rows (a panel's header, its buttons), the first key goes
 * to the chosen row (`aria-pressed`) — or on from it, for a followed row,
 * which is already showing — else to the end it points toward.
 *
 * Keys typed into a field are the field's: a select's own arrows, a number
 * being edited.
 */
export const listKeys =
  (name: string, orientation: 'vertical' | 'horizontal' = 'vertical') =>
  (event: KeyboardEvent<HTMLElement>): void => {
    const [back, forward] =
      orientation === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
    if (![back, forward, 'Home', 'End'].includes(event.key) || isField(event.target)) return
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(`[data-list-item="${name}"]`),
    ]
    if (items.length === 0) return
    const at = currentIndex(items, document.activeElement)
    const chosen = items.findIndex((item) => item.getAttribute('aria-pressed') === 'true')
    const step = (from: number): number =>
      Math.min(Math.max(from + (event.key === forward ? 1 : -1), 0), items.length - 1)
    /*
     * From outside the rows, the first key goes to the chosen row, or to the
     * end it points toward. A followed row is already shown, so landing on it
     * would do nothing to see: the key steps on from it, as a row would.
     */
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : at !== -1
            ? step(at)
            : chosen !== -1
              ? items[chosen]?.dataset.follow !== undefined
                ? step(chosen)
                : chosen
              : event.key === forward
                ? 0
                : items.length - 1
    const target = items[index]
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    if (target === document.activeElement) return
    target.focus()
    if (target.dataset.follow !== undefined) target.click()
  }

/**
 * The row focus is on, or in: a row's own edit or remove button shares its
 * list item, so the arrows still move from that row. -1 from anywhere else.
 */
const currentIndex = (items: readonly HTMLElement[], active: Element | null): number => {
  if (!active) return -1
  const exact = items.indexOf(active as HTMLElement)
  if (exact !== -1) return exact
  const row = active.closest('li')
  return row ? items.findIndex((item) => item.closest('li') === row) : -1
}

/** A control that uses the arrow keys itself. A colour well does not. */
export const isField = (target: EventTarget | null): boolean =>
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && target.type !== 'color' && target.type !== 'button') ||
  (target instanceof HTMLElement && target.isContentEditable)
