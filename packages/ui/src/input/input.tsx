import React, {
  ChangeEvent,
  ComponentType,
  FocusEvent,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SVGProps,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cn } from '../common'
import { IconButton } from '../icon-button'
import { CheckIcon, CopyIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Tooltip } from '../tooltip'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> & {
  name: string
  id: string
  size?: 'md' | 'lg' | 'xl'
  variant?: 'default' | 'secondary' | 'muted' | 'ghost'
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  iconPosition?: 'left' | 'right'
  prefix?: ReactNode
  suffix?: ReactNode
  textEnd?: boolean
  invalid?: boolean
  showSpinner?: boolean
  copyable?: boolean
  onCopyError?: () => void
  onValueChange?: (value: string | null) => void
  ref?: Ref<HTMLInputElement>
}

export const Input = ({
  type = 'text',
  name,
  id,
  value,
  className,
  disabled = false,
  variant = 'default',
  icon: IconComponent,
  iconPosition = 'left',
  suffix,
  prefix,
  size = 'lg',
  textEnd = false,
  invalid = false,
  showSpinner = false,
  copyable = false,
  onCopyError,
  onValueChange,
  ref,
  ...props
}: InputProps) => {
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const copyToClipboard = () =>
    navigator.clipboard.writeText(typeof value === 'string' ? value : String(value ?? ''))

  const scheduleCopiedReset = () => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const handleCopy = async () => {
    try {
      await copyToClipboard()
      setCopied(true)
      scheduleCopiedReset()
    } catch {
      onCopyError?.()
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    if (type === 'number') {
      if (value === '') {
        onValueChange?.(null)
        return
      }

      if (isNaN(Number(value))) {
        return
      }
    }

    onValueChange?.(value)
    props?.onChange?.(event)
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const { min, max } = props
    const value = event.target.value
    if (min && Number(value) < Number(min)) {
      onValueChange?.(String(min))
    }

    if (max && Number(value) > Number(max)) {
      onValueChange?.(String(max))
    }

    props?.onBlur?.(event)
  }

  const iconClassName = cn(
    'self-center',
    {
      'text-gray-400 dark:text-zinc-400':
        (variant === 'muted' || variant === 'default') && !disabled,
      'text-gray-200 dark:text-zinc-400': variant === 'secondary' || disabled,
    },
    iconPosition === 'left'
      ? {
          'ml-1 w-3': size === 'md',
          '-mr-1 ml-1.5 w-4': size === 'lg',
          '-mr-1 ml-2 w-5': size === 'xl',
        }
      : {
          'mr-1 w-3': size === 'md',
          '-ml-1 mr-1.5 w-4': size === 'lg',
          '-ml-1 mr-2 w-5': size === 'xl',
        },
  )

  const iconElement =
    type === 'search' && !IconComponent ? (
      <MagnifyingGlassIcon weight="bold" data-icon className={iconClassName} />
    ) : IconComponent ? (
      <IconComponent data-icon className={iconClassName} />
    ) : null

  let placeholder = props.placeholder
  if (!props.placeholder && type === 'search') {
    placeholder = 'Search'
  }

  const numberInputProps: InputHTMLAttributes<HTMLInputElement> & {
    'data-lpignore': boolean
  } = {
    inputMode: 'numeric' as const,
    step: 'any',
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    'data-lpignore': true,
    'aria-roledescription': 'Number field',
  }

  return (
    <div
      className={cn(
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
        className,
      )}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
    >
      {prefix && (
        <div
          data-prefix
          className={cn('flex items-center text-white font-medium', {
            'bg-gray-200': variant === 'secondary' || variant === 'muted',
            'dark:bg-zinc-800': variant === 'secondary',
            'dark:bg-zinc-700/50': variant === 'muted',
            'bg-gray-100 dark:bg-zinc-800/50': variant === 'default',
            'bg-[#FFD4E0]': invalid && !disabled,
            'rounded-l-sm px-1.5 text-xs': size === 'md',
            'rounded-l px-1.5 text-sm': size === 'lg',
            'rounded-l px-2': size === 'xl',
          })}
        >
          {prefix}
        </div>
      )}
      {iconPosition === 'left' && iconElement}
      <input
        ref={ref}
        type={type}
        data-testid={id}
        data-input
        data-1p-ignore
        id={id}
        placeholder={placeholder}
        name={name}
        value={value}
        autoComplete="off"
        className={cn('w-px flex-1 grow bg-transparent leading-normal', 'outline-none', {
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
        })}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        {...(type === 'number' ? numberInputProps : {})}
        {...props}
      />
      {iconPosition === 'right' && iconElement}
      {copyable && (
        <div className="flex items-center">
          <Tooltip tip="Copy to clipboard" disabled={!value}>
            <IconButton
              size="sm"
              variant="muted"
              aria-label="Copy to clipboard"
              onClick={handleCopy}
              className={cn(
                'transition-opacity group-hover/input:opacity-100 focus:opacity-100',
                value ? 'opacity-0' : 'invisible',
              )}
            >
              {copied ? <CheckIcon weight="bold" /> : <CopyIcon />}
            </IconButton>
          </Tooltip>
        </div>
      )}
      {suffix && (
        <div
          data-suffix
          className={cn('flex items-center text-white font-medium', {
            'bg-gray-200': variant === 'secondary' || variant === 'muted',
            'dark:bg-zinc-800': variant === 'secondary',
            'dark:bg-zinc-700/50': variant === 'muted',
            'bg-gray-100 dark:bg-zinc-800/50': variant === 'default',
            'bg-[#FFD4E0]': invalid && !disabled,
            'rounded-r-sm px-1.5 text-xs': size === 'md',
            'rounded-r px-1.5': size === 'lg',
            'rounded-r px-2': size === 'xl',
          })}
        >
          {suffix}
        </div>
      )}
    </div>
  )
}
