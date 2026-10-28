import type { DockGroup, DockTool } from './types'

/** A switch is a tool that turns on and off and can work now: a gated tool is neither. */
export const isSwitch = (tool: DockTool): boolean => tool.on !== undefined && !tool.gate

/** What a row says under a tool's label: why it cannot work yet, or else what it does. */
export const lineOf = (tool: DockTool): string | null | undefined => tool.gate || tool.note

/** The heading above a group's tools, in All tools and in the group's menu. */
export const headingOf = (group: DockGroup): string => group.title ?? group.label
