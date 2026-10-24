import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { buildPick } from './render/picking.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { regionEdgesGeometry } from './render/edges.js'
import { useTapGuard } from './tap.js'
import type { PartModel } from './model/types.js'
import {
  DoubleSide,
  Matrix3,
  Vector4,
  type BufferGeometry,
  type Group,
  type LineBasicMaterial,
  type MeshLambertMaterial,
  type Object3D,
} from 'three'
import { createExplodeBatch } from './render/explode.js'
import { explodeAmount } from './render/explode-geometry.js'
import type { ExplodeInput, ExplodePick } from './model/explode.js'
import { resolveExplodeTheme, type ExplodeTheme } from './render/explode-theme.js'
import type { ViewerTheme } from './render/theme.js'

export interface ExplodedPartProps {
  /** Source report geometry. All region indices must refer to this model. */
  model: PartModel
  geometry: BufferGeometry
  /** Controlled layout and appearance; application metadata stays outside the renderer. */
  explode: ExplodeInput
  /** Application-owned group IDs; independent of feature tags and API feature IDs. */
  selected?: string | ReadonlyArray<string> | null
  hovered?: string | ReadonlyArray<string> | null
  /** Part/edge colors, emissive, edge opacity, and selection/hover tints. */
  theme?: Partial<ViewerTheme>
  /** False hides rendering, picking, and framing while retaining prepared buffers. Default true. */
  visible?: boolean
  /** Programs and buffers have been warmed for this layout. Optional; no camera change occurs. */
  onReady?: () => void
  onPick?: (pick: ExplodePick) => void
  onHover?: (pick: ExplodePick | null) => void
}

const ignoreRay = () => {}

const Ghost = ({
  model,
  geometry,
  explode,
  appearance,
  visible = true,
}: Pick<ExplodedPartProps, 'model' | 'geometry' | 'explode' | 'visible'> & {
  appearance: ExplodeTheme
}) => {
  const material = useRef<MeshLambertMaterial>(null)
  const outline = useRef<LineBasicMaterial>(null)
  const edges = useMemo(() => regionEdgesGeometry(geometry, model), [geometry, model])
  useEffect(() => () => edges.dispose(), [edges])
  useFrame(() => {
    if (!visible) {
      return
    }
    const fade = Math.min(1, explodeAmount(explode.amount) / 0.18)
    if (material.current) {
      material.current.opacity = 1 - 0.88 * fade
      material.current.depthWrite = fade === 0
    }
    if (outline.current) {
      outline.current.opacity = ((0.7 - 0.46 * fade) * appearance.edgeOpacity) / 0.9
    }
  }, -1)
  return (
    <group visible={visible} userData={{ [EXCLUDE_FROM_FRAME]: !visible }}>
      <mesh geometry={geometry} raycast={ignoreRay}>
        <meshLambertMaterial
          ref={material}
          color={appearance.ghost}
          emissive={appearance.ghostEmissive}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={DoubleSide}
          forceSinglePass
        />
      </mesh>
      <lineSegments geometry={edges} raycast={ignoreRay}>
        <lineBasicMaterial
          ref={outline}
          color={appearance.ghostEdge}
          transparent
          opacity={(0.24 * appearance.edgeOpacity) / 0.9}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

const Pieces = ({
  model,
  geometry,
  explode,
  selected = null,
  hovered = null,
  visible = true,
  appearance,
  onReady,
  onPick,
  onHover,
}: ExplodedPartProps & { appearance: ExplodeTheme }) => {
  const { groups, colors, regionColors } = explode
  const invalidate = useThree((state) => state.invalidate)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const isTap = useTapGuard()
  const ready = useRef(onReady)
  useLayoutEffect(() => {
    ready.current = onReady
  }, [onReady])
  const root = useRef<Group>(null)
  const resources = useRef<ReturnType<typeof createExplodeBatch> | null>(null)
  useLayoutEffect(() => {
    const parent = root.current!
    const batch = createExplodeBatch(model, geometry, groups)
    resources.current = batch
    parent.add(batch.object)
    invalidate()
    return () => {
      resources.current = null
      parent.remove(batch.object)
      batch.dispose()
    }
  }, [geometry, groups, invalidate, model])
  useLayoutEffect(() => {
    resources.current?.setAppearance(colors, selected, hovered, appearance, regionColors)
    resources.current?.setAmount(explodeAmount(explode.amount))
    invalidate()
  }, [
    appearance,
    colors,
    explode,
    geometry,
    groups,
    hovered,
    invalidate,
    model,
    regionColors,
    selected,
  ])
  useEffect(() => {
    const batch = resources.current!
    // Warm programs and upload buffers before the animation clock starts. Unlike
    // compileAsync's internal polling, this can be cancelled before a part/Canvas
    // is disposed (including StrictMode effect replay). Nothing is drawn onscreen.
    const scheduled = setTimeout(() => {
      const scissor = gl.getScissor(new Vector4())
      const scissorTest = gl.getScissorTest()
      const parent = root.current!
      const parentVisible = parent.visible
      const visibility = new Map<Object3D, boolean>()
      batch.object.traverse((object) => {
        visibility.set(object, object.visible)
        object.visible = true
      })
      parent.visible = true
      try {
        // A zero-area scissor writes no pixels while using the exact onscreen
        // output/tone-mapping shader variants. A render target changes those.
        gl.setScissor(0, 0, 0, 0)
        gl.setScissorTest(true)
        gl.render(scene, camera)
      } finally {
        gl.setScissor(scissor)
        gl.setScissorTest(scissorTest)
        parent.visible = parentVisible
        for (const [object, visible] of visibility) {
          object.visible = visible
        }
        // Preparation may run after the demand canvas's last frame. Always draw
        // the restored scene, even when onReady leaves application state unchanged.
        invalidate()
      }
      ready.current?.()
    }, 0)
    return () => clearTimeout(scheduled)
  }, [camera, geometry, gl, groups, invalidate, model, scene])
  useFrame(() => {
    if (visible) {
      resources.current?.setAmount(explodeAmount(explode.amount))
    }
  }, -1)

  const pick = (event: ThreeEvent<PointerEvent | MouseEvent>): ExplodePick | null => {
    const amount = explodeAmount(explode.amount)
    if (amount <= 0.0001 || !event.face) {
      return null
    }
    const hit = resources.current?.hit(event.batchId, event.faceIndex ?? undefined)
    if (!hit) {
      return null
    }
    const region = model.regionIndex.regionForTriangle(hit.triangleIndex)
    if (region === null) {
      return null
    }
    const modelPoint = event.point.clone().applyMatrix4(event.object.matrixWorld.clone().invert())
    modelPoint.x -= hit.group.offset.x * amount
    modelPoint.y -= hit.group.offset.y * amount
    modelPoint.z -= hit.group.offset.z * amount
    const normal = event.face.normal
      .clone()
      .applyNormalMatrix(new Matrix3().getNormalMatrix(event.object.matrixWorld))
    const view = camera.position.clone().sub(event.point).normalize()
    const source = event.nativeEvent
    return {
      ...buildPick({
        model,
        region,
        triangleIndex: hit.triangleIndex,
        point: event.point.toArray(),
        normal: normal.toArray(),
        viewDirection: view,
        pointer: { clientX: source.clientX, clientY: source.clientY },
        modifiers: {
          alt: source.altKey,
          ctrl: source.ctrlKey,
          meta: source.metaKey,
          shift: source.shiftKey,
          secondary: source.button === 2,
        },
        doubled: event.nativeEvent.detail === 2,
      }),
      explodeGroupId: hit.group.id,
      modelPoint: modelPoint.toArray(),
    }
  }
  return (
    <group
      ref={root}
      name="exploded-part"
      visible={visible}
      userData={{ [EXCLUDE_FROM_FRAME]: !visible }}
      onPointerMove={
        visible && onHover
          ? (event) => {
              event.stopPropagation()
              onHover?.(pick(event))
            }
          : undefined
      }
      onPointerOut={visible && onHover ? () => onHover(null) : undefined}
      onClick={
        visible && onPick
          ? (event) => {
              event.stopPropagation()
              if (isTap(event.nativeEvent)) {
                const hit = pick(event)
                if (hit) {
                  onPick?.(hit)
                }
              }
            }
          : undefined
      }
    />
  )
}

/** GPU batching preserves each piece's pick map, source highlight, and connector. */
export const ExplodedPart = (props: ExplodedPartProps) => {
  const { part, partEmissive, edge, edgeOpacity, highlight, hover } = props.theme ?? {}
  // Inline theme objects must not repaint the batch when their colors are unchanged.
  const appearance = useMemo(
    () => resolveExplodeTheme({ part, partEmissive, edge, edgeOpacity, highlight, hover }),
    [part, partEmissive, edge, edgeOpacity, highlight, hover],
  )
  const invalidate = useThree((state) => state.invalidate)
  const amount = props.explode.amount
  useLayoutEffect(() => {
    if (typeof amount !== 'number') {
      const unsubscribe = amount.subscribe(invalidate)
      invalidate()
      return unsubscribe
    }
  }, [amount, invalidate])
  return props.explode.groups.length === 0 ? null : (
    <>
      <Ghost
        model={props.model}
        geometry={props.geometry}
        explode={props.explode}
        appearance={appearance}
        visible={props.visible}
      />
      <Pieces {...props} appearance={appearance} />
    </>
  )
}
