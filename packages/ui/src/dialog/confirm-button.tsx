import React, { ReactNode } from 'react'
import { Button, ButtonProps } from '../button'
import { cn } from '../common'
import { useDialog } from './dialog-context'

export interface DialogConfirmProps extends Omit<ButtonProps, 'onClick'> {
  children: ReactNode
}

export const Confirm = ({ children, className, variant, ...props }: DialogConfirmProps) => {
  const { onConfirm, variant: contextVariant } = useDialog()

  return (
    <Button
      variant={variant ?? contextVariant}
      size="md"
      className={cn('w-full flex-1 sm:w-auto sm:flex-none font-medium', className)}
      onClick={onConfirm}
      data-testid="confirm-dialog-confirm-button"
      {...props}
    >
      {children}
    </Button>
  )
}
