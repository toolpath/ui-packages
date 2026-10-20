/**
 * The moment a quote's expiry date is over: the end of that calendar day in the last timezone to
 * reach it, UTC−12 ("anywhere on Earth").
 *
 * An expiry is a day on a calendar, stored as UTC midnight like a due date. Ending it at UTC
 * midnight would close the quote in the afternoon of its last day for a customer in the Americas;
 * ending it where the day ends last gives every customer the whole of the date they were promised.
 */
export const expiryEnd = (value: string | Date): Date => {
  const day = new Date(value)
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1, 12))
}

/** Whether a quote with this expiry date has expired. A quote with none never does. */
export const isQuoteExpired = (value: string | Date | null, now: Date = new Date()): boolean =>
  value !== null && now.getTime() >= expiryEnd(value).getTime()

/** How long a new quote's offer stands, in days, until the shop says otherwise. */
export const DEFAULT_EXPIRY_DAYS = 7

/**
 * A new quote's expiry: the calendar day {@link DEFAULT_EXPIRY_DAYS} on from today, held as UTC
 * midnight like every expiry. Today is the UTC day, which is the server's frame when it creates one.
 */
export const defaultExpiry = (now: Date = new Date()): Date =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + DEFAULT_EXPIRY_DAYS),
  )
