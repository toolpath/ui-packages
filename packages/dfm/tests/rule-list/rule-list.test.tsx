import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuleList, type DfmRules } from '../../src/index.js'
import { PRESENCE_METRIC, QUICK_SUBJECTS } from '../../src/model/dfm-metrics.js'
import { llmRulePrompt, makeRule, serializeRuleSet, type DfmRule } from '../../src/model/index.js'

const aRule = (): DfmRule => makeRule(QUICK_SUBJECTS[0] ?? 'any', PRESENCE_METRIC.key, 'mm')

const fakeRules = (rules: readonly DfmRule[]): DfmRules => ({
  rules,
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
})

const renderList = (rules: DfmRules) =>
  render(
    <RuleList
      rules={rules}
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

/** jsdom has no clipboard: put one in for a test, and take it out after. */
const stubClipboard = (writeText: (text: string) => Promise<void>): void => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

const chooseFile = (contents: string): void => {
  const file = new File([contents], 'rules.json', { type: 'application/json' })
  fireEvent.change(screen.getByLabelText('Rule set file'), { target: { files: [file] } })
}

describe('RuleList', () => {
  it('shows the rules it is given, and no others', () => {
    renderList(fakeRules([aRule(), aRule()]))
    expect(screen.getAllByLabelText('Features')).toHaveLength(2)
  })

  it('shows no rules when given none: it ships no defaults', () => {
    renderList(fakeRules([]))
    expect(screen.queryByLabelText('Features')).toBeNull()
    expect(screen.getByLabelText('New rule')).toBeInTheDocument()
  })
})

describe('RuleList footer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    Reflect.deleteProperty(navigator, 'clipboard')
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

  describe('Copy LLM prompt', () => {
    it('copies the prompt and says "Copied" for two seconds', async () => {
      vi.useFakeTimers()
      const writeText = vi.fn(async () => {})
      stubClipboard(writeText)
      const rules = fakeRules([aRule()])
      renderList(rules)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Copy LLM prompt/ }))
      })

      expect(writeText).toHaveBeenCalledWith(llmRulePrompt(rules.rules))
      expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(2000))

      expect(screen.getByRole('button', { name: /Copy LLM prompt/ })).toBeInTheDocument()
    })

    it('starts the two seconds over when copied again', async () => {
      vi.useFakeTimers()
      stubClipboard(vi.fn(async () => {}))
      renderList(fakeRules([aRule()]))
      const copy = async (): Promise<void> => {
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /Copy LLM prompt|Copied/ }))
        })
      }

      await copy()
      act(() => vi.advanceTimersByTime(1500))
      await copy()
      act(() => vi.advanceTimersByTime(1500))

      expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument()
    })

    it('says so when the clipboard refuses', async () => {
      const writeText = vi.fn(async () => {
        throw new Error('denied')
      })
      stubClipboard(writeText)
      renderList(fakeRules([aRule()]))

      fireEvent.click(screen.getByRole('button', { name: /Copy LLM prompt/ }))

      expect(await screen.findByRole('status')).toHaveTextContent('Could not copy')
      expect(screen.queryByRole('button', { name: /Copied/ })).toBeNull()
    })
  })
})
