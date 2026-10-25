import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BlockError, findBlock, upsertBlock } from '../../src/sync/blocks.js'
import { mergeThreeWay, unifiedDiff } from '../../src/sync/merge.js'

describe('mergeThreeWay', () => {
  const base = 'one\ntwo\nthree\nfour\nfive\n'

  it('takes the new text when the repository kept the base', () => {
    expect(mergeThreeWay(base, base, 'one\nTWO\nthree\nfour\nfive\n')).toEqual({
      ok: true,
      text: 'one\nTWO\nthree\nfour\nfive\n',
    })
  })

  it('keeps local edits when the release changed nothing', () => {
    const ours = 'one\ntwo\nthree\nlocal\nfour\nfive\n'
    expect(mergeThreeWay(base, ours, base)).toEqual({ ok: true, text: ours })
  })

  it('combines changes that do not overlap', () => {
    const ours = 'one\ntwo\nthree\nfour\nfive\nlocal addition\n'
    const theirs = 'ONE\ntwo\nthree\nfour\nfive\n'
    expect(mergeThreeWay(base, ours, theirs)).toEqual({
      ok: true,
      text: 'ONE\ntwo\nthree\nfour\nfive\nlocal addition\n',
    })
  })

  it('reports overlapping changes as a conflict instead of choosing one', () => {
    expect(
      mergeThreeWay(base, 'one\nmine\nthree\nfour\nfive\n', 'one\ntheirs\nthree\nfour\nfive\n'),
    ).toEqual({ ok: false, conflicts: 1 })
  })

  it('accepts the same change made on both sides', () => {
    const same = 'one\ntwo\nthree\nfour\nfive\nsix\n'
    expect(mergeThreeWay(base, same, same)).toEqual({ ok: true, text: same })
  })
})

describe('unifiedDiff', () => {
  it('is empty for identical text and shows added and removed lines otherwise', () => {
    expect(unifiedDiff('a.txt', 'x\n', 'x\n')).toBe('')
    const diff = unifiedDiff('a.txt', 'x\ny\n', 'x\nz\n')
    expect(diff).toContain('--- a/a.txt\n+++ b/a.txt\n')
    expect(diff).toContain('-y\n+z\n')
    expect(unifiedDiff('new.txt', undefined, 'n\n')).toContain('--- /dev/null')
  })
})

describe('managed blocks', () => {
  it('appends a block, then replaces only its content', () => {
    const local = '# Project\n\nOur own rules.\n'
    const once = upsertBlock(local, 'markdown', 'standard', 'Managed v1\n')
    expect(once).toBe(
      '# Project\n\nOur own rules.\n\n<!-- toolpath-dev:begin standard -->\nManaged v1\n<!-- toolpath-dev:end standard -->\n',
    )
    const edited = `${once}\nMore of our rules.\n`
    const twice = upsertBlock(edited, 'markdown', 'standard', 'Managed v2\n')
    expect(twice).toBe(edited.replace('Managed v1', 'Managed v2'))
    expect(findBlock(twice, 'markdown', 'standard')?.content).toBe('Managed v2\n')
  })

  it('rejects duplicated or unbalanced markers', () => {
    const broken =
      '# toolpath-dev:begin hook\none\n# toolpath-dev:begin hook\n# toolpath-dev:end hook\n'
    expect(() => findBlock(broken, 'hash', 'hook')).toThrow(BlockError)
    expect(() => findBlock('# toolpath-dev:end hook\n', 'hash', 'hook')).toThrow(BlockError)
  })
})

describe('unifiedDiff patches', () => {
  it('apply with git, with or without a final newline on either side', () => {
    const directory = mkdtempSync(join(tmpdir(), 'toolpath-dev-patch-'))
    try {
      spawnSync('git', ['init', '--quiet'], { cwd: directory })
      const cases: Array<[string, string]> = [
        ['a\nb\nc\n', 'a\nB\nc\n'],
        ['a\nb\nc', 'a\nB\nc'],
        ['a\nb\nc', 'a\nb\nc\n'],
        ['a\nb\nc\n', 'a\nb\nc'],
        ['only', 'only\nmore\n'],
      ]
      cases.forEach(([before, after], index) => {
        const name = `file-${String(index)}.txt`
        writeFileSync(join(directory, name), before)
        writeFileSync(join(directory, `${name}.patch`), unifiedDiff(name, before, after))
        const applied = spawnSync('git', ['apply', '--check', `${name}.patch`], {
          cwd: directory,
          encoding: 'utf8',
        })
        expect(applied.stderr, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`).toBe('')
        expect(applied.status).toBe(0)
      })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
