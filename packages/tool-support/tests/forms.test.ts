import { describe, expect, it } from 'vitest'

import {
  MILLING_FORMS,
  THREAD_METHODS,
  TOOL_FORMS,
  isThreadMethod,
  isToolForm,
  type ToolForm,
} from '../src/index.js'

describe('the tool form vocabulary', () => {
  it('names each form once', () => {
    // The list is read as a set by everything downstream — icons, a filter
    // panel, a drawing's generator table. A duplicated value would offer a
    // machinist the same form twice and count its tools under one of them.
    const values = TOOL_FORMS.map((form) => form.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('accepts every form it publishes, and `other`', () => {
    for (const form of TOOL_FORMS) {
      expect(isToolForm(form.value), form.value).toBe(true)
    }
    // A real answer, not a fallback: a vendor publishes tools this vocabulary
    // has no word for, and picking the nearest wrong form is worse than saying
    // so.
    expect(isToolForm('other')).toBe(true)
  })

  it('refuses a name it does not know', () => {
    expect(isToolForm('endmill')).toBe(false)
    expect(isToolForm('keyseat cutter')).toBe(false)
    expect(isToolForm('')).toBe(false)
  })

  it('holds the milling forms and nothing from hole making', () => {
    // What a flute-count suggestion makes sense for. A drill in this set is a
    // suggestion offered about a tool that does not take one.
    for (const form of TOOL_FORMS) {
      expect(MILLING_FORMS.has(form.value), form.value).toBe(form.group === 'Milling')
    }
    expect(MILLING_FORMS.has('drill')).toBe(false)
    expect(MILLING_FORMS.has('flat end mill')).toBe(true)
  })

  it('speaks a CAM library’s words rather than a vendor’s', () => {
    // A keyseat or woodruff cutter is a `slot mill` here, which is Fusion's own
    // type for it — the reason the vocabulary is not the scraper's coarse kind.
    const forms: readonly ToolForm[] = TOOL_FORMS.map((form) => form.value)
    expect(forms).toContain('slot mill')
    expect(forms).toContain('bull nose end mill')
    expect(forms).not.toContain('endmill')
  })

  it('groups every form under one a control can offer', () => {
    for (const form of TOOL_FORMS) {
      expect(['Milling', 'Hole making'], form.value).toContain(form.group)
    }
  })
})

describe('how a tap makes its thread', () => {
  it('is a second axis, and not two more forms', () => {
    // The vocabulary here is Fusion's, so a tool exported there lands on the
    // type it already has — and Fusion has no form-tap type: a thread former is
    // a `tap right hand` like any other. Adding `form tap right hand` would buy
    // a filter chip and cost that guarantee, so the fact rides beside `form`
    // instead. The same call `tool-scraper` makes for a holder's `contact`,
    // which does not fold into its `taper`.
    const forms: readonly ToolForm[] = TOOL_FORMS.map((form) => form.value)
    expect(forms).toContain('tap right hand')
    expect(forms).toContain('tap left hand')
    for (const form of forms) {
      expect(form, form).not.toMatch(/form(ing)? tap/)
    }
  })

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
