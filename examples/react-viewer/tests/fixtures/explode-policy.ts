import { buildRegionIndex, directionColor, sameDirection } from '@toolpath/viewer'
import { Vector3 } from 'three'
import { MODELS } from '../../src/models'
import { partFromFiles } from '../../src/local-part'
import { colorGroups, makeGroups } from '../../src/explode/groups'
import { explodeStats, regionBounds } from '../../src/explode/geometry'

const sharp = MODELS.find((part) => part.id === 'sharp-pocket')!
const reading = sharp.model.features.find((feature) => feature.tag === 'pocket')!
// Report-shaped overlapping readings belong to this test, not the demo's model picker.
const pocket = {
  ...sharp,
  model: {
    ...sharp.model,
    features: [
      ...sharp.model.features.filter((feature) => feature !== reading),
      { ...reading, tag: 'pocket-top', machiningDirection: { x: 0, y: 0, z: 1 } },
      {
        ...reading,
        tag: 'pocket-tilted',
        machiningDirection: { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 },
      },
    ],
  },
}
const first = makeGroups(pocket)
const reversed = makeGroups({
  ...pocket,
  model: { ...pocket.model, features: [...pocket.model.features].reverse() },
})
const active = first.find((group) => group.featureTags.includes('pocket-top'))!
const chamfer = MODELS.find((part) => part.id === 'chamfer')!
const chamferGroups = makeGroups(chamfer)
const directionColors = colorGroups(chamferGroups, 'direction')
const featureColors = colorGroups(chamferGroups, 'feature')
const colorsByApproach = new Map<string, number>()
let consistentApproachColors = true
let candidatePalette = true
for (const group of directionColors) {
  const direction = new Vector3(group.offset.x, group.offset.y, group.offset.z).normalize()
  const key = direction
    .toArray()
    .map((n) => Number(n.toFixed(6)))
    .join(',')
  const held = colorsByApproach.get(key)
  consistentApproachColors &&= held === undefined || held === group.color
  colorsByApproach.set(key, group.color)
  const index = chamfer.model.candidateDirections.findIndex((way) => sameDirection(way, direction))
  candidatePalette &&= index < 0 || group.color === directionColor(index)
}
const shared = makeGroups(sharp)
const large = shared.find((group) => group.featureTags.includes('pocket'))!
const floor = shared.find((group) => group.id !== large.id && group.regionIdxs.includes(1))!
const brick = MODELS.find((part) => part.id === 'brick')!
const whole = regionBounds(
  brick.model,
  brick.geometry,
  brick.model.regions.map((region) => region.idx),
)
const innerWalls = makeGroups(brick)
  .filter((group) => group.featureTags.some((tag) => tag === 'face-7' || tag === 'face-9'))
  .map((group) => ({
    tags: group.featureTags,
    clearsPart: !whole.intersectsBox(
      regionBounds(brick.model, brick.geometry, group.regionIdxs).translate(
        new Vector3(group.offset.x, group.offset.y, group.offset.z),
      ),
    ),
  }))

const cube = MODELS.find((part) => part.id === 'cube')!
const regions = cube.model.regions.flatMap((region) =>
  Array.from({ length: region.triangles.end - region.triangles.start }, (_, offset) => ({
    ...region,
    idx: region.triangles.start + offset,
    area: region.area / (region.triangles.end - region.triangles.start),
    triangles: { start: region.triangles.start + offset, end: region.triangles.start + offset + 1 },
  })),
)
const features = Array.from({ length: 320 }, (_, index) => ({
  ...cube.model.features[0],
  tag: `reading-${index}`,
  machiningDirection: { x: 0, y: 0, z: 1 },
  regionIdxs: regions
    .filter((region) => ((index + 1) & (1 << region.idx)) !== 0)
    .map((region) => region.idx),
}))
const dense = {
  ...cube,
  model: {
    ...cube.model,
    regions,
    features,
    regionIndex: buildRegionIndex({
      regions,
      features,
      triangleCount: cube.model.mesh.triangleCount,
    }),
  },
}
const denseFeatures = makeGroups(dense)
const denseDirections = colorGroups(denseFeatures, 'direction')

// An opt-in test supplies its own local files through Playwright routes. Keep real
// CAD and snapshots outside this public repository and out of the built fixture.
const stressSample = async () => {
  if (!new URLSearchParams(location.search).has('stress')) {
    return null
  }
  const [analysis, mesh] = await Promise.all(
    ['/explode-stress-analysis.json', '/explode-stress-mesh.glb'].map(async (url) =>
      (await fetch(url)).blob(),
    ),
  )
  const part = await partFromFiles([
    new File([analysis], 'analysis.json'),
    new File([mesh], 'mesh.glb'),
  ])
  const sourcePosition = part.geometry.getAttribute('position')
  const positions = sourcePosition.array.slice()
  const bounds = regionBounds(
    part.model,
    part.geometry,
    part.model.regions.map((r) => r.idx),
  )
  const pieces = makeGroups(part)
  const layouts = (['feature', 'direction'] as const).map((colorBy) => {
    const groups = colorGroups(pieces, colorBy)
    return {
      colorBy,
      groups: groups.length,
      ...explodeStats(part.model, groups),
      allClear: groups.every(
        (group) =>
          !bounds.intersectsBox(
            regionBounds(part.model, part.geometry, group.regionIdxs).translate(
              new Vector3(group.offset.x, group.offset.y, group.offset.z),
            ),
          ),
      ),
      stable:
        JSON.stringify(groups) ===
        JSON.stringify(
          colorGroups(
            makeGroups({
              ...part,
              model: { ...part.model, features: [...part.model.features].reverse() },
            }),
            colorBy,
          ),
        ),
      featureIdentity: pieces.every((piece) =>
        piece.featureTags.every((tag) => {
          const regions = part.model.regionIndex.regionsForFeature(tag)
          return (
            regions.length === piece.regionIdxs.length &&
            piece.regionIdxs.every((region) => regions.includes(region))
          )
        }),
      ),
      samePieces: groups.every(
        (group, index) =>
          group.id === pieces[index].id &&
          group.regionIdxs === pieces[index].regionIdxs &&
          group.offset === pieces[index].offset,
      ),
    }
  })
  const unchanged =
    sourcePosition === part.geometry.getAttribute('position') &&
    positions.every((value, index) => value === sourcePosition.array[index])
  part.geometry.dispose()
  return {
    features: part.model.features.length,
    unchanged,
    layouts,
  }
}
const stress = await stressSample()
const output = document.createElement('pre')
output.dataset.testid = 'policy-results'
output.textContent = JSON.stringify({
  orderIndependent: JSON.stringify(first) === JSON.stringify(reversed),
  defaultChoice: active.activeFeatureTag,
  mergedReadings: active.featureTags,
  coloring: {
    samePieces: directionColors.every(
      (group, index) =>
        group.id === featureColors[index].id &&
        group.regionIdxs === featureColors[index].regionIdxs &&
        group.offset === featureColors[index].offset,
    ),
    changesColors: directionColors.some(
      (group, index) => group.color !== featureColors[index].color,
    ),
    consistentApproachColors,
    candidatePalette,
  },
  sharedFloor: { pocketOffset: large.offset, floorOffset: floor.offset },
  innerWalls,
  stress,
  dense: {
    featureGroups: denseFeatures.length,
    featureRenderable: explodeStats(dense.model, denseFeatures).renderable,
    directionGroups: denseDirections.length,
    directionRenderable: explodeStats(dense.model, denseDirections).renderable,
    overGroupBudget: explodeStats(
      dense.model,
      Array.from({ length: 513 }, (_, index) => denseFeatures[index % denseFeatures.length]),
    ).renderable,
  },
})
document.body.append(output)
