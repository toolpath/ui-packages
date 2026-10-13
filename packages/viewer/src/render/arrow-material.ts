import { AlwaysDepth, Color, ShaderMaterial } from 'three'

/**
 * An arrow's surface: its own colour, shaded just enough to read as round.
 *
 * Matte, and soft: the side facing a key light above and to the left is the
 * direction's colour exactly, and the far side is a little darker, with no
 * highlight or rim. Lit in the camera's frame rather than by the scene's
 * lights, for the reason the viewer's light rig turns with the camera — an
 * arrow is shaded the same way from every side — and so that no theme's
 * lighting can move a direction away from the colour that names it.
 */

const VERTEX = /* glsl */ `
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;

varying vec3 vNormal;

// Above, to the left and toward the camera, in the camera's own frame.
const vec3 KEY = vec3(-0.4, 0.6, 0.7);

void main() {
  // Wrapped, and over a narrow range: a quarter darker at most, so the shape
  // shows without the colour going anywhere.
  float light = mix(0.75, 1.0, 0.5 + 0.5 * dot(normalize(vNormal), normalize(KEY)));
  gl_FragColor = vec4(uColor * light, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// A type rather than an interface: three's `uniforms` wants an index signature,
// which an object type alias carries implicitly and an interface does not.
type ArrowUniforms = {
  uColor: { value: Color }
  uOpacity: { value: number }
}

export type ArrowMaterial = ShaderMaterial & { uniforms: ArrowUniforms }

/**
 * An arrow's material, uncoloured until {@link applyArrowColor}.
 *
 * Always transparent, even when opaque: that keeps an arrow and its depth
 * passes in the same render list, so they draw in the order the arrow's render
 * order says.
 */
export function createArrowMaterial(): ArrowMaterial {
  const uniforms: ArrowUniforms = {
    uColor: { value: new Color() },
    uOpacity: { value: 1 },
  }

  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
  }) as ArrowMaterial
}

/**
 * An arrow's nearest surface, laid into the depth buffer before it is coloured.
 *
 * An arrow is translucent, and a translucent solid drawn in one pass shows
 * whatever of itself happened to draw first — seen from behind, the back of
 * the head through the shaft. With its own front laid down first, the
 * colour pass covers only that front, and the arrow reads as a solid with the
 * part faintly through it.
 *
 * The same shaders as the colour pass, so the depth both compute is the same
 * to the bit; only the colour write is off.
 */
export function createArrowDepthMaterial(): ArrowMaterial {
  const material = createArrowMaterial()
  material.colorWrite = false
  return material
}

/** Re-colours an arrow in place: a hover is a uniform, not a new program. */
export function applyArrowColor(material: ArrowMaterial, color: number, opacity: number): void {
  material.uniforms.uColor.value.set(color)
  material.uniforms.uOpacity.value = opacity
}

const RESET_VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // On the far plane, so what it leaves in the depth buffer is "nothing here".
  gl_Position.z = gl_Position.w;
}
`

const RESET_FRAGMENT = /* glsl */ `
void main() {
  gl_FragColor = vec4(0.0);
}
`

/**
 * Drawn first for an arrow that has to show through the part: clears the depth
 * under the arrow's own footprint, and nothing else.
 *
 * The arrow's depth and colour passes then draw with their depth test on.
 * Without one, a shaded arrow shows its far side through its near side — the
 * back of the head through the shaft, the handle's bead through its shaft —
 * which a flat colour hid and a shaded one does not. With one, the part is in
 * the way. Clearing the footprint first is what lets the arrow hide behind
 * itself and nothing else.
 */
export function createDepthResetMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: RESET_VERTEX,
    fragmentShader: RESET_FRAGMENT,
    transparent: true,
    colorWrite: false,
    depthFunc: AlwaysDepth,
  })
}
