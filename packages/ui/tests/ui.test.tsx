import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as ui from '../src'

describe('@toolpath/ui', () => {
  it('renders a primary button with its documented Tailwind utilities', () => {
    render(
      <ui.Button variant="primary" type="submit">
        Analyze part
      </ui.Button>,
    )

    const button = screen.getByRole('button', { name: 'Analyze part' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button.firstElementChild).toHaveClass('bg-primary')
  })

  it('renders icon-backed controls without exporting the icon library', () => {
    render(<ui.Checkbox checked={false} name="include-report" onChange={() => undefined} />)

    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect('CheckIcon' in ui).toBe(false)
    expect('icons' in ui).toBe(false)
    expect('ListItem' in ui).toBe(false)
  })

  /**
   * The press that got thrown away.
   *
   * A `click` is only dispatched when `mousedown` and `mouseup` land on the
   * same element. The button's inner surface used to be a component declared
   * inside `Button`, which makes it a new component *type* on every render — so
   * React unmounted the content subtree and mounted a fresh one, and any render
   * occurring mid-press replaced the element the pointer was over between the
   * two halves of the gesture. A hover handler on an ancestor is enough to
   * cause that render, which is why it looked intermittent.
   *
   * The button stayed in the tree, matched by role and name, and reported
   * enabled the whole time, so nothing in a test or in the types said anything
   * was wrong. It cost two long debugging sessions in the part viewer.
   *
   * Asserted as node identity rather than by firing a click, because
   * `fireEvent.click` dispatches the event straight at the element — jsdom does
   * not build a click out of `mousedown` and `mouseup`, so a click test passes
   * whether the surface was replaced or not. The identity is the thing the
   * browser actually cares about.
   */
  it('keeps the inner surface across a render, so a press is never split', () => {
    const Harness = ({ label }: { label: string }) => (
      <ui.Button variant="primary">{label}</ui.Button>
    )

    const { container, rerender } = render(<Harness label="Delete" />)
    const surface = container.querySelector('button')?.firstElementChild

    expect(surface).toBeTruthy()
    rerender(<Harness label="Delete again" />)

    expect(container.querySelector('button')?.firstElementChild).toBe(surface)
  })

  it('exports the advanced portable primitives', () => {
    expect(ui.Table).toBeDefined()
    expect(ui.Notification.Provider).toBeDefined()
    expect(ui.Dialog.Provider).toBeDefined()
    expect(ui.Panels.Group).toBeDefined()
  })
})
