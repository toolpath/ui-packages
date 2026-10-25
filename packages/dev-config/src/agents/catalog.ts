// Placeholder until the agent-assets branch merges; it defines the real catalog.
export interface AgentSelection {
  engine: boolean
  skillsDir: string
  packageManager: 'npm' | 'pnpm'
}
export interface AgentFileAsset {
  target: string
  content: string
}
export const AGENTS_FILE = 'AGENTS.md'
export const AGENTS_BLOCK_ID = 'toolpath-dev-standard'
export const agentFileAssets = (selection: AgentSelection): Array<AgentFileAsset> => [
  {
    target: `${selection.skillsDir}/commit/SKILL.md`,
    content: '---\nname: commit\ndescription: placeholder\n---\n',
  },
]
export const agentsBlock = (selection: AgentSelection): string =>
  `Placeholder standard section (${selection.packageManager}).\n`
