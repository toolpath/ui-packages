import {
  AlwaysStencilFunc,
  BackSide,
  Color,
  DecrementWrapStencilOp,
  DoubleSide,
  FrontSide,
  IncrementWrapStencilOp,
  LinearFilter,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  type Plane,
  ReplaceStencilOp,
  ShaderMaterial,
  type Texture,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import { CAP_HATCH } from './section.js'
import type { ViewerTheme } from './theme.js'

/**
 * The cap over a cut, as a picture rather than a colour.
 *
 * A flat fill says "there is a face here"; a hatched one says "this face is
 * not the part's own", which is what a section drawing says and what somebody
 * reading a cut needs — otherwise a cap through a bore and the bore's own end
 * wall are the same grey. The outline around it does the same job for the
 * cap's edge, where it meets the surface the plane went through.
 *
 * Both are screen-space. The hatch keeps its pitch at every zoom, and the
 * outline is found by sampling a **mask** — the cap region alone, drawn into a
 * render target on a pre-pass — a texel to each side. That pre-pass is why the
 * cap needs a `WebGLRenderTarget` with a stencil buffer: the mask is the same
 * two-pass stencil trick the main pass uses, drawn on its own so the edge of
 * the region can be read back.
 */

const VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D uMask;
uniform vec2 uResolution;
uniform vec3 uFill;
uniform vec3 uHatch;
uniform vec3 uOutline;
uniform float uPitch;
uniform float uLine;
uniform float uThickness;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 step = vec2(uThickness) / uResolution;

  // The mask is 1 inside the cap and 0 outside; a change across a texel in any
  // direction is the cap's edge.
  float here = texture2D(uMask, uv).r;
  float edge =
    abs(here - texture2D(uMask, uv + vec2(step.x, 0.0)).r) +
    abs(here - texture2D(uMask, uv - vec2(step.x, 0.0)).r) +
    abs(here - texture2D(uMask, uv + vec2(0.0, step.y)).r) +
    abs(here - texture2D(uMask, uv - vec2(0.0, step.y)).r);
  edge = clamp(edge, 0.0, 1.0);

  // Diagonal stripes at a fixed pitch on screen, anti-aliased over one pixel.
  float along = mod(gl_FragCoord.x + gl_FragCoord.y, uPitch);
  float stripe = 1.0 - smoothstep(uLine, uLine + 1.0, along);

  vec3 color = mix(uFill, uHatch, stripe);
  color = mix(color, uOutline, edge);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`

// A type rather than an interface: three's `uniforms` wants an index signature,
// which an object type alias carries implicitly and an interface does not.
export type CapUniforms = {
  uMask: { value: Texture | null }
  uResolution: { value: Vector2 }
  uFill: { value: Color }
  uHatch: { value: Color }
  uOutline: { value: Color }
  uPitch: { value: number }
  uLine: { value: number }
  uThickness: { value: number }
}

export type CapMaterial = ShaderMaterial & { uniforms: CapUniforms }

/**
 * The render target the mask is drawn into. Sized later, to the drawing
 * buffer, because that is what `gl_FragCoord` is measured in and a mask at
 * any other size would put the outline beside the edge rather than on it.
 */
export function createMaskTarget(): WebGLRenderTarget {
  return new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: true,
  })
}

/**
 * The cap's own material, filled only where the main pass's stencil says the
 * plane is inside material. Unthemed until {@link applyCapTheme} is called.
 */
export function createCapMaterial(mask: Texture): CapMaterial {
  const uniforms: CapUniforms = {
    uMask: { value: mask },
    uResolution: { value: new Vector2(1, 1) },
    uFill: { value: new Color() },
    uHatch: { value: new Color() },
    uOutline: { value: new Color() },
    uPitch: { value: CAP_HATCH.pitch },
    uLine: { value: CAP_HATCH.line },
    uThickness: { value: CAP_HATCH.outline },
  }

  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    side: DoubleSide,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: NotEqualStencilFunc,
    stencilFail: ReplaceStencilOp,
    stencilZFail: ReplaceStencilOp,
    stencilZPass: ReplaceStencilOp,
  }) as CapMaterial
}

/** Re-themes a cap in place, and re-scales its hatch for the device pixel ratio. */
export function applyCapTheme(material: CapMaterial, theme: ViewerTheme, dpr: number): void {
  material.uniforms.uFill.value.set(theme.sectionCap)
  material.uniforms.uHatch.value.set(theme.sectionHatch)
  material.uniforms.uOutline.value.set(theme.sectionHandleOutline)
  material.uniforms.uPitch.value = CAP_HATCH.pitch * dpr
  material.uniforms.uLine.value = CAP_HATCH.line * dpr
  material.uniforms.uThickness.value = CAP_HATCH.outline * dpr
}

/**
 * The two materials of the stencil pass: back faces count up, front faces
 * count down, and what is left non-zero is where the plane is inside solid
 * material. Nothing is written but the stencil.
 */
export function createStencilMaterials(clip: Plane[]): [MeshBasicMaterial, MeshBasicMaterial] {
  const shared = {
    depthWrite: false,
    depthTest: false,
    colorWrite: false,
    stencilWrite: true,
    stencilFunc: AlwaysStencilFunc,
    clippingPlanes: clip,
  }
  return [
    new MeshBasicMaterial({
      ...shared,
      side: BackSide,
      stencilFail: IncrementWrapStencilOp,
      stencilZFail: IncrementWrapStencilOp,
      stencilZPass: IncrementWrapStencilOp,
    }),
    new MeshBasicMaterial({
      ...shared,
      side: FrontSide,
      stencilFail: DecrementWrapStencilOp,
      stencilZFail: DecrementWrapStencilOp,
      stencilZPass: DecrementWrapStencilOp,
    }),
  ]
}

/** The quad the mask pass draws where the stencil is set — white on black. */
export function createMaskMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: 0xffffff,
    side: DoubleSide,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: NotEqualStencilFunc,
    stencilFail: ReplaceStencilOp,
    stencilZFail: ReplaceStencilOp,
    stencilZPass: ReplaceStencilOp,
  })
}
