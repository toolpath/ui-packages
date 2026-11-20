import React, { HTMLAttributes, ReactNode, Ref } from 'react'
import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { cn } from '../common'
import { IconButton } from '../icon-button'

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success'

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Its tone: the border and icon colour, and the default role and icon. Defaults to `info`. */
  variant?: AlertVariant
  /** A bolder first line above the message. */
  title?: ReactNode
  children?: ReactNode
  /** Replaces the variant's icon; `null` shows none. */
  icon?: ReactNode
  /** The one thing to do about it, at the end of the line: a button or a link. */
  action?: ReactNode
  /** Shows an × that calls this. */
  onDismiss?: () => void
  /** The × button's accessible name. Defaults to "Dismiss". */
  dismissLabel?: string
  ref?: Ref<HTMLDivElement>
}

const ICON = 'mt-px size-4 shrink-0'

const ICONS: Record<AlertVariant, ReactNode> = {
  info: <InfoIcon weight="fill" aria-hidden className={cn(ICON, 'text-info dark:text-info')} />,
  warning: (
    // The yellow is too light to see on the light tint; the darker amber stands in for it there.
    <WarningIcon
      weight="fill"
      aria-hidden
      className={cn(ICON, 'text-warning-darken dark:text-warning')}
    />
  ),
  danger: (
    <WarningCircleIcon
      weight="fill"
      aria-hidden
      className={cn(ICON, 'text-danger dark:text-danger')}
    />
  ),
  success: (
    <CheckCircleIcon
      weight="fill"
      aria-hidden
      className={cn(ICON, 'text-success dark:text-success')}
    />
  ),
}

/**
 * A message inside the page: a tinted box with an icon, what it says, and the one thing to do about
 * it. The tone is carried by the border and the icon; the text stays neutral so it reads at full
 * contrast on every tint.
 *
 * Danger and warning are announced at once (`role="alert"`); info and success wait their turn
 * (`role="status"`). Pass `role` to change that, for an alert already on the page when it loads.
 * A `status` mounted with its text already in it may not be said at all: screen readers hear
 * changes to a live region, so keep the region on the page and change its text, or announce
 * the message another way.
 *
 * `onDismiss` takes the alert off the page with the button that had focus: the application then
 * owns where focus goes, to the control the message was about or the next thing on the page.
 */
export const Alert = ({
  variant = 'info',
  title,
  children,
  icon,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  ...props
}: AlertProps) => (
  <div
    role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
    data-variant={variant}
    {...props}
    className={cn(
      'flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs text-gray-600 dark:text-zinc-100',
      {
        'border-info/60 bg-info/10 dark:border-info/50 dark:bg-info/15': variant === 'info',
        'border-warning-darken/60 bg-warning/10 dark:border-warning/40 dark:bg-warning/15':
          variant === 'warning',
        'border-danger/40 bg-danger/10 dark:border-danger/50 dark:bg-danger/15':
          variant === 'danger',
        'border-success/50 bg-success/10 dark:border-success/50 dark:bg-success/15':
          variant === 'success',
      },
      className,
    )}
  >
    {icon === undefined ? ICONS[variant] : icon}
    <div className="min-w-0 flex-1">
      {title ? <div className="font-semibold text-gray-700 dark:text-zinc-50">{title}</div> : null}
      {children}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
    {onDismiss ? (
      <IconButton aria-label={dismissLabel} onClick={onDismiss} size="lg" className="shrink-0">
        <XIcon weight="bold" />
      </IconButton>
    ) : null}
  </div>
)
