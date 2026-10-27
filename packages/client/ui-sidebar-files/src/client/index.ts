/**
 * Browser half: register `files` as a right-Sidebar tab type.
 *
 * The public two-stage path, unmodified: the type into `ctx.sidebarRightTabs`,
 * the body into the keyed `sidebar.right.pane.tab` seat and the chip title into
 * the keyed `sidebar.right.pane.tab.title` seat, both under the type's `id`.
 *
 * The panel also has a second entrance: one icon in the conversation header's
 * utilities, registered here, opens (or reveals) the same page. The tree's rows
 * answer a right-click with `FileTreeMenu`, whose Host gestures are bound here:
 * native application opens from the Session Remote, terminal handoff from the
 * optional terminal service, and path copying from the browser clipboard.
 *
 * The file split is this package's layering: what the type IS
 * (`definition.tsx`), what it keeps (`store.ts`), how it lists (`face.ts`), what
 * it draws (`FilesBody.tsx`, `FilesTitle.tsx`), what it says (`locales.ts`),
 * and this module, which only wires them together.
 */
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote'
import type {} from '@deepseek-ai/dsh-api-terminal-controller/client'
import type { BoundActions, SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { FILES_ID, filesDefinition } from './definition.tsx'
import { createList, createWatch, filesFace } from './face.ts'
import type { SessionOpenWorkspacePathRequest } from '@deepseek-ai/dsh-api-session-controller/types'
import type { FilesInjected } from './face.ts'
import { FilesBody } from './FilesBody.tsx'
import type { FilesMenuInjected } from './FilesBody.tsx'
import { FilesTitle } from './FilesTitle.tsx'
import type { FileRowKind } from './context-menu.ts'
import { runInTerminal } from './terminal-run.ts'
import { WorkspaceFilesButton } from './WorkspaceFilesButton.tsx'
import type { WorkspaceFilesButtonInjected } from './WorkspaceFilesButton.tsx'
import { en, ja, es, fr, de, ru, pt, zh } from './locales.ts'
import { createFilesStore } from './store.ts'

export type { SidebarFilesKey } from './locales.ts'
export type { DirLevel, FilesState, FilesTabState, LevelState } from './store.ts'
export type { FilesInjected, ListWorkspaceDirectory, WorkspaceFilesListRemote } from './face.ts'
export type { FilesBodyProps } from './FilesBody.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Workspace directory actions after the file tree's reload control. */
    'sidebar.right.tab.files.actions': {
      kind: 'list'
      scope: 'session'
      owner: {
        /** Absolute directory path displayed by the file tree. */
        readonly absolutePath: string
      }
    }
  }
}

/** This package's copy namespace. */
const NS = 'sidebarFiles'

/**
 * Required browser services: the tab registry, the keyed seat, the Remote
 * carrier and its namespaces, and copy. The terminal service is optional: its
 * absence hides the run gesture instead of blocking the panel.
 */
export const inject = [
  'slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'remote', 'remote.workspaceFiles', 'remote.session',
]

/**
 * Client plugin body: register the type, its dictionaries, its body, and its chip title.
 * @param ctx - client root context carrying the registry, the slots, and the Remote face.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.inject(['shortcuts'], (ctx) => {
    ctx.effect(() => ctx.shortcuts.register({
      id: 'workspace.files' as ShortcutCommandId, label: () => t('guide.title'), aliases: ['workspace files', 'files'],
      defaults: {
        'desktop:macos': { code: 'KeyP', modifiers: ['primary'] },
        'desktop:windows': { code: 'KeyP', modifiers: ['primary'] },
        'desktop:linux': { code: 'KeyP', modifiers: ['primary'] },
        'web:macos': { code: 'KeyP', modifiers: ['primary', 'alt'] },
        'web:windows': { code: 'KeyP', modifiers: ['primary', 'alt'] },
      },
      // Each tab plugin owns its command's availability, localized refusal, and tab kind.
      /* jscpd:ignore-start */
      regions: ['page', 'editable', 'terminal'], modals: [],
      resolve: ({ target: element }) => {
        const target = ctx.sidebarRight.commandTarget(element)
        if (target === undefined) return { status: 'blocked', reason: t('shortcut.noSession') }
        return { status: 'handled', run: () => { ctx.sidebarRight.openTabFromTarget('files', target) } }
      },
      /* jscpd:ignore-end */
    }), 'ui-sidebar-files: shortcut')
  })
  ctx.effect(() => ctx.sidebarRightTabs.register(filesDefinition(t)), 'ui-sidebar-files: files type')
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-sidebar-files: dictionaries')

  const store = createFilesStore()
  const treeFace = filesFace(createList(ctx.remote), createWatch(ctx.remote))

  // Native path gestures: availability is asked once per page, and each menu
  // gesture hands an absolute path to the Session Remote.
  const pathDesktop: SnapshotStore<boolean | null> = createSnapshotStore<boolean | null>(null)
  let asked: Promise<void> | undefined
  const loadDesktop = (): Promise<void> => {
    asked ??= ctx.remote.session.canOpenWorkspacePath().then(
      (result) => { pathDesktop.set(result.ok && result.value) },
      () => { pathDesktop.set(false) },
    )
    return asked
  }
  /** Hand one row's absolute path to the Host desktop; an omitted action means the default application. */
  const openPath = (path: string, action: 'open' | 'reveal'): void => {
    // The wire request accepts `action` only as `'reveal'`; narrowing here
    // keeps the default-open branch free of the optional field.
    const request = action === 'reveal'
      ? ({ path, action: 'reveal' } satisfies SessionOpenWorkspacePathRequest)
      : ({ path } satisfies SessionOpenWorkspacePathRequest)
    void ctx.remote.session.openWorkspacePath(request).catch(() => {})
  }

  // Terminal handoff is optional so a profile without the terminal plugin keeps
  // the panel; the menu drops the run gesture while it is absent.
  const terminalReady = createSnapshotStore(false)
  let runPathInTerminal: ((sessionId: SessionId, path: string, kind: FileRowKind) => void) | undefined
  ctx.inject(['webTerminals'], (ctx) => {
    runPathInTerminal = (sessionId, path, kind) => { runInTerminal(ctx, sessionId, path, kind) }
    terminalReady.set(true)
    ctx.effect(() => () => {
      runPathInTerminal = undefined
      terminalReady.set(false)
    }, 'ui-sidebar-files: terminal handoff')
  })
  const menuFace = (sessionId: SessionId): FilesMenuInjected => ({
    hooks: { pathDesktop, terminalReady },
    loadDesktop,
    menu: {
      copyPath: (path) => { void writeClipboard(path) },
      reveal: (path) => { openPath(path, 'reveal') },
      openInApp: (path) => { openPath(path, 'open') },
      runInTerminal: (path, kind) => { runPathInTerminal?.(sessionId, path, kind) },
    },
  })
  const inject = (
    sessionId: SessionId,
    actions: BoundActions<ReturnType<typeof createFilesStore>>,
  ): FilesInjected & FilesMenuInjected => ({
    ...treeFace(sessionId, actions),
    ...menuFace(sessionId),
  })

  // The conversation header's second entrance: the same `files` page the
  // sidebar's guide and shortcut open, so there is one tab however the reader
  // arrives.
  ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'workspace-files',
    order: 3,
    locale: NS,
    inject: (): WorkspaceFilesButtonInjected => ({
      open: () => { ctx.sidebarRight.openTab('files') },
    }),
  }, WorkspaceFilesButton)), 'ui-sidebar-files: header control')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    {
      name: 'sidebar.right.pane.tab', key: FILES_ID, locale: NS, store, inject,
      children: { 'sidebar.right.tab.files.actions': { kind: 'list', scope: 'session' } },
    },
    FilesBody,
  )), 'ui-sidebar-files: files tab body')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: FILES_ID },
    FilesTitle,
  )), 'ui-sidebar-files: files tab title')
}
