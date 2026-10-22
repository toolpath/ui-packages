import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { EXCLUDE_FROM_FRAME, type ViewerHandle } from '@toolpath/viewer'
import type { Group, Object3D } from 'three'
import type { ExampleModel } from '../models'
import { explodeStats } from './geometry'
import { colorGroups, makeGroups, type ColorBy } from './groups'
import { useExplosionMotion } from './motion-react'
import type { ExplodeInput } from '@toolpath/viewer'

/** Example app policy: stable feature pieces with application-owned selection and color. */
export const useExampleExplode = (
  part: ExampleModel,
  viewer: RefObject<ViewerHandle | null>,
  ready: boolean,
) => {
  const { motion, active } = useExplosionMotion(0)
  const [preparedFor, setPreparedFor] = useState<ExampleModel | null>(null)
  const onPrepared = useCallback(() => setPreparedFor(part), [part])
  const [enabled, setEnabled] = useState(false)
  const [colorBy, setColorBy] = useState<ColorBy>('feature')
  const [selected, select] = useState<string | null>(null)
  const [hovered, hover] = useState<string | null>(null)
  const groups = useMemo(() => makeGroups(part), [part])
  const stats = useMemo(() => explodeStats(part.model, groups), [part.model, groups])
  const renderable = stats.renderable && groups.length > 0
  // At stationary zero use the app's existing PartMesh. A second assembled part would
  // replace the region attribute on geometry that the normal renderer already owns.
  const visible = renderable && active
  const input: ExplodeInput = useMemo(
    () => ({
      get amount() {
        return renderable ? motion.amount : 0
      },
      groups,
      colors: new Map(colorGroups(groups, colorBy).map((group) => [group.id, group.color])),
    }),
    [colorBy, groups, motion, renderable],
  )
  const resetAfterClose = useRef(false)
  const clear = () => {
    select(null)
    hover(null)
  }
  const setOpen = (next: boolean, immediate = false) => {
    resetAfterClose.current = false
    setEnabled(next)
    clear()
    motion.moveTo(
      next && renderable ? 1 : 0,
      immediate || matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
  }
  const onAssembled = useCallback(() => {
    if (resetAfterClose.current) {
      viewer.current?.reset()
    }
  }, [viewer])
  return {
    ready: ready && (!renderable || preparedFor === part),
    onPrepared,
    enabled,
    visible,
    colorBy,
    setColorBy,
    renderable,
    groups,
    input,
    motion,
    selected,
    hovered,
    select,
    hover,
    toggle: () => setOpen(!enabled),
    close: (immediate = false) => setOpen(false, immediate),
    reset: () => {
      // Reset measures the scene. Wait for the ordinary part to be visible,
      // then let Reset own both framing and the opening camera orientation.
      setOpen(false, true)
      resetAfterClose.current = visible
      if (!visible) {
        viewer.current?.reset()
      }
    },
    onAssembled,
    seek: (next: number) => {
      setEnabled(true)
      motion.seek(next)
    },
  }
}

type ExampleExplode = ReturnType<typeof useExampleExplode>

export const ExplodeButton = ({
  state,
  onClick,
}: {
  state: ExampleExplode
  onClick: () => void
}) => {
  const label = state.enabled ? 'Collapse features' : 'Explode'
  return (
    <button
      type="button"
      className="viewer-toolbar-button"
      data-viewer-toolbar-action="explode"
      aria-label={label}
      aria-pressed={state.enabled}
      disabled={!state.ready}
      onClick={onClick}
    >
      <svg
        className="viewer-toolbar-icon"
        data-viewer-toolbar-icon="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="m12 5 1.6 3.1L17 7l-1.1 3.4L19 12l-3.1 1.6L17 17l-3.4-1.1L12 19l-1.6-3.1L7 17l1.1-3.4L5 12l3.1-1.6L7 7l3.4 1.1Z" />
        <path d="M12 1.5V3m0 18v1.5M1.5 12H3m18 0h1.5" />
      </svg>
      <span className="viewer-toolbar-tooltip" data-viewer-toolbar-tooltip="true" role="tooltip">
        {label}
      </span>
    </button>
  )
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

/** Keep PartMesh mounted so its normal selection/tools survive an explode round trip.
 * Three's raycaster ignores ancestor visibility, so hidden objects also leave its layers. */
export const PartVisibility = ({
  visible,
  children,
  onVisible,
}: {
  visible: boolean
  children: ReactNode
  onVisible: () => void
}) => {
  const root = useRef<Group>(null)
  useLayoutEffect(() => {
    if (visible) {
      onVisible()
      return
    }
    if (!root.current) {
      return
    }
    const masks = new Map<Object3D, number>()
    root.current.traverse((object) => {
      masks.set(object, object.layers.mask)
      object.layers.mask = 0
    })
    return () => {
      for (const [object, mask] of masks) {
        object.layers.mask = mask
      }
    }
  }, [onVisible, visible])
  return (
    <group ref={root} visible={visible} userData={{ [EXCLUDE_FROM_FRAME]: !visible }}>
      {children}
    </group>
  )
}
