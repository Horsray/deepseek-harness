// @vitest-environment jsdom
/** Reminder banner rendering: one sentence per category, nothing while idle. */
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { allowAllAccess } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { AttentionToast } from '../src/client/AttentionToast.tsx'
import type { AttentionNotice } from '../src/client/attention-store.ts'
import { en } from '../src/client/locales.ts'
// Type-only: pulls the package's locale-namespace declaration into this program.
import type {} from '../src/client/index.ts'

afterEach(() => { cleanup() })

const sessionId = 'attention-toast-session' as SessionId

/** Interpolating stand-in for the bound locale function. */
const t = ((key: string, params?: Record<string, string | number>) => {
  const template = (en as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => `${params[name] ?? ''}`)
}) as never

const unusedHook = (() => { throw new Error('unused by the reminder banner') }) as never
const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })
const useSessionStatus: GlobalStandardProps['useSessionStatus'] = selector => selector(new Map())
const kit = {
  useSessions: unusedHook, useSessionStatus, usePanelInfo, useSessionRetainInfo: () => undefined, useWorkspaces: unusedHook,
  useResource, ...allowAllAccess,
}

/** Render the banner over one notice. */
function renderNotice(notice: AttentionNotice | null, dismiss = vi.fn()): void {
  render(<AttentionToast
    t={t}
    useNotice={selector => selector(notice)}
    dismiss={dismiss}
    {...kit}
  />)
}

describe('attention toast', () => {
  it('renders nothing while the queue is empty', () => {
    renderNotice(null)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('names the asking Session for every interaction category', () => {
    for (const [kind, sentence] of [
      ['approval', 'Refund is waiting for approval'],
      ['plan-review', 'Refund is waiting for plan review'],
      ['question', 'Refund is waiting for your answer'],
    ] as const) {
      renderNotice({ seq: 1, sessionId, title: 'Refund', kind })
      expect(screen.getByRole('alert').textContent).toContain(sentence)
      cleanup()
    }
  })

  it('announces a finished background Session', () => {
    renderNotice({ seq: 2, sessionId, title: 'Refund', kind: 'completion' })
    expect(screen.getByRole('alert').textContent).toContain('Refund finished')
  })
})
