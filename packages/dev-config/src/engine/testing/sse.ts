import type { JobFixture } from './wire.js'

const encoder = new TextEncoder()

/** One job snapshot framed exactly as the contract documents: a `job` event whose data is the JobDetail JSON. */
export const formatJobEvent = (job: JobFixture): string =>
  `event: job\ndata: ${JSON.stringify(job)}\n\n`

/**
 * The server side of one open event stream. It only writes bytes: parsing,
 * reconnection and retry are client behaviour, which belongs to the SDK and the
 * application, never to this kit.
 */
export interface JobEventStream {
  readonly jobId: string
  readonly body: ReadableStream<Uint8Array<ArrayBuffer>>
  /** Writes one event if the stream is still open. */
  readonly send: (job: JobFixture) => void
  /** Completes the stream: the server closes the connection normally. */
  readonly end: () => void
  /** Breaks the stream mid-response, as a dropped connection does. */
  readonly interrupt: () => void
}

export const openJobEventStream = (
  jobId: string,
  onRelease: () => void,
  signal?: AbortSignal,
): JobEventStream => {
  let controller: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>> | undefined
  let open = true
  const abort = (): void => {
    if (open) {
      controller?.error(
        signal?.reason ?? new DOMException('This operation was aborted', 'AbortError'),
      )
      release()
    }
  }
  const release = (): void => {
    if (open) {
      open = false
      signal?.removeEventListener('abort', abort)
      onRelease()
    }
  }
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start: (streamController) => {
      controller = streamController
    },
    cancel: () => {
      release()
    },
  })
  signal?.addEventListener('abort', abort, { once: true })
  return {
    jobId,
    body,
    send: (job) => {
      if (open) {
        controller?.enqueue(encoder.encode(formatJobEvent(job)))
      }
    },
    end: () => {
      if (open) {
        controller?.close()
        release()
      }
    },
    interrupt: () => {
      if (open) {
        controller?.error(
          new TypeError('terminated', {
            cause: new Error('The Engine scenario interrupted this event stream'),
          }),
        )
        release()
      }
    },
  }
}
