import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
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
  const bounds = useContentBox()
  useFrame(() => {
    const centers = [-35, 35].map((x) => {
      const point = new Vector3(x, 0, 0).project(camera)
      return { x: ((point.x + 1) * size.width) / 2, y: ((1 - point.y) * size.height) / 2 }
    })
    report(JSON.stringify({ width: bounds.getSize(new Vector3()).x, centers }))
  })
  return null
}
const App = () => {
  const viewer = useRef<ViewerHandle>(null)
  const [overlap, setOverlap] = useState(false)
  const [pick, setPick] = useState<CollectionPick | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [scene, setScene] = useState('')
  const [cuts, setCuts] = useState<Record<string, number>>({})
  const geometry = useMemo(
    () => [
      cube.geometry.clone().translate(-35, 0, 0),
      cube.geometry.clone().translate(overlap ? -35 : 35, 0, overlap ? 10 : 0),
    ],
    [overlap],
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
        onSectionChange: (section: { enabled: boolean; constant?: number }) => {
          if (section.enabled)
            setCuts((old) => ({ ...old, [index === 0 ? 'left' : 'right']: section.constant ?? 0 }))
        },
      })),
    [geometry],
  )
  return (
    <>
      <Button onClick={() => viewer.current?.setView('top')}>Top</Button>
      <Button onClick={() => setOverlap(true)}>Overlap</Button>
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
            onPick={setPick}
            onHover={(id, value) => setHover(value ? id : null)}
          >
            <Probe report={report} />
          </PartCollection>
        </Viewer>
      </div>
      <output data-testid="pick">{JSON.stringify(pick)}</output>
      <output data-testid="hover">{hover}</output>
      <output data-testid="scene">{scene}</output>
      <output data-testid="cuts">{JSON.stringify(cuts)}</output>
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
