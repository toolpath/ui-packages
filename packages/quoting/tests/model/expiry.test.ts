import { describe, expect, it } from 'vitest'
import { defaultExpiry, expiryEnd, isQuoteExpired } from '../../src/model/expiry'

/** An expiry is the last day of the offer, held as UTC midnight. */
const EXPIRES = '2026-10-10T00:00:00.000Z'

describe('isQuoteExpired', () => {
  it('stands through the whole of its last day, wherever the customer is', () => {
    // 11pm on the 10th in Hawaii (UTC−10) is 9am on the 11th in UTC: still the 10th there.
    expect(isQuoteExpired(EXPIRES, new Date('2026-10-11T09:00:00Z'))).toBe(false)
    // The last moment of the 10th anywhere on Earth, UTC−12.
    expect(isQuoteExpired(EXPIRES, new Date('2026-10-11T11:59:59Z'))).toBe(false)
  })

  it('has expired once that day is over everywhere', () => {
    expect(expiryEnd(EXPIRES).toISOString()).toBe('2026-10-11T12:00:00.000Z')
    expect(isQuoteExpired(EXPIRES, new Date('2026-10-11T12:00:00Z'))).toBe(true)
    expect(isQuoteExpired(EXPIRES, new Date('2026-11-01T00:00:00Z'))).toBe(true)
  })

  it('never expires a quote with no expiry date', () => {
    expect(isQuoteExpired(null, new Date('2099-01-01T00:00:00Z'))).toBe(false)
  })
})

describe('defaultExpiry', () => {
  it('is the calendar day a week on, at UTC midnight like every expiry', () => {
    expect(defaultExpiry(new Date('2026-10-06T15:30:00Z')).toISOString()).toBe(
      '2026-10-13T00:00:00.000Z',
    )
  })

  it('crosses a month end', () => {
    expect(defaultExpiry(new Date('2026-10-28T01:00:00Z')).toISOString()).toBe(
      '2026-11-04T00:00:00.000Z',
    )
  })
})
