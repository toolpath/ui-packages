import React, {
  ReactElement,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { cn } from '../common'
import { DialogContext, DialogContextValue } from './dialog-context'

interface ProviderContextValue {
  confirm: (dialog: ReactElement) => Promise<boolean>
}

const ProviderContext = createContext<ProviderContextValue | null>(null)

export interface DialogProviderProps {
  children: ReactNode
}

export const Provider = ({ children }: DialogProviderProps) => {
  const [dialogElement, setDialogElement] = useState<ReactElement | null>(null)
  const [open, setOpen] = useState(false)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)
  const resolvedRef = useRef(false)

  const confirm = useCallback((element: ReactElement): Promise<boolean> => {
    return new Promise((resolve) => {
      resolvedRef.current = false
      resolveRef.current = resolve
      setDialogElement(element)
      setOpen(true)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (!resolvedRef.current) {
      resolvedRef.current = true
      resolveRef.current?.(true)
    }
    setOpen(false)
  }, [])

  const handleDismiss = useCallback(() => {
    if (!resolvedRef.current) {
      resolvedRef.current = true
      resolveRef.current?.(false)
    }
    setOpen(false)
  }, [])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        handleDismiss()
      }
    },
    [handleDismiss],
  )

  const dialogContextValue: DialogContextValue = {
    onConfirm: handleConfirm,
    onDismiss: handleDismiss,
    variant: 'danger',
  }

  return (
    <ProviderContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop
            className={cn(
              'fixed inset-0 z-[1000] bg-gray-900/70 dark:bg-black/50 backdrop-blur',
              'transition-opacity duration-200 ease-in-out',
              'data-[starting-style]:opacity-0',
              'data-[ending-style]:opacity-0',
            )}
          />
          <AlertDialog.Popup>
            <DialogContext.Provider value={dialogContextValue}>
              {dialogElement}
            </DialogContext.Provider>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ProviderContext.Provider>
  )
}

export const useDialog = (): ProviderContextValue => {
  const context = useContext(ProviderContext)

  if (!context) {
    throw new Error('useDialog must be used within a Dialog.Provider')
  }

  return context
}
