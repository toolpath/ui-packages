import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TURNING_RULES } from '@toolpath/dfm'
import { RuleList, type DfmRules } from '../../src'
import {
  checkTurnedPart,
  makeRule,
  serializeRuleSet,
  turnedStretches,
  type DfmCheck,
  type DfmRule,
  type TurnedStretch,
} from '@toolpath/dfm'

const fakeRules = (rules: readonly DfmRule[]): DfmRules => ({
  rules,
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
})

const grooveRule = (): DfmRule => makeRule('groove', 'grooveWidth', 'mm', undefined, TURNING_RULES)

/** A turned part with one OD groove, cut from the +Z end only. */
const stretches: TurnedStretch[] = turnedStretches([
  {
    featureTag: 'G1',
    featureType: 'od_groove',
    approach: 'PlusZ',
    regionIdxs: [4],
    datasheet: { rMin: 8, rMax: 10, facts: { kind: 'OdGroove', width: 1.2, depth: 2 } },
  },
])

const renderList = (rules: DfmRules, check: DfmCheck | null = null) =>
  render(
    <RuleList
      rules={rules}
      vocabulary={TURNING_RULES}
      check={check}
      features={check ? stretches : null}
      sheets={check ? {} : null}
      units="mm"
      selected={null}
      selectedGroup={null}
      onInspect={vi.fn()}
      onHover={vi.fn()}
    />,
  )

describe('RuleList with turning rules', () => {
  it('offers turning subjects to a new rule, and no milling ones', async () => {
    renderList(fakeRules([]))
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Grooves' })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Pockets' })).toBeNull()
  })

  it('makes a new rule in the turning vocabulary', async () => {
    const rules = fakeRules([])
    renderList(rules)
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Grooves' }))
    expect(rules.add).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'groove', metric: 'present' }),
    )
  })

  it('writes a rule as its turning sentence', () => {
    renderList(fakeRules([grooveRule()]))
    expect(screen.getByRole('button', { name: 'Features: Grooves' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Measure: groove width' })).toBeInTheDocument()
  })

  it('names a broken stretch by its turned type and the end it is cut from', () => {
    const rule = grooveRule()
    renderList(fakeRules([rule]), checkTurnedPart(stretches, [rule]))
    fireEvent.click(screen.getByRole('button', { name: /1 required feature breaks it/ }))
    const row = screen.getByRole('button', { name: /OD groove/ })
    expect(row).toHaveTextContent('OD groove')
    expect(row).toHaveTextContent('from the +Z end')
    expect(row).toHaveTextContent('1.2 mm')
  })

  describe('Export', () => {
    const { createObjectURL, revokeObjectURL } = URL
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:rules')
      URL.revokeObjectURL = vi.fn()
    })
    afterEach(() => {
      URL.createObjectURL = createObjectURL
      URL.revokeObjectURL = revokeObjectURL
      vi.restoreAllMocks()
    })

    it('downloads the rules as dfm-turning-rules.json, saying they are turning rules', async () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const rules = fakeRules([grooveRule()])
      renderList(rules)

      fireEvent.click(screen.getByRole('button', { name: /Export/ }))

      expect(click.mock.contexts[0]).toMatchObject({ download: 'dfm-turning-rules.json' })
      const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob
      expect(await blob.text()).toBe(serializeRuleSet(rules.rules, {}, TURNING_RULES))
    })
  })

  it('refuses a milling rule set on import', async () => {
    const rules = fakeRules([grooveRule()])
    renderList(rules)
    const file = new File([serializeRuleSet([makeRule('hole', 'ld', 'mm')])], 'rules.json', {
      type: 'application/json',
    })
    fireEvent.change(screen.getByLabelText('Rule set file'), { target: { files: [file] } })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'This is a milling rule set — import it in Milling mode.',
    )
    expect(rules.replace).not.toHaveBeenCalled()
  })
})
