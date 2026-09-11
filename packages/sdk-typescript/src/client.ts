import {
  Configuration,
  FeaturesApi,
  JobsApi,
  KeysApi,
  PartsApi,
  PlansApi,
  ServiceApi,
} from './generated/index.js'

export interface ToolpathClientOptions {
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

export interface ToolpathClient {
  features: FeaturesApi
  jobs: JobsApi
  keys: KeysApi
  parts: PartsApi
  plans: PlansApi
  service: ServiceApi
}

export const createToolpathClient = ({
  apiKey,
  baseUrl = 'https://api.toolpath.com',
  fetch,
}: ToolpathClientOptions): ToolpathClient => {
  const configuration = new Configuration({
    basePath: baseUrl,
    accessToken: apiKey,
    fetchApi: fetch,
  })
  return {
    features: new FeaturesApi(configuration),
    jobs: new JobsApi(configuration),
    keys: new KeysApi(configuration),
    parts: new PartsApi(configuration),
    plans: new PlansApi(configuration),
    service: new ServiceApi(configuration),
  }
}
