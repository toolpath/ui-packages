import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuleList, type DfmRules } from '../../src'
import {
  PRESENCE_METRIC,
  QUICK_SUBJECTS,
  makeRule,
  serializeRuleSet,
  type DfmCheck,
  type DfmRule,
} from '@toolpath/dfm'

const aRule = (): DfmRule => makeRule(QUICK_SUBJECTS[0] ?? 'any', PRESENCE_METRIC.key, 'mm')

const fakeRules = (rules: readonly DfmRule[]): DfmRules => ({
  rules,
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
})

const renderList = (rules: DfmRules, actions?: ReactNode) =>
  render(
    <RuleList
      rules={rules}
      actions={actions}
      check={null}
      features={null}
      sheets={null}
      units="mm"
      selected={null}
      selectedGroup={null}
      onInspect={vi.fn()}
      onHover={vi.fn()}
    />,
  )

const chooseFile = (contents: string): void => {
  const file = new File([contents], 'rules.json', { type: 'application/json' })
  fireEvent.change(screen.getByLabelText('Rule set file'), { target: { files: [file] } })
}

describe('RuleList', () => {
  it('shows the rules it is given, and no others', () => {
    renderList(fakeRules([aRule(), aRule()]))
    expect(screen.getAllByRole('button', { name: /^Features:/ })).toHaveLength(2)
  })

  it('shows no rules when given none: it ships no defaults', () => {
    renderList(fakeRules([]))
    expect(screen.queryByRole('button', { name: /^Features:/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'New rule' })).toBeInTheDocument()
  })

  it('refuses a comma in a value, rather than reading 1,000 as 1', () => {
    const rules = fakeRules([makeRule(QUICK_SUBJECTS[0] ?? 'any', 'depthBelowTop', 'mm')])
    renderList(rules)
    const value = screen.getByLabelText('Value')

    fireEvent.change(value, { target: { value: '1,000' } })

    expect(value).toHaveAttribute('aria-invalid', 'true')
    expect(rules.update).not.toHaveBeenCalled()
  })
})

describe('RuleList dimming', () => {
  const check = (byRule: DfmCheck['byRule']): DfmCheck => ({
    hitsByTag: new Map(),
    required: new Set(),
    byRule,
    paintedFaces: new Map(),
    paintedWhole: new Map(),
  })
  const rowOf = (index: number) =>
    screen.getAllByRole('button', { name: /^Features:/ })[index]!.closest('li')!

  it('dims the rules nothing breaks, and not one broken only by readings a plan can do without', () => {
    const [broken, others, nothing] = [aRule(), aRule(), aRule()]
    render(
      <RuleList
        rules={fakeRules([broken!, others!, nothing!])}
        check={check([
          { rule: broken!, tags: ['f1'], otherTags: [] },
          { rule: others!, tags: [], otherTags: ['f2'] },
        ])}
        features={null}
        sheets={null}
        units="mm"
        selected={null}
        selectedGroup={null}
        onInspect={vi.fn()}
        onHover={vi.fn()}
      />,
    )
    // In the list's order: the broken rules, then the quiet one.
    expect(rowOf(0)).not.toHaveClass('opacity-55')
    expect(rowOf(1)).not.toHaveClass('opacity-55')
    expect(rowOf(2)).toHaveClass('opacity-55')
  })
})

describe('RuleList footer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("puts the app's actions in the row with its own, after them", () => {
    renderList(fakeRules([aRule()]), <button type="button">Reset to standard checks</button>)
    const reset = screen.getByRole('button', { name: 'Reset to standard checks' })
    const exportButton = screen.getByRole('button', { name: /Export/ })
    expect(reset.parentElement).toBe(exportButton.parentElement)
    expect(
      exportButton.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('offers no LLM prompt of its own: an app adds that through `actions`', () => {
    renderList(fakeRules([aRule()]))
    expect(screen.queryByRole('button', { name: /LLM/ })).toBeNull()
  })

  describe('Export', () => {
    // jsdom has neither; each test gets its own, and the originals come back after.
    const { createObjectURL, revokeObjectURL } = URL
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:rules')
      URL.revokeObjectURL = vi.fn()
    })
    afterEach(() => {
      URL.createObjectURL = createObjectURL
      URL.revokeObjectURL = revokeObjectURL
    })

    it('downloads the rules as dfm-rules.json', async () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const rules = fakeRules([aRule()])
      renderList(rules)

      fireEvent.click(screen.getByRole('button', { name: /Export/ }))

      expect(click).toHaveBeenCalledOnce()
      expect(click.mock.contexts[0]).toMatchObject({ download: 'dfm-rules.json' })
      const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob
      expect(await blob.text()).toBe(serializeRuleSet(rules.rules))
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:rules')
    })
  })

  describe('Import', () => {
    it('puts the file’s rules in place of the list and says how many', async () => {
      const rules = fakeRules([])
      const imported = [aRule(), aRule()]
      renderList(rules)

      chooseFile(serializeRuleSet(imported))

      await waitFor(() => expect(rules.replace).toHaveBeenCalledOnce())
      expect(vi.mocked(rules.replace).mock.calls[0]?.[0]).toHaveLength(2)
      expect(screen.getByRole('status')).toHaveTextContent('Imported 2 rules')
    })

    it('says why a file it cannot read was not imported, and keeps the rules', async () => {
      const rules = fakeRules([aRule()])
      renderList(rules)

      chooseFile('not json')

      expect(await screen.findByRole('status')).toHaveTextContent('Could not import')
      expect(rules.replace).not.toHaveBeenCalled()
    })
    it('says so when the file itself cannot be read, and keeps the rules', async () => {
      const rules = fakeRules([aRule()])
      renderList(rules)
      const file = new File([''], 'rules.json', { type: 'application/json' })
      file.text = () => Promise.reject(new Error('gone'))

      fireEvent.change(screen.getByLabelText('Rule set file'), { target: { files: [file] } })

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Could not import: the file could not be read.',
      )
      expect(rules.replace).not.toHaveBeenCalled()
    })
  })
})
