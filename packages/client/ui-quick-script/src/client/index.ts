/**
 * Quick-script launcher plugin, browser half: the play chip in
 * `conversation.input.right` (immediately before the model selector) and its
 * menu over the browser-local script catalog. Running a row opens a fresh
 * right-sidebar terminal and types the script's command into it; the panel
 * expands in the same step, so the output is visible without another gesture.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-terminal-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { QuickScriptMenu, type QuickScriptInjected } from './QuickScriptMenu.tsx'
import { runScriptInTerminal } from './terminal-run.ts'
import { NS, de, en, es, fr, ja, pt, ru, zh, type QuickScriptKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The quick-script menu's copy. */
    quickScript: QuickScriptKey
  }
}

/** Services this launcher binds: the composer seat, copy, and the terminal handoff. */
export const inject = ['slots', 'locale', 'sidebarRight', 'webTerminals']

/**
 * Register the play chip, its dictionaries, and the terminal handoff.
 * @param ctx - client root context with the composer seat and terminal services.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-quick-script: dictionaries')
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'quick-script',
    locale: NS,
    inject: (sessionId: SessionId): QuickScriptInjected => ({
      run: script => runScriptInTerminal(ctx, sessionId, script),
    }),
  }, QuickScriptMenu))
}

export type { QuickScriptInjected } from './QuickScriptMenu.tsx'
