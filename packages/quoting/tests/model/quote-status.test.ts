import { describe, expect, it } from 'vitest'
import { quoteStatus } from '../../src/model/quote-status'

describe('quoteStatus', () => {
  const open = { sentAt: null, outcome: null }

  it('is new while any part is still unestimated', () => {
    expect(quoteStatus({ ...open, partCount: 4, estimatedPartCount: 3 })).toBe('new')
  })

  it('is estimated once every part is', () => {
    expect(quoteStatus({ ...open, partCount: 4, estimatedPartCount: 4 })).toBe('estimated')
  })

  it('is new with no parts, because there is nothing to have estimated', () => {
    // Zero of zero is vacuously "all", which would read as estimated without this rule.
    expect(quoteStatus({ ...open, partCount: 0, estimatedPartCount: 0 })).toBe('new')
  })

  it('drops back to new when a sign-off is taken back, whatever the stamp says', () => {
    // Every part checked is the floor for sent, not merely the step before it. A part reopened
    // for review means the thing that was sent is no longer what is on the quote.
    expect(
      quoteStatus({ sentAt: new Date(), outcome: null, partCount: 4, estimatedPartCount: 3 }),
    ).toBe('new')
  })

  it.each([['won'], ['lost']] as const)(
    'is %s once it is answered, which outranks sent',
    (outcome) => {
      expect(
        quoteStatus({ sentAt: new Date(), outcome, partCount: 1, estimatedPartCount: 1 }),
      ).toBe(outcome)
    },
  )

  it('is new when a sign-off is taken back, even on a quote already won', () => {
    // The same floor as everything above estimated: the thing that was won is no longer what is
    // on the quote.
    expect(
      quoteStatus({ sentAt: new Date(), outcome: 'won', partCount: 4, estimatedPartCount: 3 }),
    ).toBe('new')
  })

  it('is sent once it has been sent', () => {
    expect(
      quoteStatus({ sentAt: new Date(), outcome: null, partCount: 1, estimatedPartCount: 1 }),
    ).toBe('sent')
  })
})
