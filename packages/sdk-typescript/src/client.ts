import {
  Configuration,
  DemoApi,
  FeaturesApi,
  JobsApi,
  KeysApi,
  PartsApi,
  PlansApi,
  ServiceApi,
  ToolHoldersApi,
  ToolpathsApi,
} from './generated/index.js'

export interface ToolpathClientOptions {
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

/** Every generated API, so no operation in the contract needs a hand-built request. */
export interface ToolpathClient {
  demo: DemoApi
  features: FeaturesApi
  jobs: JobsApi
  keys: KeysApi
  parts: PartsApi
  plans: PlansApi
  service: ServiceApi
  toolHolders: ToolHoldersApi
  toolpaths: ToolpathsApi
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
    jobs: new JobsApi(configuration),
    keys: new KeysApi(configuration),
    parts: new PartsApi(configuration),
    plans: new PlansApi(configuration),
    service: new ServiceApi(configuration),
    toolHolders: new ToolHoldersApi(configuration),
    toolpaths: new ToolpathsApi(configuration),
  }
}
