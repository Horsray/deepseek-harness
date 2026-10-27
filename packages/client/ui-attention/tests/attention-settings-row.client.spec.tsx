// @vitest-environment jsdom
/** Reminder preference rows: toggles, timbre choice, and the preview button. */
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { allowAllAccess } from '@deepseek-ai/dsh-client-test-runtime'
import { AttentionSettingsRow } from '../src/client/AttentionSettingsRow.tsx'
import { DEFAULT_ATTENTION_SETTINGS, type AttentionSettings, type SoundPreset } from '../src/attention-settings.ts'
import { en } from '../src/client/locales.ts'
// Type-only: pulls the package's locale-namespace declaration into this program.
import type {} from '../src/client/index.ts'

afterEach(() => { cleanup() })

/** Interpolating stand-in for the bound locale function. */
const t = ((key: string, params?: Record<string, string | number>) => {
  const template = (en as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => `${params[name] ?? ''}`)
}) as never

const unusedHook = (() => { throw new Error('unused by the reminder rows') }) as never
const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })
const useSessionStatus: GlobalStandardProps['useSessionStatus'] = selector => selector(new Map())
const kit = {
  useSessions: unusedHook, useSessionStatus, usePanelInfo, useSessionRetainInfo: () => undefined, useWorkspaces: unusedHook,
  useResource, ...allowAllAccess,
}

/** Overrides for the rendered row props. */
interface RowOptions {
  settings?: AttentionSettings
  setToggle?: (field: string, value: boolean) => Promise<boolean>
  setPreset?: (preset: SoundPreset) => Promise<boolean>
  preview?: (preset?: SoundPreset) => void
}

/** Render the rows over one preference snapshot. */
function renderRows(options: RowOptions = {}) {
  const settings = options.settings ?? DEFAULT_ATTENTION_SETTINGS
  const setToggle = options.setToggle ?? vi.fn((_field: string, _value: boolean) => Promise.resolve(true))
  const setPreset = options.setPreset ?? vi.fn((_preset: SoundPreset) => Promise.resolve(true))
  const preview = options.preview ?? vi.fn((_preset?: SoundPreset) => {})
  render(<AttentionSettingsRow
    t={t}
    useSettings={selector => selector(settings)}
    setToggle={setToggle}
    setPreset={setPreset}
    preview={preview}
    {...kit}
  />)
  return { setToggle, setPreset, preview }
}

describe('attention settings rows', () => {
  it('renders one switch per reminder preference and the timbre chooser', () => {
    renderRows()
    expect(screen.getAllByRole('switch')).toHaveLength(4)
    expect(screen.getByText('Interaction reminders')).toBeTruthy()
    expect(screen.getByText('Chime')).toBeTruthy()
    expect(screen.getByText('Icon count')).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: 'Glass' }).getAttribute('aria-selected')).toBe('true')
  })

  it('writes the flipped value through the form', async () => {
    const { setToggle } = renderRows()
    fireEvent.click(screen.getByRole('switch', { name: 'Chime' }))
    await waitFor(() => { expect(setToggle).toHaveBeenCalledWith('soundEnabled', false) })
  })

  it('saves the chosen timbre and auditions it', async () => {
    const { setPreset, preview } = renderRows()
    fireEvent.click(screen.getByRole('tab', { name: 'Marimba' }))
    await waitFor(() => { expect(setPreset).toHaveBeenCalledWith('marimba') })
    await waitFor(() => { expect(preview).toHaveBeenCalledWith('marimba') })
  })

  it('shows the reminder on request', () => {
    const { preview } = renderRows()
    fireEvent.click(screen.getByRole('button', { name: 'Test reminder' }))
    expect(preview).toHaveBeenCalledTimes(1)
  })

  it('reports a rejected write', async () => {
    renderRows({ setToggle: vi.fn(() => Promise.resolve(false)) })
    fireEvent.click(screen.getByRole('switch', { name: 'Icon count' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('Could not save the setting') })
  })

  it('reports a failed write', async () => {
    renderRows({ setToggle: vi.fn(() => Promise.reject(new Error('offline'))) })
    fireEvent.click(screen.getByRole('switch', { name: 'Completion reminders' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('Could not save the setting') })
  })
})
