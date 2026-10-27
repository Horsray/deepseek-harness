// @vitest-environment jsdom
/** The conversation header's entry into the Workspace files tab. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { WorkspaceFilesButton } from '../src/client/WorkspaceFilesButton.tsx'
import type { WorkspaceFilesButtonProps } from '../src/client/WorkspaceFilesButton.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

/** The control mounted with a recording open gesture and real copy. */
function mount(open: () => void) {
  const props = { open, t: makeTranslate(zh) } as unknown as WorkspaceFilesButtonProps
  return render(<WorkspaceFilesButton {...props} />)
}

describe('WorkspaceFilesButton', () => {
  it('opens the files page from its icon control', () => {
    const open = vi.fn()
    mount(open)
    fireEvent.click(screen.getByRole('button', { name: zh['header.open'] }))
    expect(open).toHaveBeenCalledTimes(1)
  })
})
