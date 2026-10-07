import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RuleList, ruleListKeys, type DfmRules } from '../../src/index.js'
import { PRESENCE_METRIC } from '../../src/model/dfm-metrics.js'
import { makeRule, type DfmRule } from '../../src/model/index.js'

const holes = (): DfmRule => makeRule('hole', PRESENCE_METRIC.key, 'mm')

const fakeRules = (rules: readonly DfmRule[]): DfmRules => ({
  rules,
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
})

/** The list in a panel that takes its keys, as an app holds it; the panel's own key spy alongside. */
const renderPanel = (rules: DfmRules) => {
  const panelKeys = vi.fn()
  const panelClicks = vi.fn()
  render(
    <div
      onKeyDown={(event) => {
        panelKeys(event.key)
        ruleListKeys(event)
      }}
      onClick={panelClicks}
    >
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
      />
    </div>,
  )
  return { panelKeys, panelClicks }
}

/** Lets the picker put the keyboard on an item, a frame after the menu draws. */
const nextFrame = () => act(() => new Promise((done) => requestAnimationFrame(() => done(null))))

const openWithClick = async (name: RegExp | string) => {
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.findByRole('menu')
}

describe('rule pickers', () => {
  it('shows each word as a button naming its field and its value', () => {
    renderPanel(fakeRules([holes()]))
    expect(screen.getByRole('button', { name: 'Features: Holes' })).toHaveTextContent('Holes')
    expect(screen.getByRole('button', { name: 'Measure: any size' })).toHaveTextContent('any size')
    expect(screen.getByRole('button', { name: 'New rule' })).toHaveTextContent('+ New Rule')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('sets the measure chosen, and closes', async () => {
    const rule = holes()
    const rules = fakeRules([rule])
    const { panelClicks } = renderPanel(rules)
    const menu = await openWithClick('Measure: any size')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'diameter' }))
    expect(rules.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: rule.id, metric: 'diameter' }),
    )
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(panelClicks).not.toHaveBeenCalled()
  })

  it('opens on the value it holds', async () => {
    renderPanel(fakeRules([holes()]))
    await openWithClick('Features: Holes')
    await nextFrame()
    expect(document.activeElement).toHaveAccessibleName('Holes')
  })

  it('lists the rest in place for "More measures…", the menu still open', async () => {
    const rules = fakeRules([holes()])
    renderPanel(rules)
    const menu = await openWithClick('Measure: any size')
    expect(within(menu).queryByRole('group', { name: 'Size and depth' })).toBeNull()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'More measures…' }))
    await nextFrame()
    const open = screen.getByRole('menu')
    expect(within(open).queryByRole('menuitem', { name: 'More measures…' })).toBeNull()
    expect(within(open).getByRole('group', { name: 'Size and depth' })).toBeInTheDocument()
    // The keyboard is on the first of the rest, and nothing was chosen by asking.
    expect(document.activeElement?.closest('[role="group"]')).toHaveAccessibleName('Size and depth')
    expect(rules.update).not.toHaveBeenCalled()
  })

  it('makes a new rule of the features chosen, from the full list too', async () => {
    const rules = fakeRules([])
    renderPanel(rules)
    let menu = await openWithClick('New rule')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'More feature types…' }))
    menu = screen.getByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Blind holes' }))
    expect(rules.add).toHaveBeenCalledWith(expect.objectContaining({ subject: 'type:blind_hole' }))
  })

  it('leaves a range by a one-sided comparison', async () => {
    const rule: DfmRule = { ...makeRule('hole', 'diameter', 'mm'), op: 'between', max: 20 }
    const rules = fakeRules([rule])
    renderPanel(rules)
    const menu = await openWithClick(/^Low end/)
    expect(within(menu).getByRole('group', { name: 'Range' })).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('menuitem', { name: '≥ at least' }))
    expect(rules.update).toHaveBeenCalledWith(expect.objectContaining({ op: 'gte' }))
    expect(rules.update).not.toHaveBeenCalledWith(expect.objectContaining({ op: 'between' }))
  })

  describe('by the keyboard', () => {
    it('opens on an arrow, walks with the arrows and chooses with Enter', async () => {
      const rule = holes()
      const rules = fakeRules([rule])
      const { panelKeys } = renderPanel(rules)
      const trigger = screen.getByRole('button', { name: 'Features: Holes' })
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      await screen.findByRole('menu')
      await nextFrame()
      expect(document.activeElement).toHaveAccessibleName('Holes')
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
      await waitFor(() => expect(document.activeElement).toHaveAccessibleName('Threaded holes'))
      fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
      expect(rules.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: rule.id, subject: 'threadedHole' }),
      )
      // None of the menu's keys reached the panel: the rule list's own arrows never moved.
      expect(panelKeys).not.toHaveBeenCalledWith('ArrowDown')
      expect(panelKeys).not.toHaveBeenCalledWith('Enter')
    })

    it('shuts on Escape, back on its word, without the panel seeing the key', async () => {
      const { panelKeys } = renderPanel(fakeRules([holes()]))
      const menu = await openWithClick('Measure: any size')
      await nextFrame()
      fireEvent.keyDown(document.activeElement ?? menu, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(panelKeys).not.toHaveBeenCalledWith('Escape')
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: 'Measure: any size' }),
        ),
      )
    })

    it('reaches "More…" and lists the rest by Enter', async () => {
      renderPanel(fakeRules([holes()]))
      await openWithClick('Measure: any size')
      await nextFrame()
      fireEvent.keyDown(document.activeElement!, { key: 'End' })
      await waitFor(() => expect(document.activeElement).toHaveAccessibleName('More measures…'))
      fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
      await nextFrame()
      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(document.activeElement?.closest('[role="group"]')).toHaveAccessibleName(
        'Size and depth',
      )
    })
  })
})
