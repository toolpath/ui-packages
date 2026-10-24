import { StrictMode, useCallback, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  ExplodedPart,
  createExplodeAmount,
  buildRegionIndex,
  type ExplodeGroup,
  type ExplodePick,
} from '@toolpath/viewer'
import { MODELS } from '../../src/models'

// A consumer with no feature interpretations: arbitrary IDs, repeated source
// surfaces, and translations unrelated to any candidate direction or plan schema.
const cube = MODELS.find((part) => part.id === 'cube')!
const region = cube.model.features.find((f) => f.machiningDirection.z === 1)!.regionIdxs[0]
const model = {
  ...cube.model,
  features: [],
  candidateDirections: [],
  regionIndex: buildRegionIndex({
    regions: cube.model.regions,
    features: [],
    triangleCount: cube.model.mesh.triangleCount,
  }),
}
const groups: ReadonlyArray<ExplodeGroup> = [
  { id: 'left-piece', regionIdxs: [region], offset: { x: -40, y: 0, z: 0 }, color: 0x34d399 },
  { id: 'right-piece', regionIdxs: [region], offset: { x: 40, y: 0, z: 0 }, color: 0xa78bfa },
]
let sourceDisposals = 0
cube.geometry.addEventListener('dispose', () => {
  sourceDisposals += 1
})

const Frames = ({ report }: { report: (calls: number) => void }) => {
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera)
    report(gl.info.render.calls)
  }, 1)
  return null
}

const App = () => {
  const [amount, setAmount] = useState(1)
  const [controller] = useState(() => createExplodeAmount(1))
  const [imperative, setImperative] = useState(false)
  const [regionPaint, setRegionPaint] = useState(false)
  const [visible, setVisible] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [ready, setReady] = useState(false)
  const [warmups, setWarmups] = useState(0)
  const [selected, setSelected] = useState<ExplodePick | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [recolored, setRecolored] = useState(false)
  const [light, setLight] = useState(false)
  const [draws, setDraws] = useState(0)
  const [layoutRevision, setLayoutRevision] = useState(0)
  const layout = useMemo(
    () => (layoutRevision > 0 ? groups.map((group) => ({ ...group })) : groups),
    [layoutRevision],
  )
  const report = useCallback(
    (calls: number) => setDraws((held) => (held === calls ? held : calls)),
    [],
  )
  const colors = useMemo(
    () =>
      recolored
        ? new Map([
            ['left-piece', 0x7dd3fc],
            ['right-piece', 0xf472b6],
          ])
        : undefined,
    [recolored],
  )
  const regionColors = useMemo(
    () =>
      regionPaint
        ? new Map([
            ['left-piece', new Map([[region, 0xff0000]])],
            ['right-piece', new Map([[region, 0x0000ff]])],
          ])
        : undefined,
    [regionPaint],
  )
  const input = useMemo(
    () => ({
      amount: imperative ? controller : amount,
      groups: empty ? [] : layout,
      colors,
      regionColors,
    }),
    [amount, colors, controller, empty, imperative, layout, regionColors],
  )
  return (
    <>
      <div style={{ width: 800, height: 600 }}>
        <Canvas
          orthographic
          camera={{ position: [0, 0, 150], up: [0, 1, 0], zoom: 3 }}
          frameloop="demand"
        >
          <ambientLight intensity={2} />
          <group position={[5, 7, 3]}>
            <ExplodedPart
              model={model}
              geometry={cube.geometry}
              explode={input}
              theme={
                light
                  ? {
                      part: 0xe2e8f0,
                      partEmissive: 0x111827,
                      edge: 0x334155,
                      edgeOpacity: 0.6,
                      highlight: 0x0284c7,
                      hover: 0xd97706,
                    }
                  : undefined
              }
              visible={visible}
              selected={selected?.explodeGroupId}
              hovered={hovered}
              onReady={() => {
                if (layoutRevision > 0) {
                  // No React update or app invalidation: the primitive must redraw after warming.
                  document.getElementById('warm-phase')!.textContent = 'prepared'
                  return
                }
                setReady(true)
                setWarmups((held) => held + 1)
              }}
              onPick={setSelected}
              onHover={(pick) => setHovered(pick?.explodeGroupId ?? null)}
            />
          </group>
          <Frames report={report} />
        </Canvas>
      </div>
      <label>
        Amount
        <input
          aria-label="Amount"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.valueAsNumber)}
        />
      </label>
      <button onClick={() => setImperative((held) => !held)}>Toggle controller</button>
      <button onClick={() => controller.set(0.5)}>Controller half</button>
      <button onClick={() => controller.set(1)}>Controller full</button>
      <button onClick={() => setRegionPaint((held) => !held)}>Region paint</button>
      <button onClick={() => setVisible((held) => !held)}>Toggle visibility</button>
      <button onClick={() => setRecolored((held) => !held)}>Recolor</button>
      <button onClick={() => setLight((held) => !held)}>Toggle theme</button>
      <button onClick={() => setEmpty((held) => !held)}>Toggle empty</button>
      <button onClick={() => setLayoutRevision((held) => held + 1)}>Replace layout</button>
      <output id="warm-phase">initial</output>
      <output data-testid="ready">{String(ready)}</output>
      <output data-testid="warmups">{warmups}</output>
      <output data-testid="draws">{draws}</output>
      <output data-testid="pick">{JSON.stringify(selected)}</output>
      <output data-testid="hover">{hovered ?? ''}</output>
      <output data-testid="source-disposals">{sourceDisposals}</output>
    </>
  )
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
