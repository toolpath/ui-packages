import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, Vector3 } from 'three'
import { Button } from '@toolpath/ui'
import { PartCollection, Viewer, useContentBox, type CollectionPick } from '@toolpath/viewer'
import { useFileMesh, usePartCollection } from '@toolpath/viewer/engine'

/** A file's mesh as the Engine writes it: node `body-<index>` per body, one buffer. */
const fileMesh = (bodies: Array<{ index: number; x: number }>): ArrayBuffer => {
  const parts = bodies.map(({ x }) => {
    const box = new BoxGeometry(25.4, 25.4, 25.4).translate(x, 0, 0)
    const points = Float32Array.from(box.getAttribute('position').array)
    const triangles = Uint32Array.from(box.index!.array)
    box.dispose()
    return { points, triangles }
  })
  let length = 0
  const bufferViews: Array<object> = []
  const accessors: Array<object> = []
  parts.forEach(({ points, triangles }, i) => {
    bufferViews.push(
      { buffer: 0, byteOffset: length, byteLength: points.byteLength },
      { buffer: 0, byteOffset: length + points.byteLength, byteLength: triangles.byteLength },
    )
    const axis = (n: number) => points.filter((_, at) => at % 3 === n)
    accessors.push(
      {
        bufferView: 2 * i,
        componentType: 5126,
        count: points.length / 3,
        type: 'VEC3',
        min: [0, 1, 2].map((n) => Math.min(...axis(n))),
        max: [0, 1, 2].map((n) => Math.max(...axis(n))),
      },
      { bufferView: 2 * i + 1, componentType: 5125, count: triangles.length, type: 'SCALAR' },
    )
    length += points.byteLength + triangles.byteLength
  })
  const json = new TextEncoder().encode(
    JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ byteLength: length }],
      bufferViews,
      accessors,
      meshes: parts.map((_, i) => ({
        primitives: [{ attributes: { POSITION: 2 * i }, indices: 2 * i + 1, mode: 4 }],
      })),
      nodes: bodies.map(({ index }, i) => ({ mesh: i, name: `body-${index}` })),
      scenes: [{ nodes: bodies.map((_, i) => i) }],
      scene: 0,
    }),
  )
  const pad = (n: number) => (n + 3) & ~3
  const glb = new Uint8Array(28 + pad(json.length) + pad(length))
  const view = new DataView(glb.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, glb.length, true)
  view.setUint32(12, pad(json.length), true)
  view.setUint32(16, 0x4e4f534a, true)
  glb.set(json, 20)
  glb.fill(0x20, 20 + json.length, 20 + pad(json.length))
  let offset = 20 + pad(json.length)
  view.setUint32(offset, pad(length), true)
  view.setUint32(offset + 4, 0x004e4942, true)
  offset += 8
  for (const { points, triangles } of parts) {
    glb.set(new Uint8Array(points.buffer), offset)
    glb.set(new Uint8Array(triangles.buffer), offset + points.byteLength)
    offset += points.byteLength + triangles.byteLength
  }
  return glb.buffer
}

// Body 1 is not in the mesh, as a body the Engine could not facet is not.
const GLB = fileMesh([
  { index: 0, x: -35 },
  { index: 2, x: 35 },
])
const fetches: Array<string> = []
Object.assign(window, { fileMeshFetches: fetches })
const serve = async (url: string) => {
  fetches.push(url)
  return new Response(GLB.slice(0))
}

const Probe = ({ report }: { report: (value: string) => void }) => {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const bounds = useContentBox()
  useFrame(() => {
    const toScreen = (x: number) => {
      const point = new Vector3(x, 0, 0).project(camera)
      return { x: ((point.x + 1) * size.width) / 2, y: ((1 - point.y) * size.height) / 2 }
    }
    report(
      JSON.stringify({
        width: Math.round(bounds.getSize(new Vector3()).x),
        centers: [toScreen(-35), toScreen(35)],
      }),
    )
  })
  return null
}

const Bodies = ({ url, onDisposed }: { url: string; onDisposed: () => void }) => {
  const file = useFileMesh(url, { fetch: serve })
  const models = useMemo(
    () =>
      [...(file.bodies?.values() ?? [])].map((body) => ({
        id: `body-${body.index}`,
        model: body.model,
        geometry: body.geometry,
      })),
    [file.bodies],
  )
  useEffect(() => {
    for (const { geometry } of models) {
      geometry.addEventListener('dispose', onDisposed)
    }
  }, [models, onDisposed])
  const collection = usePartCollection(models)
  const [scene, setScene] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const report = useCallback(
    (value: string) => setScene((old) => (old === value ? old : value)),
    [],
  )
  return (
    <>
      <div style={{ width: 800, height: 600 }}>
        <Viewer>
          {file.bodies && collection.items ? (
            <PartCollection
              items={collection.items}
              onPick={(event: CollectionPick) => setPick(event.id)}
            >
              <Probe report={report} />
            </PartCollection>
          ) : null}
        </Viewer>
      </div>
      <output data-testid="ids">{(collection.items ?? []).map((item) => item.id).join(' ')}</output>
      <output data-testid="scene">{scene}</output>
      <output data-testid="pick">{pick}</output>
    </>
  )
}

const App = () => {
  const [signature, setSignature] = useState(1)
  const [open, setOpen] = useState(true)
  const [disposed, setDisposed] = useState(0)
  const onDisposed = useCallback(() => setDisposed((count) => count + 1), [])
  return (
    <>
      <Button onClick={() => setSignature((value) => value + 1)}>Refresh URL</Button>
      <Button onClick={() => setOpen(false)}>Close</Button>
      {open ? (
        <Bodies
          url={`https://engine.test/files/f/bodies.glb?signature=${signature}`}
          onDisposed={onDisposed}
        />
      ) : null}
      <output data-testid="disposed">{disposed}</output>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
