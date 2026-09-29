import { describe, expect, it } from 'vitest'
import {
  CONTROL_SCHEME_OPTIONS,
  resolveControlScheme,
  type ControlScheme,
} from '../src/render/control-schemes.js'

const mappingFor = (
  scheme: ControlScheme,
  modifiers = { shift: false, ctrl: false },
  orthographic = true,
) => resolveControlScheme(scheme, { modifiers, orthographic })

describe('control scheme options', () => {
  it('exports the complete legacy CAD preset list with stable public values', () => {
    expect(CONTROL_SCHEME_OPTIONS).toEqual([
      { value: 'toolpath', label: 'Toolpath' },
      { value: 'fusion', label: 'Fusion' },
      { value: 'alias', label: 'Alias' },
      { value: 'inventor', label: 'Inventor' },
      { value: 'solidworks', label: 'SolidWorks' },
      { value: 'tinkercad', label: 'Tinkercad' },
      { value: 'powermill', label: 'PowerMill' },
      { value: 'onshape', label: 'Onshape' },
    ])
  })
})

describe('resolveControlScheme', () => {
  it.each([
    ['toolpath', { left: 'rotate', middle: 'none', right: 'truck' }],
    ['alias', { left: 'rotate', middle: 'truck', right: 'none' }],
    ['tinkercad', { left: 'none', middle: 'none', right: 'rotate' }],
    ['powermill', { left: 'none', middle: 'rotate', right: 'none' }],
    ['onshape', { left: 'none', middle: 'truck', right: 'rotate' }],
  ] as const)('%s maps its unmodified mouse buttons', (scheme, mouse) => {
    const mapping = mappingFor(scheme)

    expect(mapping.mouse).toMatchObject(mouse)
    expect(mapping.mouse.wheel).toBe('zoom')
    expect(mapping.touches).toEqual({ one: 'rotate', two: 'dolly-truck', three: 'truck' })
    expect(mapping.usesCadWheel).toBe(false)
    expect(mapping.immediate).toBe(false)
  })

  it.each(['fusion', 'inventor'] as const)(
    '%s uses the Fusion-style trackpad mapping',
    (scheme) => {
      const plain = mappingFor(scheme)
      const shifted = mappingFor(scheme, { shift: true, ctrl: false })

      expect(plain.mouse).toMatchObject({
        left: 'none',
        middle: 'truck',
        right: 'none',
        wheel: 'none',
      })
      expect(plain.touches).toEqual({ one: 'rotate', two: 'truck', three: 'truck' })
      expect(plain.usesCadWheel).toBe(true)
      expect(plain.immediate).toBe(true)

      expect(shifted.mouse.middle).toBe('rotate')
      expect(shifted.touches.two).toBe('rotate')
    },
  )

  it('matches SolidWorks middle-button modifiers, with Shift taking precedence', () => {
    expect(mappingFor('solidworks').mouse.middle).toBe('rotate')
    expect(mappingFor('solidworks', { shift: false, ctrl: true }).mouse.middle).toBe('truck')
    expect(mappingFor('solidworks', { shift: true, ctrl: false }).mouse.middle).toBe('zoom')
    expect(mappingFor('solidworks', { shift: true, ctrl: true }).mouse.middle).toBe('zoom')
  })

  it('maps Tinkercad and PowerMill Shift gestures to pan', () => {
    expect(mappingFor('tinkercad', { shift: true, ctrl: false }).mouse.right).toBe('truck')
    expect(mappingFor('powermill', { shift: true, ctrl: false }).mouse.middle).toBe('truck')
  })

  it.each(['toolpath', 'alias', 'solidworks', 'tinkercad', 'powermill', 'onshape'] as const)(
    '%s dollies with a perspective camera',
    (scheme) => {
      expect(mappingFor(scheme, { shift: false, ctrl: false }, false).mouse.wheel).toBe('dolly')
    },
  )
})
