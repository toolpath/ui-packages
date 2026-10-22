import { StrictMode, useCallback, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  ExplodedPart,
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
  const [visible, setVisible] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [ready, setReady] = useState(false)
  const [warmups, setWarmups] = useState(0)
  const [selected, setSelected] = useState<ExplodePick | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [recolored, setRecolored] = useState(false)
  const [draws, setDraws] = useState(0)
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
  const input = useMemo(
    () => ({ amount, groups: empty ? [] : groups, colors }),
    [amount, colors, empty],
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
              visible={visible}
              selected={selected?.explodeGroupId}
              hovered={hovered}
              onReady={() => {
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
      <button onClick={() => setVisible((held) => !held)}>Toggle visibility</button>
      <button onClick={() => setRecolored((held) => !held)}>Recolor</button>
      <button onClick={() => setEmpty((held) => !held)}>Toggle empty</button>
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
