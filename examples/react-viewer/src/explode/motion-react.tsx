import { useEffect, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { createExplosionMotion, type ExplosionMotion } from './motion'

export const useExplosionMotion = (initialAmount: number) => {
  const [motion] = useState(() => createExplosionMotion(initialAmount))
  const active = useSyncExternalStore(motion.subscribe, () => {
    const snapshot = motion.getSnapshot()
    return snapshot.amount > 0 || snapshot.mode !== 'idle'
  })
  return { motion, active }
}

/** Advance before surface transforms, keeping the demand-driven canvas alive while moving. */
export const MotionFrames = ({ motion }: { motion: ExplosionMotion }) => {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => motion.subscribe(invalidate), [motion, invalidate])
  useFrame(({ clock }) => {
    if (motion.advance(clock.elapsedTime * 1000)) {
      invalidate()
    }
  }, -2)
  return null
}
