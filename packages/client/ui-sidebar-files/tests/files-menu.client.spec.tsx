// @vitest-environment jsdom
/**
 * The file tree's context menu: which gestures one row offers, and what each
 * one asks of the body that opened it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path'
import { fileTreeMenuEntries } from '../src/client/FileTreeMenu.tsx'
import type { FileTreeMenuProps } from '../src/client/FileTreeMenu.tsx'
import { zh } from '../src/client/locales.ts'
import type { DirLevel } from '../src/client/store.ts'
import { mountBody, ROOT, SESSION } from './mount.client.tsx'

const ROOT_LEVEL: DirLevel = {
  entries: [
    { name: 'README.md', type: 'file', size: 12 },
    { name: 'task.sh', type: 'file', size: 20 },
    { name: 'src', type: 'directory' },
  ],
  truncated: false,
}

afterEach(() => { cleanup() })

/** Mount a listed root. */
async function mountTree() {
  const mounted = mountBody()
  await act(() => mounted.script.watches.ready(ROOT))
  await act(() => mounted.script.settle({ ok: true, value: ROOT_LEVEL }))
  return mounted
}

/**
 * Right-click one listed row.
 * @param container - the rendered tree.
 * @param name - the basename of the row.
 */
function rightClick(container: HTMLElement, name: string): void {
  const row = container.querySelector(`[data-files-path="${ROOT}/${name}"] > button`)
  if (!(row instanceof HTMLElement)) throw new Error(`Missing row: ${name}`)
  fireEvent.contextMenu(row, { clientX: 40, clientY: 60 })
}

/**
 * Activate one menu row by its label.
 * @param label - the row's localized label.
 */
function choose(label: string): void {
  fireEvent.click(screen.getByRole('menuitem', { name: label }))
}

describe('fileTreeMenuEntries', () => {
  const t = makeTranslate(zh)
  const gestures = {
    open: () => {}, terminal: () => {}, copyPath: () => {}, reveal: () => {}, openInApp: () => {}, close: () => {},
  }
  const target = { path: `${ROOT}/task.sh`, parent: ROOT, name: 'task.sh', kind: 'file' as const, x: 0, y: 0 }

  /**
   * Entry ids of one menu.
   * @param overrides - props replacing the script row defaults.
   * @returns the ids in menu order, separators included as `separator`.
   */
  function ids(overrides: Partial<FileTreeMenuProps>): string[] {
    return fileTreeMenuEntries({ ...gestures, target, desktop: false, terminalAvailable: true, runnable: true, t, ...overrides })
      .map(entry => ('id' in entry ? entry.id : 'separator'))
  }

  it('offers open, run, copy path, and desktop gestures for a script row', () => {
    expect(ids({ desktop: true })).toEqual(['open', 'terminal', 'separator-copy', 'copyPath', 'reveal', 'openInApp'])
  })

  it('drops the terminal gesture without a terminal service', () => {
    expect(ids({ terminalAvailable: false })).not.toContain('terminal')
  })

  it('drops the run gesture for a file that is not a script', () => {
    expect(ids({ runnable: false })).not.toContain('terminal')
  })

  it('opens a directory in the terminal instead of running it', () => {
    const directory = { ...target, path: ROOT, parent: '/', name: 'app', kind: 'directory' as const }
    const entries = fileTreeMenuEntries({ ...gestures, target: directory, desktop: false, terminalAvailable: true, runnable: false, t })
    expect(entries.some(entry => 'id' in entry && entry.id === 'terminal')).toBe(true)
  })
})

describe('file tree row menu', () => {
  it('opens a file through the viewer claim', async () => {
    const { view, tabActions } = await mountTree()
    rightClick(view.container, 'README.md')
    choose(zh['menu.open'])
    expect(tabActions.openResource).toHaveBeenCalledWith(fileAddressFor(SESSION, ROOT, `${ROOT}/README.md`))
  })

  it('toggles a directory', async () => {
    const { view } = await mountTree()
    const row = () => view.container.querySelector(`[data-files-path="${ROOT}/src"] > button`)
    rightClick(view.container, 'src')
    choose(zh['menu.open'])
    expect(row()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('runs a script row in the terminal', async () => {
    const { view, menu } = await mountTree()
    rightClick(view.container, 'task.sh')
    choose(zh['menu.runInTerminal'])
    expect(menu.runInTerminal).toHaveBeenCalledWith(`${ROOT}/task.sh`, 'file')
  })

  it('opens a directory in the terminal', async () => {
    const { view, menu } = await mountTree()
    rightClick(view.container, 'src')
    choose(zh['menu.openInTerminal'])
    expect(menu.runInTerminal).toHaveBeenCalledWith(`${ROOT}/src`, 'directory')
  })

  it('offers no terminal row for an ordinary file', async () => {
    const { view } = await mountTree()
    rightClick(view.container, 'README.md')
    expect(screen.queryByRole('menuitem', { name: zh['menu.runInTerminal'] })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: zh['menu.openInTerminal'] })).toBeNull()
  })

  it('copies the row path', async () => {
    const { view, menu } = await mountTree()
    rightClick(view.container, 'README.md')
    choose(zh['menu.copyPath'])
    expect(menu.copyPath).toHaveBeenCalledWith(`${ROOT}/README.md`)
  })

  it('hides Host-desktop gestures until the desktop is available', async () => {
    const { view } = await mountTree()
    rightClick(view.container, 'README.md')
    expect(screen.queryByRole('menuitem', { name: zh['menu.reveal'] })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: zh['menu.openInApp'] })).toBeNull()
  })

  it('reveals and opens the row once the desktop is available', async () => {
    const { menu, desktop, remount } = await mountTree()
    desktop.set(true)
    cleanup()
    const next = remount()
    rightClick(next.container, 'README.md')
    choose(zh['menu.reveal'])
    expect(menu.reveal).toHaveBeenCalledWith(`${ROOT}/README.md`)
  })
})
