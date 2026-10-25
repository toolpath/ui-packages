/**
 * Deterministic stand-ins for the files an analysis produces. Each is a valid,
 * tiny file of its type, so a consumer that decodes one still works, and none
 * of them comes from real CAD.
 */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const glb = (): Uint8Array<ArrayBuffer> => {
  const json = new TextEncoder().encode(
    JSON.stringify({ asset: { version: '2.0', generator: '@toolpath/dev-config test kit' } }),
  )
  const padded = Math.ceil(json.length / 4) * 4
  const length = 12 + 8 + padded
  const bytes = new Uint8Array(length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, length, true)
  view.setUint32(12, padded, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.set(json, 20)
  bytes.fill(0x20, 20 + json.length)
  return bytes
}

export type ArtifactName = 'thumbnail.png' | 'mesh.stl' | 'mesh.glb'

export type ArtifactField = 'thumbnailUrl' | 'meshStlUrl' | 'meshGlbUrl'

export const ARTIFACTS: Readonly<
  Record<ArtifactName, { field: ArtifactField; contentType: string }>
> = {
  'thumbnail.png': { field: 'thumbnailUrl', contentType: 'image/png' },
  'mesh.stl': { field: 'meshStlUrl', contentType: 'model/stl' },
  'mesh.glb': { field: 'meshGlbUrl', contentType: 'model/gltf-binary' },
}

export const ARTIFACT_NAMES = Object.keys(ARTIFACTS) as Array<ArtifactName>

export const isArtifactName = (name: string): name is ArtifactName => Object.hasOwn(ARTIFACTS, name)

export const artifactBytes = (name: ArtifactName): Uint8Array<ArrayBuffer> => {
  switch (name) {
    case 'thumbnail.png':
      return Uint8Array.from(atob(PNG_1X1), (character) => character.charCodeAt(0))
    case 'mesh.stl':
      return new TextEncoder().encode('solid toolpath-test\nendsolid toolpath-test\n')
    case 'mesh.glb':
      return glb()
  }
}
