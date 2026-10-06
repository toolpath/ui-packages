import { useState, type FC, type ReactElement } from 'react'
import { cn } from '@toolpath/ui'
import { MORE, SubjectOptions, showMore } from './options.js'
import { WORD } from './styles.js'

/**
 * The last row: an empty rule, to start one. Choosing its features makes the
 * rule — "Undercuts, any size" — and puts the cursor on its measure, to
 * narrow it or leave it flagging every one.
 */
export const NewRule: FC<{ onAdd: (subject: string) => void }> = ({ onAdd }): ReactElement => {
  const [all, setAll] = useState(false)
  return (
    <li className="flex items-start gap-1.5 py-1 pr-1.5">
      <span aria-hidden className="size-7 shrink-0" />
      <span
        aria-hidden
        className="mt-1.5 size-4 shrink-0 rounded-full border border-dashed border-gray-300 dark:border-zinc-600"
      />
      <p className="min-w-0 flex-1 text-sm leading-7">
        <select
          aria-label="New rule"
          className={cn(WORD, 'font-normal text-gray-400 dark:text-zinc-500')}
          value=""
          onChange={(event) => {
            if (event.target.value === MORE) showMore(event.currentTarget, setAll)
            else if (event.target.value) onAdd(event.target.value)
          }}
        >
          <option value="" disabled>
            + New Rule
          </option>
          <SubjectOptions current="any" all={all} />
        </select>
      </p>
    </li>
  )
}
