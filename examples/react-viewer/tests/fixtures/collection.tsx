import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Mesh, type ShaderMaterial } from 'three'
import { Button } from '@toolpath/ui'
import {
  PartCollection,
  Viewer,
  useContentBox,
  type CollectionPick,
  type ViewerHandle,
} from '@toolpath/viewer'
import { MODELS } from '../../src/models'
const cube = MODELS.find((part) => part.id === 'cube')!
const Probe = ({ report }: { report: (value: string) => void }) => {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const root = useThree((state) => state.scene)
  const bounds = useContentBox()
  useFrame(() => {
    // Section caps are the only shader materials that sample a mask.
    let caps = 0
    let ghosts = 0
    root.traverse((object) => {
      const material = (object as Mesh).material as ShaderMaterial | undefined
      if (material?.uniforms?.uMask) caps++
      // A part drawn see-through: its surface, not the edges or a section's passes.
      if (
        (object as Mesh).isMesh &&
        object.visible &&
        material?.transparent &&
        material.opacity < 1
      )
        ghosts++
    })
    const toScreen = (x: number, z: number) => {
      const point = new Vector3(x, 0, z).project(camera)
      return { x: ((point.x + 1) * size.width) / 2, y: ((1 - point.y) * size.height) / 2 }
    }
    const centers = [-35, 35].map((x) => toScreen(x, 0))
    // In the staggered layout: on the left body alone, and where the right one covers it.
    const alone = toScreen(-42, 12.7)
    const covered = toScreen(-28, 22.7)
    report(
      JSON.stringify({
        width: bounds.getSize(new Vector3()).x,
        centers,
        alone,
        covered,
        caps,
        ghosts,
      }),
    )
  })
  return null
}
const App = () => {
  const viewer = useRef<ViewerHandle>(null)
  const [layout, setLayout] = useState<'apart' | 'overlap' | 'stagger'>('apart')
  const [ghost, setGhost] = useState(false)
  const [pick, setPick] = useState<CollectionPick | null>(null)
  const [picks, setPicks] = useState<Array<string>>([])
  const [hover, setHover] = useState<string | null>(null)
  const [scene, setScene] = useState('')
  const [cuts, setCuts] = useState<Record<string, number>>({})
  const geometry = useMemo(
    () => [
      cube.geometry.clone().translate(-35, 0, 0),
      layout === 'apart'
        ? cube.geometry.clone().translate(35, 0, 0)
        : cube.geometry.clone().translate(layout === 'overlap' ? -35 : -22.3, 0, 10),
    ],
    [layout],
  )
  useEffect(() => () => geometry.forEach((item) => item.dispose()), [geometry])
  const report = useCallback(
    (value: string) => setScene((old) => (old === value ? old : value)),
    [],
  )
  const items = useMemo(
    () =>
      geometry.map((mesh, index) => ({
        id: index === 0 ? 'left' : 'right',
        model: cube.model,
        geometry: mesh,
        opacity: index === 1 && ghost ? 0.3 : 1,
        onSectionChange: (section: { enabled: boolean; constant?: number }) => {
          if (section.enabled)
            setCuts((old) => ({ ...old, [index === 0 ? 'left' : 'right']: section.constant ?? 0 }))
        },
      })),
    [geometry, ghost],
  )
  return (
    <>
      <Button onClick={() => viewer.current?.setView('top')}>Top</Button>
      <Button onClick={() => setLayout('overlap')}>Overlap</Button>
      <Button onClick={() => setLayout('stagger')}>Stagger</Button>
      <Button onClick={() => setGhost(true)}>Ghost</Button>
      <Button
        onClick={() =>
          viewer.current?.setSection({ enabled: true, normal: { x: 0, y: 0, z: 1 }, offset: 0.5 })
        }
      >
        Cut
      </Button>
      <div style={{ width: 800, height: 600 }}>
        <Viewer ref={viewer}>
          <PartCollection
            items={items}
            onPick={(event) => {
              setPick(event)
              setPicks((old) => [...old, event.id])
            }}
            onHover={(id, value) => setHover(value ? id : null)}
          >
            <Probe report={report} />
          </PartCollection>
        </Viewer>
      </div>
      <output data-testid="pick">{JSON.stringify(pick)}</output>
      <output data-testid="picks">{JSON.stringify(picks)}</output>
      <output data-testid="hover">{hover}</output>
      <output data-testid="scene">{scene}</output>
      <output data-testid="cuts">{JSON.stringify(cuts)}</output>
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
