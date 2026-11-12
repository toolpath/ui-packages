import { describe, expect, it } from 'vitest'

import {
  KERNEL_TOOL_KINDS,
  THREAD_METHODS,
  TOOL_KINDS,
  isInsertKind,
  isKernelKind,
  isTapKind,
  isThreadMethod,
  isToolKind,
} from '../src/index.js'

describe('tool kinds', () => {
  it('start with the kernel head tags, and add the kinds it does not plan with', () => {
    expect(KERNEL_TOOL_KINDS).toHaveLength(14)
    expect(TOOL_KINDS.slice(0, KERNEL_TOOL_KINDS.length)).toEqual([...KERNEL_TOOL_KINDS])
    expect(TOOL_KINDS).toHaveLength(24)
    expect(TOOL_KINDS.every(isToolKind)).toBe(true)
  })

  it('name each kind once', () => {
    // The list is read as a set by everything downstream — a filter panel, a
    // drawing's generator table, an exporter's type table. A duplicated value
    // would offer a machinist the same kind twice.
    expect(new Set(TOOL_KINDS).size).toBe(TOOL_KINDS.length)
  })

  it('tell a kind the kernel plans with from one it does not', () => {
    expect(TOOL_KINDS.filter(isKernelKind)).toEqual([...KERNEL_TOOL_KINDS])
    // A spot drill is the kernel's `DrillBit` with `is_spot_drill`, kept a kind of its own.
    expect(isKernelKind('SpotDrill')).toBe(true)
    expect(isKernelKind('DrillBit')).toBe(true)
    expect(isKernelKind('CenterDrill')).toBe(false)
  })

  it('reject anything else', () => {
    expect(isToolKind('flat end mill')).toBe(false)
    expect(isToolKind(undefined)).toBe(false)
    expect(isKernelKind('flat end mill')).toBe(false)
  })

  it('make only a face mill an insert tool', () => {
    expect(TOOL_KINDS.filter(isInsertKind)).toEqual(['FaceEndmill'])
  })

  it('hold the two taps and nothing that merely starts with the letters', () => {
    // What a square-drive collet takes. `TaperedEndmill` is the trap a prefix
    // match falls into.
    expect(TOOL_KINDS.filter(isTapKind)).toEqual(['CuttingTap', 'FormingTap'])
  })
})

describe('how a tap makes its thread', () => {
  it('publishes exactly the two methods, once each', () => {
    // Two, and closed: a thread is either cut away or displaced into place, and
    // a third value would be a product line rather than a method.
    expect([...THREAD_METHODS]).toEqual(['cutting', 'forming'])
    expect(new Set(THREAD_METHODS).size).toBe(THREAD_METHODS.length)
  })

  it('accepts what it publishes and nothing else', () => {
    // `tool-scraper` validates a family's declared method against this rather
    // than redeclaring the two strings. `roll` and `form` are the words a
    // vendor's marketing uses for a former, and neither is this vocabulary's.
    for (const method of THREAD_METHODS) {
      expect(isThreadMethod(method), method).toBe(true)
    }
    for (const near of ['roll', 'form', 'cut', 'Forming', '']) {
      expect(isThreadMethod(near), near).toBe(false)
    }
  })
})
