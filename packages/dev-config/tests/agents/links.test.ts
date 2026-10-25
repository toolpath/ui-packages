import { describe, expect, it } from 'vitest'
import {
  isExternalDestination,
  linkDestinations,
  rewriteLinkDestinations,
} from '../../src/agents/links.js'

const destinations = (markdown: string): Array<string> =>
  linkDestinations(markdown).map((link) => link.destination)

describe('linkDestinations', () => {
  it('finds inline links, images, titled and bracketed destinations, and reference definitions', () => {
    const markdown = [
      'See [the guide](docs/guide.md) and ![a diagram](img/flow.svg "Flow").',
      'An [anchored link](<docs/with space.md#usage>) and a [section](#local).',
      '[reference]: ../shared/AGENTS.md',
    ].join('\n')
    expect(destinations(markdown)).toEqual([
      'docs/guide.md',
      'img/flow.svg',
      'docs/with space.md#usage',
      '#local',
      '../shared/AGENTS.md',
    ])
  })

  it('ignores link syntax inside fenced code blocks and inline code spans', () => {
    const markdown = [
      'Real [link](real.md), code `[not](code.md)` and ``[not](double.md)``.',
      '```md',
      '[not](fenced.md)',
      '```',
      '~~~~',
      '[not](tilde.md)',
      '```',
      '[still fenced](tilde-inner.md)',
      '~~~~',
      'After [the fences](after.md).',
    ].join('\n')
    expect(destinations(markdown)).toEqual(['real.md', 'after.md'])
  })
})

describe('rewriteLinkDestinations', () => {
  it('replaces each destination and leaves the surrounding text byte for byte', () => {
    const markdown = 'A [link](a.md "Title"), <kbd>`[code](c.md)`</kbd>, and [another](<b c.md>).\n'
    expect(rewriteLinkDestinations(markdown, (destination) => `x/${destination}`)).toBe(
      'A [link](x/a.md "Title"), <kbd>`[code](c.md)`</kbd>, and [another](<x/b c.md>).\n',
    )
  })
})

describe('isExternalDestination', () => {
  it.each([
    ['https://example.com/docs', true],
    ['mailto:someone@example.com', true],
    ['#heading', true],
    ['docs/agents.md', false],
    ['../commit/SKILL.md#rules', false],
  ])('classifies %s', (destination, external) => {
    expect(isExternalDestination(destination)).toBe(external)
  })
})
