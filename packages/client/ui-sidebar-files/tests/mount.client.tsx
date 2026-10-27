/**
 * Mount the body over a real store instance and a scripted listing.
 *
 * The component reads a handful of its props; the rest of the standard kit is
 * framework-injected and never touched here, so one documented cast keeps the
 * harness to what is actually exercised.
 */
import { useSyncExternalStore } from 'react'
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { onTestFinished, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SidebarRightTabActions } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { filesFace } from '../src/client/face.ts'
import type { FilesInjected } from '../src/client/face.ts'
import { FilesBody } from '../src/client/FilesBody.tsx'
import type { FilesBodyProps } from '../src/client/FilesBody.tsx'
import { zh } from '../src/client/locales.ts'
import { createFilesStore } from '../src/client/store.ts'
import { scriptedList } from './scripted-list.client.ts'
import type { ScriptedList } from './scripted-list.client.ts'
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit'

export const SESSION = 's-test' as SessionId
export const ROOT = '/work/app'
export const TAB = 'tab-1' as TabId

/** Test-local selector hook over a framework-neutral store instance. */
function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot))
  }
}

/** A live instance of the tree's store, as the framework would mint one per session. */
type FilesStoreInstance = ReturnType<ReturnType<typeof createFilesStore>['create']>

/** The owner's tab actions as recording mocks. */
interface MockedTabActions {
  readonly bindCommands: Mock<SidebarRightTabActions['bindCommands']>
  readonly openResource: Mock<SidebarRightTabActions['openResource']>
  readonly openTab: Mock<SidebarRightTabActions['openTab']>
  readonly close: Mock<SidebarRightTabActions['close']>
}

/** What a spec holds after mounting: the rendered view and every hand on the tree. */
/** The row menu's gestures as recording mocks. */
export interface MockedRowMenu {
  readonly copyPath: Mock<(path: string) => void>
  readonly reveal: Mock<(path: string) => void>
  readonly openInApp: Mock<(path: string) => void>
  readonly runInTerminal: Mock<(path: string, kind: 'file' | 'directory') => void>
}

/** What a spec holds after mounting: the rendered view and every hand on the tree. */
export interface Mounted {
  readonly view: RenderResult
  readonly instance: FilesStoreInstance
  readonly script: ScriptedList
  readonly face: FilesInjected
  readonly controller: AbortController
  readonly tabActions: MockedTabActions
  readonly menu: MockedRowMenu
  /** Host desktop availability the body reads. */
  readonly desktop: SnapshotStore<boolean | null>
  /** Whether the terminal handoff is loaded. */
  readonly terminalReady: SnapshotStore<boolean>
  /** Ask for Host desktop availability, as the body does on mount. */
  readonly loadDesktop: Mock<() => Promise<void>>
  /** Render a fresh body over the same store and face, as a tab switch remounts it. */
  readonly remount: () => RenderResult
}

/** One store instance, one face, one owner share. */
function harness(cwd: string | null, refreshShortcut?: ReturnType<FilesBodyProps['useTabInfo']>['tab']['refreshShortcut']) {
  const instance = createFilesStore().create()
  const script = scriptedList()
  const face = filesFace(script.list, script.watch)(SESSION, instance.actions)
  const controller = new AbortController()
  onTestFinished(async () => {
    controller.abort()
    await script.dispose()
  })
  const tabActions: MockedTabActions = {
    bindCommands: vi.fn(() => vi.fn()),
    openResource: vi.fn<SidebarRightTabActions['openResource']>(),
    openTab: vi.fn<SidebarRightTabActions['openTab']>(),
    close: vi.fn<SidebarRightTabActions['close']>(),
  }
  const menu: MockedRowMenu = {
    copyPath: vi.fn<(path: string) => void>(),
    reveal: vi.fn<(path: string) => void>(),
    openInApp: vi.fn<(path: string) => void>(),
    runInTerminal: vi.fn<(path: string, kind: 'file' | 'directory') => void>(),
  }
  const desktop = createSnapshotStore<boolean | null>(null)
  const terminalReady = createSnapshotStore(true)
  const loadDesktop = vi.fn(async () => {})
  const sessions = { byId: cwd === null ? {} : { [SESSION]: { cwd } } } as unknown as SessionListState
  const shared = {
    // A page tab's address is the shell's to mint; the body never reads it.
    useTabInfo: () => ({
      sidebar: { expanded: true, fullscreen: false },
      panel: { id: 'pane-1' },
      tab: {
        id: TAB, kind: 'files', contentId: 'files', title: zh['type.label'], visible: true,
        navigation: { address: 'files', params: undefined, revision: 1 },
        signal: controller.signal,
        actions: tabActions, refreshShortcut,
      },
    }),
    renderSlot: () => null,
    sessionId: SESSION,
    usePathDesktop: <S,>(sel: (value: boolean | null) => S) => sel(desktop.getSnapshot()),
    useTerminalReady: <S,>(sel: (value: boolean) => S) => sel(terminalReady.getSnapshot()),
    loadDesktop,
    menu,
    useSessions: <S,>(sel: (s: SessionListState) => S) => sel(sessions),
    useStore: hookOf(instance),
    actions: instance.actions,
    ...face,
    t: makeTranslate(zh),
  }
  return { instance, script, face, controller, tabActions, menu, desktop, terminalReady, loadDesktop, shared }
}

/**
 * Mount the body.
 * @param cwd - the session's working directory as `useSessions` reports it; `null` for a session without one.
 * @param refreshShortcut - effective binding advertised by the tab owner.
 */
export function mountBody(cwd: string | null = ROOT, refreshShortcut?: ReturnType<FilesBodyProps['useTabInfo']>['tab']['refreshShortcut']): Mounted {
  const { shared, ...hands } = harness(cwd, refreshShortcut)
  const view = render(<FilesBody {...shared as unknown as FilesBodyProps} />)
  return { ...hands, view, remount: () => render(<FilesBody {...shared as unknown as FilesBodyProps} />) }
}
