import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { CheckIcon } from '@phosphor-icons/react'
import { Menu, cn } from '@toolpath/ui'
import { WORD } from './styles.js'

/** One thing a picker offers: the value it sets, and the words it shows. */
interface Choice {
  value: string
  label: string
}

/** Choices under a heading of their own, or under none: a picker's first group has none. */
export interface ChoiceGroup {
  heading?: string
  choices: readonly Choice[]
}

/** What a picker offers: its groups, and — for a short list — the last item, which lists the rest. */
export interface Choices {
  groups: readonly ChoiceGroup[]
  more?: string
}

interface PickerProps {
  /** What the word is, for a screen reader: "Measure". */
  label: string
  value: string
  choices: Choices
  onChange: (value: string) => void
  /** Asked for the rest of a short list: it lists them in place, the menu still open. */
  onMore?: () => void
  /** What the word says when no choice is its value, as on a new rule. */
  placeholder?: string
  title?: string
  className?: string
  autoFocus?: boolean
}

const HEADING =
  'px-2 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-gray-300 uppercase font-body dark:text-zinc-500'

/**
 * A word of a rule that changes: the word itself, underlined, and the kit's
 * menu of what it can be, the one it is ticked and highlighted as it opens.
 * The menu is the keyboard's while it is open — arrows, Home and End, Enter,
 * a letter to jump — and Escape shuts it; none of those keys, nor a click in
 * it, reaches the row or the list around it through the portal it is drawn in.
 */
export const Picker: FC<PickerProps> = ({
  label,
  value,
  choices,
  onChange,
  onMore,
  placeholder,
  title,
  className,
  autoFocus,
}): ReactElement => {
  const id = useId()
  /*
   * The item the keyboard is held on until the user acts in the menu: the value's as it opens,
   * or the first of the rest once they are asked for. The menu puts the keyboard on its first
   * item as it opens, a frame or two after drawing; a focus it moves while one is held is put
   * back. A key or the pointer in the menu lets go.
   */
  const held = useRef<Held | null>(null)
  const [holding, setHolding] = useState(0)
  const hold = (next: Held | null): void => {
    held.current = next
    if (next) setHolding((count) => count + 1)
  }
  const flat = choices.groups.flatMap((group) => group.choices)
  const at = flat.findIndex((choice) => choice.value === value)
  const shown = flat[at]?.label ?? placeholder ?? value
  const starts = choices.groups.map((_, g) =>
    choices.groups.slice(0, g).reduce((count, group) => count + group.choices.length, 0),
  )

  // Once the menu has drawn what is held — the items just listed, for one — the keyboard goes to it.
  useEffect(() => {
    if (holding === 0) return
    const frame = requestAnimationFrame(() => focusHeld(id, held.current))
    return () => cancelAnimationFrame(frame)
  }, [holding, id])

  return (
    // A click on the word, in its menu or on the menu's backdrop is the picker's: React would carry
    // it up through the portal to the row, which opens on a click.
    <span onClick={(event) => event.stopPropagation()}>
      <Menu onOpenChange={(open) => hold(open && at !== -1 ? { index: at, reveal: false } : null)}>
        <Menu.Trigger
          nativeButton
          render={
            <button
              type="button"
              aria-label={at === -1 ? label : `${label}: ${shown}`}
              title={title}
              className={cn(
                WORD,
                'data-[popup-open]:bg-gray-100 dark:data-[popup-open]:bg-zinc-700',
                className,
              )}
              autoFocus={autoFocus}
            />
          }
        >
          {shown}
        </Menu.Trigger>
        <Menu.Popover
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="max-h-[min(24rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto py-1 shadow-lg"
          onFocus={(event) => {
            const item = held.current && document.getElementById(itemId(id, held.current.index))
            if (item && event.target !== item) focusHeld(id, held.current)
          }}
          onPointerMove={() => hold(null)}
          // Before the item's own handler, which may be the one asking for the rest.
          onKeyDownCapture={() => hold(null)}
          onKeyDown={keepKeys}
        >
          {choices.groups.map((group, g) => (
            <Fragment key={group.heading ?? g}>
              {g > 0 ? <Menu.Divider className="my-1" /> : null}
              <div
                role="group"
                aria-labelledby={group.heading ? `${id}-group-${g}` : undefined}
                className="flex flex-col"
              >
                {group.heading ? (
                  <div id={`${id}-group-${g}`} className={HEADING}>
                    {group.heading}
                  </div>
                ) : null}
                {group.choices.map((choice, c) => {
                  const chosen = choice.value === value
                  return (
                    <Menu.Item
                      key={choice.value}
                      id={itemId(id, (starts[g] ?? 0) + c)}
                      label={choice.label}
                      onClick={() => {
                        if (!chosen) onChange(choice.value)
                      }}
                      className="gap-3"
                    >
                      <span className="flex-1">{choice.label}</span>
                      <CheckIcon
                        aria-hidden
                        weight="bold"
                        className={cn(
                          'size-3.5 text-gray-400 dark:text-zinc-300',
                          !chosen && 'invisible',
                        )}
                      />
                    </Menu.Item>
                  )
                })}
              </div>
            </Fragment>
          ))}
          {choices.more && onMore ? (
            <Menu.Item
              closeOnClick={false}
              onClick={() => {
                hold({ index: flat.length, reveal: true })
                onMore()
              }}
              className="text-gray-400 dark:text-zinc-400"
            >
              {choices.more}
            </Menu.Item>
          ) : null}
        </Menu.Popover>
      </Menu>
    </span>
  )
}

/** An item to hold the keyboard on, by its place; `reveal` scrolls its heading to the menu's top. */
interface Held {
  index: number
  reveal: boolean
}

const focusHeld = (picker: string, held: Held | null): void => {
  const item = held && document.getElementById(itemId(picker, held.index))
  if (!item) return
  item.focus({ preventScroll: held.reveal })
  const menu = item.closest('[role="menu"]')
  const group = item.closest('[role="group"]')
  if (held.reveal && menu && group)
    menu.scrollTop += group.getBoundingClientRect().top - menu.getBoundingClientRect().top - 8
}

/** A picker's items by their place in it, so the keyboard can be put on one once it is drawn. */
const itemId = (picker: string, index: number): string => `${picker}-${index}`

/**
 * A key pressed in the open menu is the menu's, as one in a native select's
 * list was: React carries it up its own tree, through the portal, to the row
 * and the list's arrow keys, so it stops here. Tab goes on: the menu's focus
 * handling listens for it on the document.
 */
const keepKeys = (event: KeyboardEvent): void => {
  if (event.key !== 'Tab') event.stopPropagation()
}
