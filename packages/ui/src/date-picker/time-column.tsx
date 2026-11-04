import { Radio, RadioGroup } from '@base-ui/react'
import { useEffect, useId, useRef } from 'react'

/** One scrolling column of a time; arrow keys move the selection like any radio group. */
export const TimeColumn = ({
  label,
  values,
  value,
  onChange,
}: {
  label: string
  values: Array<string>
  value: string
  onChange: (value: string) => void
}) => {
  const labelId = useId()
  const content = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    content.current?.querySelector('[data-checked]')?.scrollIntoView({ block: 'nearest' })
  }, [value])
  return (
    <div className="flex min-w-12 flex-1 flex-col gap-1">
      <span id={labelId} className="text-center text-2xs text-gray-300 dark:text-zinc-400">
        {label}
      </span>
      <RadioGroup<string | null>
        ref={content}
        aria-labelledby={labelId}
        value={values.includes(value) ? value : null}
        onValueChange={(next) => {
          if (next) {
            onChange(next)
          }
        }}
        className="flex h-44 flex-col overflow-y-auto rounded p-0.5"
      >
        {values.map((item) => (
          <Radio.Root
            key={item}
            value={item}
            className="shrink-0 cursor-pointer rounded px-2 py-1 text-center text-xs text-gray outline-none hover:bg-gray-50 focus-visible:ring-1 focus-visible:ring-info/60 data-[checked]:bg-info/20 data-[checked]:font-semibold dark:text-zinc-100 dark:hover:bg-zinc-800 dark:data-[checked]:bg-info/25"
          >
            {item}
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  )
}
