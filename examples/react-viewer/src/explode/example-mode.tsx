import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
import {
  createExplodeMotion,
  explodeFits,
  type ExplodeInput,
  type ViewerHandle,
} from '@toolpath/viewer'
import type { ExampleModel } from '../models'
import { colorGroups, makeGroups, type ColorBy } from './groups'

/** Example app policy: stable feature pieces with application-owned color. */
export const useExampleExplode = (
  part: ExampleModel,
  viewer: RefObject<ViewerHandle | null>,
  ready: boolean,
) => {
  // The package animates; the example decides when.
  const [motion] = useState(() => createExplodeMotion(0))
  const active = useSyncExternalStore(motion.subscribe, () => motion.getSnapshot().active)
  const preparing = useSyncExternalStore(motion.subscribe, () => motion.getSnapshot().preparing)
  const [enabled, setEnabled] = useState(false)
  const [colorBy, setColorBy] = useState<ColorBy>('feature')
  const groups = useMemo(() => makeGroups(part), [part])
  const renderable = groups.length > 0 && explodeFits(part.model, groups)
  // At stationary zero use the app's existing PartMesh, which `<ExplodedPart>` stands in for.
  const visible = renderable && active
  const input: ExplodeInput = useMemo(
    () => ({
      amount: renderable ? motion : 0,
      groups,
      colors: new Map(colorGroups(groups, colorBy).map((group) => [group.id, group.color])),
    }),
    [motion, colorBy, groups, renderable],
  )
  const resetAfterClose = useRef(false)
  const onAssembled = useCallback(() => {
    if (resetAfterClose.current) {
      resetAfterClose.current = false
      viewer.current?.reset()
    }
  }, [viewer])
  const setOpen = (next: boolean, immediate = false) => {
    resetAfterClose.current = false
    setEnabled(next)
    const target = next && renderable ? 1 : 0
    if (immediate) {
      motion.set(target)
    } else {
      motion.moveTo(target)
    }
  }
  return {
    ready: ready && !preparing,
    enabled,
    visible,
    colorBy,
    setColorBy,
    renderable,
    groups,
    input,
    motion,
    onAssembled,
    toggle: () => setOpen(!enabled),
    close: (immediate = false) => setOpen(false, immediate),
    reset: () => {
      // Reset measures the scene. Wait for the ordinary part to be visible, then let Reset
      // own both framing and the opening camera orientation.
      setOpen(false, true)
      resetAfterClose.current = visible
      if (!visible) {
        viewer.current?.reset()
      }
    },
    seek: (next: number) => {
      setEnabled(true)
      motion.set(next)
    },
  }
}

type ExampleExplode = ReturnType<typeof useExampleExplode>

/**
 * Says when the assembled part is shown again. Rendered inside `<Viewer>`, whose tree commits
 * after the page's, so the part has been shown by the time this runs.
 */
export const OnAssembled = ({
  assembled,
  onAssembled,
}: {
  assembled: boolean
  onAssembled: () => void
}) => {
  useLayoutEffect(() => {
    if (assembled) {
      onAssembled()
    }
  }, [assembled, onAssembled])
  return null
}

export const ExplodeOptions = ({ state }: { state: ExampleExplode }) => {
  // Scrubbing updates this compact control, not the viewer and the whole page.
  const { amount } = useSyncExternalStore(state.motion.subscribe, state.motion.getSnapshot)
  if (!state.enabled && !state.visible) {
    return null
  }
  return (
    <div className="viewer-tool-options explode-options" role="group" aria-label="Explode options">
      <span className="explode-color-label">Color by</span>
      <div className="explode-colors" role="group" aria-label="Color by">
        {(['feature', 'direction'] as const).map((colorBy) => (
          <button
            key={colorBy}
            type="button"
            aria-pressed={state.colorBy === colorBy}
            onClick={() => state.setColorBy(colorBy)}
          >
            {colorBy === 'feature' ? 'Feature' : 'Direction'}
          </button>
        ))}
      </div>
      {state.renderable ? (
        <>
          <label htmlFor="example-explode-amount">Explosion</label>
          <input
            id="example-explode-amount"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={amount}
            aria-label="Explosion amount"
            onChange={(event) => state.seek(event.currentTarget.valueAsNumber)}
          />
          <output htmlFor="example-explode-amount">{Math.round(amount * 100)}%</output>
        </>
      ) : (
        <span role="status">
          {state.groups.length === 0
            ? 'No feature surfaces are available to explode.'
            : 'This feature layout exceeds the rendering limit.'}
        </span>
      )}
    </div>
  )
}
