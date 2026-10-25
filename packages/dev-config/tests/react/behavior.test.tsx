// @vitest-environment jsdom
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { inspectCompiledOutput } from '../../src/react/compiler.js'
import { COUNTER_SOURCE, createTestProject } from './project.js'

const project = createTestProject({ adapter: 'babel' })
const builder = join(dirname(fileURLToPath(import.meta.url)), 'build-component.mjs')

afterEach(() => {
  cleanup()
})

afterAll(() => {
  project.remove()
})

/**
 * The same component built two ways: with React Compiler and without. One
 * behaviour suite runs against both, so compiled output is held to the
 * component's contract rather than to a second set of assertions.
 */
const build = async (
  variant: 'compiled' | 'uncompiled',
): Promise<ComponentType<{ label: string }>> => {
  const code = execFileSync(
    process.execPath,
    [builder, project.directory, join(project.directory, `Counter.${variant}.tsx`), variant],
    { input: COUNTER_SOURCE, encoding: 'utf8' },
  )
  expect(inspectCompiledOutput(code).compiled).toBe(variant === 'compiled')
  const output = join(project.directory, `Counter.${variant}.mjs`)
  writeFileSync(output, code)
  const module = (await import(pathToFileURL(output).href)) as {
    Counter: ComponentType<{ label: string }>
  }
  return module.Counter
}

describe.each(['compiled', 'uncompiled'] as const)('Counter (%s)', (variant) => {
  it('counts presses', async () => {
    const Counter = await build(variant)
    const user = userEvent.setup()
    render(<Counter label="Presses" />)
    const button = screen.getByRole('button', { name: 'Presses: 0' })
    await user.click(button)
    await user.click(button)
    expect(screen.getByRole('button').textContent).toBe('Presses: 2')
  })

  it('shows a new label without losing the count', async () => {
    const Counter = await build(variant)
    const user = userEvent.setup()
    const { rerender } = render(<Counter label="Presses" />)
    await user.click(screen.getByRole('button'))
    rerender(<Counter label="Clicks" />)
    expect(screen.getByRole('button').textContent).toBe('Clicks: 1')
  })
})
