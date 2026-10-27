/** Run one saved script in a fresh right-sidebar terminal. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-terminal-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { scriptCommand, type QuickScript } from './quick-script.ts'

/**
 * How long a newly opened terminal may take to report a writable attachment.
 * A terminal that never mounts (a collapsed surface the Host refuses to reveal)
 * drops its subscription instead of writing into a later session by surprise.
 */
const CONNECT_TIMEOUT_MS = 30_000

/**
 * Open a terminal page and type the script's command into it once the shell is
 * attached. A fresh page per run keeps concurrent scripts from sharing one
 * stdin, matching the launcher's per-script terminal model.
 * @param ctx - client root context with the sidebar and terminal services.
 * @param sessionId - Session whose sidebar owns the new page.
 * @param script - the saved script to run.
 * @returns whether a terminal page was opened.
 */
export function runScriptInTerminal(ctx: Context, sessionId: SessionId, script: QuickScript): boolean {
  const before = new Set(ctx.sidebarRight.tabsIn(sessionId).map(tab => tab.id))
  ctx.sidebarRight.openTabIn(sessionId, 'terminal', {})
  const tab = ctx.sidebarRight.tabsIn(sessionId).find(candidate => !before.has(candidate.id))
  if (tab === undefined) return false
  const view = ctx.webTerminals.view(sessionId, tab.id, tab.contentId)
  const line = `${scriptCommand(script)}\r`
  const send = (): boolean => {
    const state = view.state.getSnapshot()
    if (state.phase !== 'connected' || !state.writable) return false
    view.write(line)
    return true
  }
  if (send()) return true
  // The pending write outlives this call; the deadline and the page's
  // subscription are released together when the shell attaches, the deadline
  // fires, or the plugin fiber unloads.
  const timer = setTimeout(() => { stop() }, CONNECT_TIMEOUT_MS)
  const stop = view.state.subscribe(() => {
    if (!send()) return
    stop()
    clearTimeout(timer)
  })
  ctx.effect(() => () => {
    stop()
    clearTimeout(timer)
  })
  return true
}
