import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BananaButton } from '../src'

describe('BananaButton', () => {
  afterEach(cleanup)

  it('names and exposes its shown state to assistive technology', () => {
    const { rerender } = render(<BananaButton shown onClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Banana for scale (on)' })).toHaveAttribute(
      'data-toggled',
      'true',
    )

    rerender(<BananaButton shown={false} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Banana for scale' })).not.toHaveAttribute(
      'data-toggled',
    )
  })
})
