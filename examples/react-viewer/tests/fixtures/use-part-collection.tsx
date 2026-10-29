import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import type { BufferGeometry, Mesh } from 'three'
import { PartCollection, Viewer, type PartModel } from '@toolpath/viewer'
import {
  normalizePartReport,
  usePartCollection,
  type LoadedCollectionItem,
} from '@toolpath/viewer/engine'

const report = await fetch('/collection-test-report.json').then(
  (response) => response.json() as Promise<Record<string, unknown>>,
)
const modelAt = (name: string): PartModel =>
  normalizePartReport({ ...report, meshGlbUrl: `/collection-test/${name}.glb`, meshStlUrl: null })
const left = modelAt('left')
const right = modelAt('right')
const analysis = modelAt('analysis')

/** Each mesh by the name of the file it was loaded from, and the names of those disposed. */
const meshes = new Map<BufferGeometry, string>()
const disposed: Array<string> = []
const nameOf = (item: LoadedCollectionItem) =>
  item.model.mesh.glbUrl?.split('/').pop()?.replace('.glb', '') ?? ''
// Named before the scene draws it, so the first frame that draws it reports it.
const name = (item: LoadedCollectionItem) => {
  if (!meshes.has(item.geometry)) {
    meshes.set(item.geometry, nameOf(item))
    item.geometry.addEventListener('dispose', () => disposed.push(nameOf(item)))
  }
}

/** The names of the meshes the scene draws. */
const Drawn = ({ report: write }: { report: (value: string) => void }) => {
  const scene = useThree((state) => state.scene)
  useFrame(() => {
    const names = new Set<string>()
    scene.traverse((object) => {
      const name = meshes.get((object as Mesh).geometry)
      if ((object as Mesh).isMesh && object.visible && name) {
        names.add(name)
      }
    })
    write([...names].sort().join(' '))
  })
  return null
}

const Scene = ({ analysed, onDrawn }: { analysed: boolean; onDrawn: (value: string) => void }) => {
  const models = useMemo(
    () => [
      { id: 'left', model: left },
      { id: 'right', model: analysed ? analysis : right },
    ],
    [analysed],
  )
  const bodies = usePartCollection(models)
  bodies.items?.forEach(name)
  return (
    <>
      <output data-testid="items">{bodies.items?.map(nameOf).join(' ') ?? 'loading'}</output>
      <output data-testid="waiting">{bodies.waiting.join(' ')}</output>
      <Viewer style={{ height: 400 }}>
        {bodies.items ? (
          <PartCollection items={bodies.items}>
            <Drawn report={onDrawn} />
          </PartCollection>
        ) : null}
      </Viewer>
    </>
  )
}

const App = () => {
  const [analysed, setAnalysed] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [drawn, setDrawn] = useState('')
  const [freed, setFreed] = useState('')
  useEffect(() => {
    const timer = setInterval(() => setFreed([...disposed].sort().join(' ')), 50)
    return () => clearInterval(timer)
  }, [])
  return (
    <>
      <button onClick={() => setAnalysed(true)}>Analyse</button>
      <button onClick={() => setMounted(false)}>Unmount</button>
      <output data-testid="drawn">{drawn}</output>
      <output data-testid="disposed">{freed}</output>
      {mounted ? (
        <Scene
          analysed={analysed}
          onDrawn={(value) => setDrawn((old) => (old === value ? old : value))}
        />
      ) : null}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
