import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const api = {
    parts: {
      createPart: vi.fn(),
      updatePart: vi.fn(),
      getPart: vi.fn(),
    },
    jobs: {
      streamJobEventsRaw: vi.fn(),
    },
    features: {
      getPartFeatures: vi.fn(),
    },
  }
  return { api, uploadToPresignedUrl: vi.fn() }
})

vi.mock('@toolpath/api', () => ({
  UpdatePartOperationFeatureDetailsEnum: { True: 'true' },
  createToolpathClient: vi.fn(() => mocks.api),
  JobDetailFromJSON: (value: Record<string, unknown>) => ({
    ...value,
    createdAt: new Date(String(value.createdAt)),
  }),
  instanceOfJobDetail: (value: object) =>
    'status' in value && 'jobUuid' in value && 'partUuid' in value,
  uploadToPresignedUrl: mocks.uploadToPresignedUrl,
}))

const { analyzePart } = await import('./analyze-part.js')

describe('analyzePart example', () => {
  it('waits for the terminal SSE event before requesting the report', async () => {
    mocks.api.parts.createPart.mockResolvedValue({
      partId: 'part-1',
      uploadUrl: 'https://upload.test/part',
    })
    mocks.api.parts.updatePart.mockResolvedValue({ partId: 'part-1', jobId: 'job-1' })
    mocks.api.jobs.streamJobEventsRaw.mockResolvedValue({
      raw: new Response(
        [
          'event: job',
          'data: {"partUuid":"part-1","jobUuid":"job-1","status":"running","progress":20,"error":null,"reportId":null,"createdAt":"2026-08-13T00:00:00.000Z"}',
          '',
          'event: job',
          'data: {"partUuid":"part-1","jobUuid":"job-1","status":"succeeded","progress":100,"error":null,"reportId":"report-1","createdAt":"2026-08-13T00:00:00.000Z"}',
          '',
          '',
        ].join('\n'),
      ),
    })
    mocks.api.parts.getPart.mockResolvedValue({
      partId: 'part-1',
      reportId: 'report-1',
      jobId: 'job-1',
      features: [{ featureId: 'feature-1', featureTag: 'tag-1' }],
    })
    mocks.api.features.getPartFeatures.mockResolvedValue({ datasheets: [], notFound: [] })

    const report = await analyzePart(fileURLToPath(new URL('../.env.example', import.meta.url)), {
      apiKey: 'test-key',
      onStatus: vi.fn(),
    })

    expect(mocks.api.jobs.streamJobEventsRaw).toHaveBeenCalledWith({ id: 'job-1' })
    expect(mocks.api.parts.getPart).toHaveBeenCalledWith({ id: 'part-1', jobId: 'job-1' })
    expect(mocks.api.features.getPartFeatures).toHaveBeenCalledWith({
      id: 'part-1',
      ids: 'feature-1',
    })
    expect(report).toMatchObject({ partId: 'part-1', reportId: 'report-1' })
  })
})
