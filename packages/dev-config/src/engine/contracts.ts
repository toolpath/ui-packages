// Placeholder until the Engine branch merges; it defines the real lookup.
import { toolchain } from '../policy/toolchain.js'

export const contractForSdkVersion = (version: string): string | undefined =>
  Object.entries(toolchain.engine.contracts).find(([, pin]) => pin.sdk === version)?.[0]
