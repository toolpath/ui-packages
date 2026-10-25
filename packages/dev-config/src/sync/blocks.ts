/**
 * Uniquely identified managed regions inside files a repository otherwise owns
 * (`AGENTS.md`, `.husky/pre-commit`, `.gitignore`). Only the text between a
 * block's markers is ever rewritten; everything around it stays byte for byte.
 */

export type CommentStyle = 'markdown' | 'hash' | 'slash'

const markers = (style: CommentStyle, id: string): { begin: string; end: string } => {
  switch (style) {
    case 'markdown':
      return { begin: `<!-- toolpath-dev:begin ${id} -->`, end: `<!-- toolpath-dev:end ${id} -->` }
    case 'hash':
      return { begin: `# toolpath-dev:begin ${id}`, end: `# toolpath-dev:end ${id}` }
    case 'slash':
      return { begin: `// toolpath-dev:begin ${id}`, end: `// toolpath-dev:end ${id}` }
  }
}

export const commentStyleFor = (path: string): CommentStyle => {
  if (/\.(md|mdx)$/i.test(path)) {
    return 'markdown'
  }
  if (/\.(m?[jt]s|cjs|cts)$/.test(path)) {
    return 'slash'
  }
  return 'hash'
}

export interface FoundBlock {
  /** The block's content, without its marker lines. */
  content: string
  /** Character offsets of the whole block including markers. */
  start: number
  end: number
}

export class BlockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockError'
  }
}

/** Locates block `id`; throws when its markers are duplicated, unbalanced, or out of order. */
export const findBlock = (
  text: string,
  style: CommentStyle,
  id: string,
): FoundBlock | undefined => {
  const { begin, end } = markers(style, id)
  const lines = text.split('\n')
  const beginLines = lines.flatMap((line, index) => (line.trim() === begin ? [index] : []))
  const endLines = lines.flatMap((line, index) => (line.trim() === end ? [index] : []))
  if (beginLines.length === 0 && endLines.length === 0) {
    return undefined
  }
  const [beginLine] = beginLines
  const [endLine] = endLines
  if (
    beginLines.length !== 1 ||
    endLines.length !== 1 ||
    beginLine === undefined ||
    endLine === undefined ||
    endLine < beginLine
  ) {
    throw new BlockError(
      `The managed block "${id}" has missing, duplicated, or out-of-order markers (${begin} … ${end}).`,
    )
  }
  const offset = (line: number): number =>
    lines.slice(0, line).reduce((sum, current) => sum + current.length + 1, 0)
  const start = offset(beginLine)
  const finish = Math.min(text.length, offset(endLine) + (lines[endLine]?.length ?? 0) + 1)
  return {
    content: lines
      .slice(beginLine + 1, endLine)
      .map((line) => `${line}\n`)
      .join(''),
    start,
    end: finish,
  }
}

const render = (style: CommentStyle, id: string, content: string): string => {
  const { begin, end } = markers(style, id)
  const body = content === '' || content.endsWith('\n') ? content : `${content}\n`
  return `${begin}\n${body}${end}\n`
}

/**
 * `text` with block `id` set to `content`: replaced in place when present,
 * otherwise appended after a blank line (or `insertAt` when given).
 */
export const upsertBlock = (
  text: string,
  style: CommentStyle,
  id: string,
  content: string,
  { insertAt }: { insertAt?: number } = {},
): string => {
  const found = findBlock(text, style, id)
  const block = render(style, id, content)
  if (found) {
    return text.slice(0, found.start) + block + text.slice(found.end)
  }
  if (insertAt !== undefined) {
    return text.slice(0, insertAt) + block + text.slice(insertAt)
  }
  if (text === '') {
    return block
  }
  const separator = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n'
  return text + separator + block
}
