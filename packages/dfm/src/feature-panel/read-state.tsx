import { useEffect, useState, type FC, type ReactElement } from 'react'
import { Button } from '@toolpath/ui'
import type { Loadable } from './types.js'

/** A line saying what the panel is waiting on. */
export const Reading: FC<{ children: string }> = ({ children }): ReactElement => (
  <p className="text-sm text-gray-400 dark:text-zinc-400" role="status">
    {children}
  </p>
)

/**
 * What went wrong reading something, in the app's words, and a Retry that
 * waits as long as it was asked to before it can be pressed.
 */
export const ReadFailure: FC<{ failure: Extract<Loadable<unknown>, { status: 'error' }> }> = ({
  failure,
}): ReactElement => {
  const waiting = useWaiting(failure.retryAt)
  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <p className="text-danger" role="alert">
        {failure.message}
      </p>
      {failure.retry ? (
        <Button variant="secondary" size="sm" disabled={waiting} onClick={failure.retry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

/** Whether `until` (`Date.now()` ms) is still to come, turning false when it passes. */
const useWaiting = (until: number | undefined): boolean => {
  // The time last seen to pass: a new `until` waits afresh.
  const [passed, setPassed] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (until === undefined) return
    const timer = setTimeout(() => setPassed(until), Math.max(until - Date.now(), 0))
    return () => clearTimeout(timer)
  }, [until])
  return until !== undefined && passed !== until
}
