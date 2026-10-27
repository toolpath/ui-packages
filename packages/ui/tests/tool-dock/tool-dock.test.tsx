import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolDock, type DockGroup, type DockTool } from '../../src'

const tool = (id: string, extra: Partial<DockTool> = {}): DockTool => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  note: `What ${id} does`,
  icon: <svg />,
  onClick: () => {},
  ...extra,
})

/** Tools that flip themselves, as an app's controls would. */
const Harness = (props: Omit<Parameters<typeof ToolDock>[0], 'groups'>) => {
  const [on, setOn] = useState<Record<string, boolean>>({ grid: true, axes: false })
  const flip = (id: string) => () => setOn((was) => ({ ...was, [id]: !was[id] }))
  const groups: Array<DockGroup> = [
    {
      id: 'scene',
      label: 'Scene',
      title: 'Show around the part',
      tools: [
        tool('grid', { on: on.grid, onClick: flip('grid') }),
        tool('axes', { on: on.axes, onClick: flip('axes') }),
      ],
    },
    { id: 'tools', label: 'Tools', tools: [tool('measure', { on: false })] },
    { id: 'view', label: 'View', tools: [tool('fit')] },
  ]
  return <ToolDock groups={groups} {...props} />
}

describe('ToolDock', () => {
  it('opens spread, with the pinned tools on the bar and the rest under All tools', () => {
    render(<Harness defaultPins={['grid']} />)
    const bar = screen.getByRole('group', { name: 'Tools' })

    expect(bar).toHaveAttribute('data-layout', 'spread')
    expect(within(bar).getByRole('button', { name: 'Grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(bar).queryByRole('button', { name: 'Axes' })).toBeNull()
    expect(within(bar).getByRole('button', { name: 'All tools' })).toBeInTheDocument()
  })

  it('opens in the layout the app asks for, with the pinned tools beside the menus', () => {
    render(<Harness defaultLayout="grouped" defaultPins={['measure']} />)
    const bar = screen.getByRole('group', { name: 'Tools' })

    expect(bar).toHaveAttribute('data-layout', 'grouped')
    expect(within(bar).getByRole('button', { name: 'Scene' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Tools' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Measure' })).toBeInTheDocument()
    expect(within(bar).queryByRole('button', { name: 'Grid' })).toBeNull()
    expect(within(bar).queryByRole('button', { name: 'All tools' })).toBeNull()
  })

  it('pins and unpins a tool from its menu, which stays open, and leaves the tool alone', async () => {
    const onPinsChange = vi.fn()
    render(<Harness defaultLayout="grouped" defaultPins={['grid']} onPinsChange={onPinsChange} />)
    const bar = screen.getByRole('group', { name: 'Tools' })
    const scene = within(bar).getByRole('button', { name: 'Scene' })

    fireEvent.click(scene)
    const unpin = await screen.findByRole('menuitemcheckbox', { name: 'Pin Grid to the bar' })
    expect(unpin).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(unpin)
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Pin Axes to the bar' }))

    expect(onPinsChange).toHaveBeenNthCalledWith(1, [])
    expect(onPinsChange).toHaveBeenNthCalledWith(2, ['axes'])
    expect(within(bar).queryByRole('button', { name: 'Grid' })).toBeNull()
    expect(within(bar).getByRole('button', { name: 'Axes' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemcheckbox', { name: 'Grid' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(scene).toHaveAttribute('aria-expanded', 'true')
  })

  it('reaches a pin in a menu with the arrow keys', async () => {
    const onPinsChange = vi.fn()
    render(<Harness defaultLayout="grouped" onPinsChange={onPinsChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
    const grid = await screen.findByRole('menuitemcheckbox', { name: 'Grid' })
    grid.focus()
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    const pin = screen.getByRole('menuitemcheckbox', { name: 'Pin Grid to the bar' })
    await waitFor(() => expect(pin).toHaveFocus())
    fireEvent.keyDown(pin, { key: 'Enter' })

    expect(onPinsChange).toHaveBeenCalledExactlyOnceWith(['grid'])
  })

  it('keeps a menu open for a switch, and closes it for an action', async () => {
    render(<Harness defaultLayout="grouped" />)

    fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Axes' }))

    expect(screen.getByRole('menuitemcheckbox', { name: 'Axes' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Fit' }))

    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Fit' })).toBeNull())
  })

  it('pins a tool from All tools, and tells the app', () => {
    const onPinsChange = vi.fn()
    render(<Harness onPinsChange={onPinsChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'All tools' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin Axes to the bar' }))

    expect(onPinsChange).toHaveBeenCalledWith(['axes'])
    expect(
      within(screen.getByRole('group', { name: 'Tools' })).getByRole('button', { name: 'Axes' }),
    ).toBeInTheDocument()
  })

  it('flips a switch in All tools and keeps the panel open', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'All tools' }))
    const axes = screen.getByRole('switch', { name: 'Axes' })
    fireEvent.click(axes)

    expect(screen.getByRole('switch', { name: 'Axes' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('dialog', { name: 'All tools' })).toBeInTheDocument()
  })

  it('keeps All tools tied to its button, though it centers on the bar', () => {
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'All tools' })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute(
      'aria-controls',
      screen.getByRole('dialog', { name: 'All tools' }).id,
    )
  })

  it('takes a pin off from All tools', () => {
    render(<Harness defaultPins={['grid', 'fit']} />)

    fireEvent.click(screen.getByRole('button', { name: 'All tools' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin Grid to the bar' }))

    const bar = screen.getByRole('group', { name: 'Tools' })
    expect(within(bar).queryByRole('button', { name: 'Grid' })).toBeNull()
    expect(within(bar).getByRole('button', { name: 'Fit' })).toBeInTheDocument()
  })

  it('keeps a row in All tools to one line, its line read out but not shown', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'All tools' }))
    const grid = screen.getByRole('switch', { name: 'Grid' })

    expect(grid).toHaveAccessibleDescription('What grid does')
    expect(within(grid).getByText('What grid does')).not.toBeVisible()
  })

  it('describes a bar button with its line', () => {
    render(<Harness defaultPins={['grid']} />)

    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAccessibleDescription(
      'What grid does',
    )
  })

  it('stays dark in a light page, for the kit controls among its children too', () => {
    render(<Harness />)

    expect(screen.getByRole('group', { name: 'Tools' })).toHaveClass('dark')
  })

  it('keeps its menus and the All tools panel dark too, though they open outside the bar', async () => {
    const { unmount } = render(<Harness defaultLayout="grouped" />)
    fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
    expect(await screen.findByRole('menu')).toHaveClass('dark')
    unmount()

    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'All tools' }))
    expect(await screen.findByRole('dialog', { name: 'All tools' })).toHaveClass('dark')
  })

  it("shows a bar button's tooltip on the bar's own plate, outside the bar", async () => {
    render(<Harness defaultPins={['grid']} />)

    const trigger = screen.getByRole('button', { name: 'Grid' }).parentElement!
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' })
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseMove(trigger)

    // The tip's popup, which Base UI marks with its side.
    const popup = await waitFor(() => {
      const tip = screen.getAllByText('Grid').find((node) => !node.closest('button'))
      expect(tip).toBeDefined()
      return tip!.closest<HTMLElement>('[data-side]')!
    })
    expect(popup).toHaveClass('bg-zinc-950/90')
    expect(popup).not.toHaveClass('bg-gray-800/90')
    expect(screen.getByRole('group', { name: 'Tools' })).not.toContainElement(popup)
  })

  it('switches layout from a LayoutToggle among its children', () => {
    const onLayoutChange = vi.fn()
    render(
      <Harness onLayoutChange={onLayoutChange}>
        <ToolDock.LayoutToggle />
      </Harness>,
    )

    // A track darker than the menu it sits in, not the kit's own, which is the menu's color.
    expect(screen.getByRole('switch', { name: 'Toolbar layout' })).toHaveClass('dark:bg-zinc-950')
    expect(screen.getByRole('switch', { name: 'Toolbar layout' })).not.toHaveClass(
      'dark:bg-zinc-900',
    )
    // The bar's focus ring, not the kit's blue one.
    expect(screen.getByRole('switch', { name: 'Toolbar layout' })).toHaveClass(
      'focus-visible:ring-zinc-300',
    )
    expect(screen.getByRole('switch', { name: 'Toolbar layout' })).not.toHaveClass(
      'focus-visible:ring-info/75',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Grouped' }))

    expect(onLayoutChange).toHaveBeenCalledWith('grouped')
    expect(screen.getByRole('group', { name: 'Tools' })).toHaveAttribute('data-layout', 'grouped')
  })

  it('follows the layout and pins the app holds, the same pins in either layout', () => {
    const { rerender } = render(<Harness layout="spread" pins={['fit']} />)
    expect(
      within(screen.getByRole('group', { name: 'Tools' })).getByRole('button', { name: 'Fit' }),
    ).toBeInTheDocument()

    rerender(<Harness layout="grouped" pins={['fit']} />)

    expect(screen.getByRole('group', { name: 'Tools' })).toHaveAttribute('data-layout', 'grouped')
    expect(
      within(screen.getByRole('group', { name: 'Tools' })).getByRole('button', { name: 'Fit' }),
    ).toBeInTheDocument()
  })

  it('shows why a gated tool waits, and still calls its click', () => {
    const onClick = vi.fn()
    render(
      <ToolDock
        defaultPins={['hover']}
        groups={[
          {
            id: 'dfm',
            label: 'DFM',
            tools: [tool('hover', { on: false, gate: 'Waits for the DFM check', onClick })],
          },
        ]}
      />,
    )
    const hover = within(screen.getByRole('group', { name: 'Tools' })).getByRole('button', {
      name: 'Hover',
    })

    fireEvent.click(hover)

    expect(onClick).toHaveBeenCalledOnce()
    expect(hover).not.toHaveAttribute('aria-pressed')
    expect(hover).toHaveAttribute('data-gated', 'true')
  })
})
