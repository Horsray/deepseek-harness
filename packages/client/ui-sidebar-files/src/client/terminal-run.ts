/**
 * Type one file-tree row's command into a fresh right-Sidebar terminal.
 *
 * A fresh page per gesture keeps concurrent runs from sharing one stdin. The
 * command types itself once the shell attachment is writable; a terminal that
 * never mounts (a collapsed surface the Host refuses to reveal) drops its
 * subscription at the deadline instead of writing into a later Session's shell.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-terminal-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { terminalCommand, type FileRowKind } from './context-menu.ts'

/**
 * How long a newly opened terminal may take to report a writable attachment.
 * Matches the quick-script handoff: a terminal that never mounts drops its
 * subscription rather than writing into a later session by surprise.
 */
const CONNECT_TIMEOUT_MS = 30_000

/**
 * Open a terminal page and type one row's command into it once the shell is
 * attached.
 * @param ctx - client root context with the sidebar and terminal services.
 * @param sessionId - Session whose sidebar owns the new page.
 * @param path - absolute Host path of the row.
 * @param kind - whether the row is a directory.
 */
export function runInTerminal(ctx: Context, sessionId: SessionId, path: string, kind: FileRowKind): void {
  const before = new Set(ctx.sidebarRight.tabsIn(sessionId).map(tab => tab.id))
  ctx.sidebarRight.openTabIn(sessionId, 'terminal', {})
  const tab = ctx.sidebarRight.tabsIn(sessionId).find(candidate => !before.has(candidate.id))
  if (tab === undefined) return
  const view = ctx.webTerminals.view(sessionId, tab.id, tab.contentId)
  const line = `${terminalCommand(path, kind)}\r`
  const send = (): boolean => {
    const state = view.state.getSnapshot()
    if (state.phase !== 'connected' || !state.writable) return false
    view.write(line)
    return true
  }
  if (send()) return
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
}
