import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const api = {
    parts: {
      createPart: vi.fn(),
      updatePart: vi.fn(),
      getPart: vi.fn(),
    },
    features: {
      getPartFeatures: vi.fn(),
    },
  }
  return { api, uploadToPresignedUrl: vi.fn(), waitForJob: vi.fn() }
})

vi.mock('@toolpath/api', () => ({
  UpdatePartFeatureDetailsEnum: { True: 'true' },
  createToolpathClient: vi.fn(() => mocks.api),
  uploadToPresignedUrl: mocks.uploadToPresignedUrl,
  waitForJob: mocks.waitForJob,
}))

const { analyzePart } = await import('./analyze-part.js')

const partFile = fileURLToPath(new URL('../.env.example', import.meta.url))

describe('analyzePart example', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.api.parts.createPart.mockResolvedValue({
      partId: 'part-1',
      uploadUrl: 'https://upload.test/part',
    })
    mocks.api.parts.updatePart.mockResolvedValue({ partId: 'part-1', jobId: 'job-1' })
  })

  it('waits for the job before requesting the report', async () => {
    mocks.waitForJob.mockImplementation(async (_api, _jobId, { onUpdate }) => {
      onUpdate({ status: 'running' })
      onUpdate({ status: 'succeeded' })
      return { jobUuid: 'job-1', status: 'succeeded' }
    })
    mocks.api.parts.getPart.mockResolvedValue({
      partId: 'part-1',
      reportId: 'report-1',
      jobId: 'job-1',
      features: [{ featureId: 'feature-1', featureTag: 'tag-1' }],
    })
    mocks.api.features.getPartFeatures.mockResolvedValue({ datasheets: [], notFound: [] })
    const onStatus = vi.fn()

    const report = await analyzePart(partFile, { apiKey: 'test-key', onStatus })

    expect(mocks.waitForJob).toHaveBeenCalledWith(mocks.api, 'job-1', {
      onUpdate: expect.any(Function),
    })
    expect(onStatus.mock.calls.map(([message]) => message)).toEqual([
      'Analysis started as job job-1',
      'Analyzing geometry…',
      'Analysis complete.',
    ])
    expect(mocks.api.parts.getPart).toHaveBeenCalledWith({ id: 'part-1', jobId: 'job-1' })
    expect(mocks.api.features.getPartFeatures).toHaveBeenCalledWith({
      id: 'part-1',
      ids: 'feature-1',
    })
    expect(report).toMatchObject({ partId: 'part-1', reportId: 'report-1' })
  })

  it('requests no report when the job fails', async () => {
    mocks.waitForJob.mockRejectedValue(new Error('kernel_error: no solid body'))

    await expect(analyzePart(partFile, { apiKey: 'test-key', onStatus: vi.fn() })).rejects.toThrow(
      'kernel_error: no solid body',
    )
    expect(mocks.api.parts.getPart).not.toHaveBeenCalled()
  })
})
