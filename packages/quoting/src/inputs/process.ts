import { normalizeCrib, type ToolCrib } from './tool-crib'

/**
 * A process: the settings a part starts with — its material, machine, tool crib, stock and DFM rule
 * sets — kept under a name so a shop picks them together. A part takes a copy; it keeps no link to
 * the process's later edits.
 *
 * A setting a process leaves unset (a null id, an empty crib) is not one it supplies: applying the
 * process leaves the part's own value. Its DFM rule sets are always supplied, none meaning the
 * part's rules follow the shop's.
 */
export interface ProcessSettings {
  materialId: string | null
  machineProfileId: string | null
  toolCrib: ToolCrib
  stockProfileId: string | null
  dfmRuleSetIds: Array<string>
}

export type ProcessKey = keyof ProcessSettings

/** Every setting a process holds, in the order a part's inputs read. */
export const PROCESS_KEYS: ReadonlyArray<ProcessKey> = [
  'materialId',
  'machineProfileId',
  'toolCrib',
  'stockProfileId',
  'dfmRuleSetIds',
]

/**
 * `target` with a process's settings applied: each of `keys` the process supplies, and nothing else.
 * A caller leaves a setting out by leaving its key out — a folder takes no material, say. The crib is
 * kept as every crib is (`normalizeCrib`). Pure: `target` is not changed. The target may hold any
 * of the settings, or none yet — a part's inputs before its stock is chosen, say; the result is
 * typed with every setting it may have added.
 */
export const applyProcess = <Target extends Partial<ProcessSettings>>(
  target: Target,
  settings: ProcessSettings,
  keys: ReadonlyArray<ProcessKey> = PROCESS_KEYS,
): Target & Partial<ProcessSettings> => {
  const supplied: Partial<ProcessSettings> = {}
  for (const key of keys) {
    switch (key) {
      case 'materialId':
      case 'machineProfileId':
      case 'stockProfileId': {
        const id = settings[key]
        if (id !== null) {
          supplied[key] = id
        }
        break
      }
      case 'toolCrib':
        if (settings.toolCrib.length > 0) {
          supplied.toolCrib = normalizeCrib(settings.toolCrib)
        }
        break
      case 'dfmRuleSetIds':
        supplied.dfmRuleSetIds = [...settings.dfmRuleSetIds]
        break
    }
  }
  return { ...target, ...supplied }
}
