import {
  Configuration,
  DemoApi,
  FeaturesApi,
  HoldersApi,
  JobsApi,
  KeysApi,
  PartsApi,
  PlansApi,
  ServiceApi,
} from './generated/index.js'

export interface ToolpathClientOptions {
  /** The API key sent as a Bearer token. Pass `''` to call only the public operations. */
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

export interface ToolpathClient {
  demo: DemoApi
  features: FeaturesApi
  holders: HoldersApi
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
    demo: new DemoApi(configuration),
    features: new FeaturesApi(configuration),
    holders: new HoldersApi(configuration),
    jobs: new JobsApi(configuration),
    keys: new KeysApi(configuration),
    parts: new PartsApi(configuration),
    plans: new PlansApi(configuration),
    service: new ServiceApi(configuration),
  }
}
