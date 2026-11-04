import { cn } from '../common'
import type { InputProps } from './input'

type FieldStyle = Pick<InputProps, 'variant' | 'size' | 'disabled' | 'invalid'>

/** The frame around a text field, shared by `Input` and the date pickers. */
export const inputFrameClassName = ({
  variant = 'default',
  size = 'lg',
  disabled = false,
  invalid = false,
  copyable = false,
}: FieldStyle & { copyable?: boolean }) =>
  cn(
    'relative flex w-full flex-nowrap items-stretch font-medium',
    { 'group/input': copyable },
    {
      'focus-within:ring-2 ring-info/50 dark:ring-info/75': !invalid,
      'text-gray-400 dark:text-zinc-100 border border-gray-200 bg-white focus-within:border-info dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-info':
        variant === 'secondary',
      'bg-gray-50 dark:bg-zinc-800': variant === 'default',
      'bg-gray-100 dark:bg-zinc-800': variant === 'muted',
      'bg-transparent': variant === 'ghost',
      'text-gray-500 dark:text-zinc-100':
        (variant === 'default' || variant === 'muted') && !disabled,
      'text-inherit': variant === 'ghost' && !disabled,
      'text-gray-200 dark:text-zinc-400': disabled,
      'h-6 rounded text-xs': size === 'md',
      'h-7 rounded-md text-sm': size === 'lg',
      'h-9 rounded-md text-lg': size === 'xl',
      'border border-[#FFD4E0] dark:border-danger/50 bg-[#FFD4E0]/25 dark:bg-danger/25 focus-within:border-[#FFD4E0] dark:focus-within:border-danger focus-within:ring-2 ring-[#FFD4E0] dark:ring-danger/50':
        invalid && !disabled,
    },
  )

/** The text element inside `inputFrameClassName`. */
export const inputTextClassName = ({
  variant = 'default',
  size = 'lg',
  disabled = false,
  type,
  textEnd = false,
  showSpinner = false,
}: Omit<FieldStyle, 'invalid'> & Pick<InputProps, 'type' | 'textEnd' | 'showSpinner'>) =>
  cn('w-px flex-1 grow bg-transparent leading-normal', 'outline-none', {
    'search-close-icon': type === 'search',
    'cursor-not-allowed select-none': disabled,
    'text-end': textEnd,
    'placeholder-gray-200 dark:placeholder-zinc-400': variant === 'secondary',
    'placeholder-gray-300 dark:placeholder-zinc-400':
      variant === 'default' || variant === 'muted' || variant === 'ghost',
    'px-1': size === 'md' && variant !== 'ghost',
    'pl-2 pr-1.5': size === 'lg' && variant !== 'ghost',
    'px-2': size === 'xl' && variant !== 'ghost',
    'px-0': variant === 'ghost',
    'appearance-none': type === 'number' && !showSpinner,
  })
