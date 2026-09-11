import React, { ReactNode } from 'react'
import { Button, ButtonProps } from '../button'
import { cn } from '../common'
import { useDialog } from './dialog-context'

export interface DialogDismissProps extends Omit<ButtonProps, 'onClick'> {
  children: ReactNode
}

export const Dismiss = ({
  children,
  className,
  variant = 'secondary',
  ...props
}: DialogDismissProps) => {
  const { onDismiss } = useDialog()

  return (
    <Button
      variant={variant}
      size="md"
      className={cn('w-full flex-1 sm:w-auto sm:flex-none font-medium', className)}
      onClick={onDismiss}
      {...props}
    >
      {children}
    </Button>
  )
}
