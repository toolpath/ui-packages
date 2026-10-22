import { Matrix4, ShapeGeometry, Vector3 } from 'three'
import { type Font, type FontData, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { CHAMFER, type CubeZone } from './view-cube.js'
import glyphs from './view-cube-glyphs.json'

/**
 * How far the name floats proud of its face, in cube units: the web quad's
 * offset, so it clears the face's polygon offset the same way.
 */
export const LIFT = 0.004

/** The share of a face's width its widest name, BOTTOM, spans — as on the web. */
const WIDEST = 0.78

let font: Font | null = null
let scale = 1

/**
 * The cube's font, parsed once, and the one scale every name is set at.
 *
 * One scale rather than one per name: a cube whose labels are set in six
 * sizes looks like a mistake, so the widest sets it for all of them.
 */
const viewCubeFont = (): { font: Font; scale: number } => {
  if (!font) {
    font = new FontLoader().parse(glyphs as unknown as FontData)
    const widest = new ShapeGeometry(font.generateShapes('BOTTOM', 1))
    widest.computeBoundingBox()
    const box = widest.boundingBox
    scale = box ? (WIDEST * 2 * CHAMFER) / Math.max(1e-6, box.max.x - box.min.x) : 1
    widest.dispose()
  }
  return { font, scale }
}

/**
 * A face's name as flat glyph geometry lying on the face, for a renderer with
 * no 2D canvas to draw a texture with: React Native's.
 *
 * Laid in the face's own basis — the same one `labelGeometry` maps the web
 * texture onto — so it reads the right way up for the camera pose a click on
 * that face chooses.
 */
export const glyphLabelGeometry = (zone: CubeZone): ShapeGeometry => {
  const { font: face, scale: size } = viewCubeFont()
  const shape = new ShapeGeometry(face.generateShapes(zone.name.toUpperCase(), 1))
  shape.center()
  shape.scale(size, size, 1)

  const [first, second, , fourth] = zone.polygon
  const normal = new Vector3(zone.direction.x, zone.direction.y, zone.direction.z)
  if (first && second && fourth) {
    const origin = new Vector3(first.x, first.y, first.z)
    const right = new Vector3(second.x, second.y, second.z).sub(origin).normalize()
    const up = new Vector3(fourth.x, fourth.y, fourth.z).sub(origin).normalize()
    // A face's polygon is centred on its outward normal at the cube's surface.
    const centre = normal.clone().multiplyScalar(1 + LIFT)
    shape.applyMatrix4(new Matrix4().makeBasis(right, up, normal).setPosition(centre))
  }
  return shape
}
