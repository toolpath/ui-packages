import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** An element's content width and height in CSS pixels, kept as it is resized. */
export const useElementSize = <T extends HTMLElement>(): [
  RefObject<T | null>,
  { width: number; height: number },
] => {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((was) =>
        Math.abs(was.width - width) < 0.5 && Math.abs(was.height - height) < 0.5
          ? was
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}
