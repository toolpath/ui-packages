import React, { HTMLAttributes, ReactNode, useContext } from 'react'
import { cn } from '../common'
import { DialogContext, DialogContextValue, DialogVariant } from './dialog-context'

export interface DialogRootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant: DialogVariant
}

export const Dialog = ({ children, variant, className, ...props }: DialogRootProps) => {
  const parentContext = useContext(DialogContext)

  const contextValue: DialogContextValue = {
    onConfirm: parentContext?.onConfirm ?? (() => {}),
    onDismiss: parentContext?.onDismiss ?? (() => {}),
    variant,
  }

  return (
    <DialogContext.Provider value={contextValue}>
      <div
        className={cn(
          'fixed left-1/2 top-[15vh] z-[1001] -translate-x-1/2',
          'flex w-[calc(100%-2rem)] max-w-sm flex-col rounded-xl bg-white shadow-xl outline-none',
          'dark:bg-zinc-900 dark:text-zinc-100 p-1.5',
          'transition-all duration-100',
          'data-[starting-style]:scale-50 data-[starting-style]:opacity-0',
          'data-[ending-style]:scale-50 data-[ending-style]:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </DialogContext.Provider>
  )
}
