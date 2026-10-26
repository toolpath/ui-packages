import { useEffect, useState, useSyncExternalStore } from 'react'
import { createExplodeAmount, type ExplodeAmount } from '@toolpath/viewer'
import { createExplosionMotion, type ExplosionMotion } from './motion'

export const useExplosionMotion = (initialAmount: number) => {
  const [motion] = useState(() => createExplosionMotion(initialAmount))
  const active = useSyncExternalStore(motion.subscribe, () => {
    const snapshot = motion.getSnapshot()
    return snapshot.amount > 0 || snapshot.mode !== 'idle'
  })
  return { motion, active }
}

/** The example owns playback; the viewer controller requests canvas frames on change. */
export const useMotionAmount = (motion: ExplosionMotion): ExplodeAmount => {
  const [amount] = useState(() => createExplodeAmount(motion.amount))
  useEffect(() => {
    let frame: number | null = null
    const tick = (timestamp: number) => {
      frame = null
      const moving = motion.advance(timestamp)
      amount.set(motion.amount)
      if (moving && frame === null) {
        frame = requestAnimationFrame(tick)
      }
    }
    const sync = () => {
      amount.set(motion.amount)
      if (!document.hidden && motion.getSnapshot().mode !== 'idle' && frame === null) {
        frame = requestAnimationFrame(tick)
      }
    }
    const suspend = () => {
      motion.resetClock()
      if (frame !== null) {
        cancelAnimationFrame(frame)
        frame = null
      }
    }
    const visibilityChanged = () => {
      suspend()
      sync()
    }
    const unsubscribe = motion.subscribe(sync)
    document.addEventListener('visibilitychange', visibilityChanged)
    motion.resetClock()
    sync()
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', visibilityChanged)
      suspend()
    }
  }, [amount, motion])
  return amount
}
