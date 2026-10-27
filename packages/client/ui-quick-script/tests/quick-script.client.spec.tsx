// @vitest-environment jsdom
/**
 * Quick-script launcher: the browser-local catalog, the terminal handoff, and
 * the composer play menu rendered through the real slot runtime.
 */
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Context } from '@deepseek-ai/cordis'
import type { TerminalViewState } from '@deepseek-ai/dsh-api-terminal-controller/client'
import { apply as applyNode } from '../src/index.ts'
import { apply, inject } from '../src/client/index.ts'
import {
  addScript, loadScripts, removeScript, saveScripts, scriptCommand,
} from '../src/client/quick-script.ts'
import { cardPosition } from '../src/client/card-position.ts'
import { runScriptInTerminal } from '../src/client/terminal-run.ts'
import { de, en, es, fr, ja, NS, pt, ru, zh } from '../src/client/locales.ts'
import type { QuickScript } from '../src/client/quick-script.ts'

const STORAGE_KEY = 'dsh.quick-script.v1'
const SLOT = 'conversation.input.right'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** A saved script fixture. */
function saved(over: Partial<QuickScript> = {}): QuickScript {
  return { id: 's1', name: 'Release', path: '/Users/me/bin/release.sh', ...over }
}

/** Sidebar and terminal stubs plus the observations the assertions read. */
interface TerminalBench {
  readonly ctx: Context
  readonly sidebarRight: object
  readonly webTerminals: object
  readonly tabs: { id: string; kind: string; contentId: string; title: string }[]
  readonly opened: string[]
  readonly printed: string[]
  readonly state: ReturnType<typeof createSnapshotStore<TerminalViewState>>
  readonly disposers: (() => void)[]
  readonly dispose: () => void
}

/**
 * Provide the sidebar and terminal services the handoff binds.
 * @param options - `openTab: false` makes the sidebar refuse the new page.
 * @returns the stubbed services and their observations.
 */
function terminalBench(options: { openTab?: boolean } = {}): TerminalBench {
  const tabs: { id: string; kind: string; contentId: string; title: string }[] = []
  const opened: string[] = []
  const printed: string[] = []
  const state = createSnapshotStore<TerminalViewState>({ phase: 'idle', writable: false })
  const sidebarRight = {
    tabsIn: () => tabs,
    openTabIn: (_sessionId: SessionId, kind: string) => {
      opened.push(kind)
      if (options.openTab === false) return
      tabs.push({ id: `tab-${tabs.length + 1}`, kind, contentId: `content-${tabs.length + 1}`, title: 'release.sh' })
    },
  }
  const webTerminals = { view: () => ({ state, write: (data: string) => { printed.push(data) } }) }
  const disposers: (() => void)[] = []
  const ctx = {
    sidebarRight,
    webTerminals,
    effect: (fn: () => () => void) => { disposers.push(fn()) },
  } as unknown as Context
  const dispose = (): void => { for (const release of disposers.splice(0)) release() }
  return { ctx, sidebarRight, webTerminals, tabs, opened, printed, state, disposers, dispose }
}

/** Boot the browser half over the real slot tree. */
async function bench(terminals = terminalBench()): Promise<{
  host: SlotTestRuntime
  view: ReturnType<SlotTestRuntime['renderSlot']>
  terminals: TerminalBench
}> {
  const host = await SlotTestRuntime.create()
  onTestFinished(() => host.dispose())
  const locale = new LocaleRuntime(host.ctx)
  host.ctx.provide('locale', locale)
  host.slots.installLocale(locale)
  locale.setLocale('zh')
  host.ctx.provide('sidebarRight', terminals.sidebarRight as never)
  host.ctx.provide('webTerminals', terminals.webTerminals as never)
  await host.sessions.add({ id: SessionId('quick-script') })
  const session = host.sessions.retainFor(host.ctx, SessionId('quick-script'))
  await host.declare({ [SLOT]: { kind: 'list', scope: 'session' } })
  await host.mount({ inject, apply })
  const view = host.renderSlot(SLOT, {}, { session })
  return { host, view, terminals }
}

/** Open the menu from its trigger. */
function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: '快捷脚本' }))
}

describe('quick-script catalog', () => {
  it('reads nothing from an empty store and persists added entries', () => {
    expect(loadScripts()).toEqual([])
    const next = addScript([], 'Release', '/Users/me/bin/release.sh')
    saveScripts(next)
    expect(loadScripts()).toEqual(next)
  })

  it('drops entries whose fields do not survive a hand-edited store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([saved(), { id: 'nope' }, 'text', { id: '', name: 'x', path: 'y' }]))
    expect(loadScripts()).toEqual([saved()])
  })

  it('reads an unparsable or non-array value as empty', () => {
    localStorage.setItem(STORAGE_KEY, '{')
    expect(loadScripts()).toEqual([])
    localStorage.setItem(STORAGE_KEY, '{"id":"s1"}')
    expect(loadScripts()).toEqual([])
  })

  it('treats unavailable storage as an empty catalog and a silent save', () => {
    const original = globalThis.localStorage
    vi.stubGlobal('localStorage', undefined)
    try {
      expect(loadScripts()).toEqual([])
      expect(() => { saveScripts([saved()]) }).not.toThrow()
    } finally {
      vi.stubGlobal('localStorage', original)
    }
  })

  it('keeps the in-memory catalog when the browser refuses the write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    try {
      expect(() => { saveScripts([saved()]) }).not.toThrow()
    } finally {
      setItem.mockRestore()
    }
  })

  it('appends under a fresh id and removes by identity', () => {
    const first = addScript([], 'A', '/a.sh')
    const second = addScript(first, 'B', '/b.sh')
    expect(second.map(entry => entry.name)).toEqual(['A', 'B'])
    const [firstEntry, secondEntry] = second
    expect(firstEntry).toBeDefined()
    expect(secondEntry).toBeDefined()
    expect(firstEntry?.id).not.toBe(secondEntry?.id)
    expect(removeScript(second, firstEntry?.id ?? '')).toEqual([secondEntry])
  })
})

describe('scriptCommand', () => {
  it('switches to the script directory and runs it with bash', () => {
    expect(scriptCommand(saved())).toBe('cd "/Users/me/bin" && bash "/Users/me/bin/release.sh"')
  })

  it('escapes characters that would end the quoted path', () => {
    expect(scriptCommand(saved({ path: '/tmp/odd "name" $HOME `x` \\y.sh' })))
      .toBe('cd "/tmp" && bash "/tmp/odd \\"name\\" \\$HOME \\`x\\` \\\\y.sh"')
  })

  it('falls back to the filesystem root when the path names no directory', () => {
    expect(scriptCommand(saved({ path: 'release.sh' }))).toBe('cd "/" && bash "release.sh"')
    expect(scriptCommand(saved({ path: '/release.sh' }))).toBe('cd "/" && bash "/release.sh"')
  })
})

describe('runScriptInTerminal', () => {
  it('opens a terminal page and types the command once the shell is writable', () => {
    const terminals = terminalBench()
    expect(runScriptInTerminal(terminals.ctx, SessionId('s1'), saved())).toBe(true)
    expect(terminals.opened).toEqual(['terminal'])
    expect(terminals.printed).toEqual([])
    act(() => { terminals.state.set({ phase: 'connecting', writable: false }) })
    expect(terminals.printed).toEqual([])
    act(() => { terminals.state.set({ phase: 'connected', writable: true }) })
    expect(terminals.printed).toEqual(['cd "/Users/me/bin" && bash "/Users/me/bin/release.sh"\r'])
  })

  it('uses the page it just opened when earlier pages already exist', () => {
    const terminals = terminalBench()
    terminals.tabs.push({ id: 'older', kind: 'terminal', contentId: 'older-content', title: 'older' })
    expect(runScriptInTerminal(terminals.ctx, SessionId('s1'), saved())).toBe(true)
    act(() => { terminals.state.set({ phase: 'connected', writable: true }) })
    expect(terminals.printed).toHaveLength(1)
  })

  it('writes immediately when the page is already writable', () => {
    const terminals = terminalBench()
    terminals.state.set({ phase: 'connected', writable: true })
    expect(runScriptInTerminal(terminals.ctx, SessionId('s1'), saved())).toBe(true)
    expect(terminals.printed).toHaveLength(1)
  })

  it('reports no page when the sidebar refuses the new tab', () => {
    const terminals = terminalBench({ openTab: false })
    expect(runScriptInTerminal(terminals.ctx, SessionId('s1'), saved())).toBe(false)
    expect(terminals.printed).toEqual([])
  })

  it('releases the pending write with the plugin fiber', () => {
    vi.useFakeTimers()
    try {
      const terminals = terminalBench()
      expect(runScriptInTerminal(terminals.ctx, SessionId('s1'), saved())).toBe(true)
      terminals.dispose()
      act(() => { terminals.state.set({ phase: 'connected', writable: true }) })
      expect(terminals.printed).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops a connection that never becomes writable', () => {
    vi.useFakeTimers()
    try {
      const terminals = terminalBench()
      expect(runScriptInTerminal(terminals.ctx, SessionId('s1'), saved())).toBe(true)
      act(() => { vi.advanceTimersByTime(30_000) })
      act(() => { terminals.state.set({ phase: 'connected', writable: true }) })
      expect(terminals.printed).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('cardPosition', () => {
  const viewport = { width: 1000, height: 800 }

  it('sits above the trigger, right-aligned and clear of the viewport edges', () => {
    expect(cardPosition({ anchor: { right: 900, top: 700 }, size: { width: 200, height: 100 }, viewport }))
      .toEqual({ left: 700, top: 592 })
  })

  it('clamps a card that would leave the left edge or the top edge', () => {
    expect(cardPosition({ anchor: { right: 20, top: 50 }, size: { width: 200, height: 100 }, viewport }))
      .toEqual({ left: 12, top: 12 })
  })

  it('clamps a card that would leave the right edge', () => {
    expect(cardPosition({ anchor: { right: 995, top: 700 }, size: { width: 200, height: 100 }, viewport }))
      .toEqual({ left: 788, top: 592 })
  })

  it('keeps the unclamped offset before the card has laid out', () => {
    expect(cardPosition({ anchor: { right: 500, top: 700 }, size: { width: 0, height: 0 }, viewport }))
      .toEqual({ left: 500, top: 692 })
  })
})

describe('composer registration', () => {
  it('registers the play entry in the input-right seat and removes it with the fiber', async () => {
    const host = await SlotTestRuntime.create()
    onTestFinished(() => host.dispose())
    const locale = new LocaleRuntime(host.ctx)
    host.ctx.provide('locale', locale)
    host.slots.installLocale(locale)
    const terminals = terminalBench()
    host.ctx.provide('sidebarRight', terminals.sidebarRight as never)
    host.ctx.provide('webTerminals', terminals.webTerminals as never)
    await host.declare({ [SLOT]: { kind: 'list', scope: 'session' } })
    const fiber = await host.mount({ inject, apply })
    expect(host.slots.entries(SLOT).map(entry => entry.options.id)).toEqual(['quick-script'])
    await fiber.dispose()
    expect(host.slots.entries(SLOT)).toHaveLength(0)
  })

  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'sidebarRight', 'webTerminals'])
  })

  it('registers every dictionary under its namespace', async () => {
    const { host } = await bench()
    const translate = host.ctx.locale.bind(NS)
    host.ctx.locale.setLocale('zh')
    expect(translate('action.open')).toBe(zh['action.open'])
    host.ctx.locale.setLocale('en')
    expect(translate('action.open')).toBe(en['action.open'])
  })

  it('keeps every other dictionary key-identical to the Chinese source of truth', () => {
    const keys = Object.keys(zh).sort()
    for (const dictionary of [en, ja, es, fr, de, ru, pt]) {
      expect(Object.keys(dictionary).sort()).toEqual(keys)
    }
  })

  it('contributes no host behavior', () => {
    expect(applyNode).not.toThrow()
  })
})

describe('play menu', () => {
  it('opens from the trigger and shows the empty catalog', async () => {
    await bench()
    openMenu()
    expect(screen.getByRole('dialog', { name: '快捷脚本' }).textContent).toBe('暂无快捷脚本添加脚本')
  })

  it('lists saved scripts and runs one in a fresh terminal', async () => {
    saveScripts([saved(), saved({ id: 's2', name: 'Build', path: '/Users/me/bin/build.sh' })])
    const { terminals } = await bench()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Release' }))
    expect(terminals.opened).toEqual(['terminal'])
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => { terminals.state.set({ phase: 'connected', writable: true }) })
    expect(terminals.printed).toEqual(['cd "/Users/me/bin" && bash "/Users/me/bin/release.sh"\r'])
  })

  it('adds a script from the inline form and persists it', async () => {
    await bench()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: '添加脚本' }))
    fireEvent.change(screen.getByLabelText('脚本名称'), { target: { value: '  Deploy  ' } })
    fireEvent.change(screen.getByLabelText('脚本绝对路径'), { target: { value: ' /Users/me/bin/deploy.sh ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeTruthy()
    const stored = loadScripts()[0]
    expect(stored?.name).toBe('Deploy')
    expect(stored?.path).toBe('/Users/me/bin/deploy.sh')
  })

  it('rejects an incomplete form and cancels back to the add row', async () => {
    await bench()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: '添加脚本' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByRole('status').textContent).toBe('请填写脚本名称和绝对路径')
    fireEvent.change(screen.getByLabelText('脚本名称'), { target: { value: 'X' } })
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByRole('button', { name: '添加脚本' })).toBeTruthy()
  })

  it('deletes a saved script and persists the removal', async () => {
    saveScripts([saved()])
    await bench()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: '删除脚本' }))
    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull()
    expect(loadScripts()).toEqual([])
  })

  it('keeps the menu open and reports when no terminal can open', async () => {
    saveScripts([saved()])
    await bench(terminalBench({ openTab: false }))
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Release' }))
    expect(screen.getByRole('status').textContent).toBe('无法打开终端')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes on Escape and on an outside pointer press', async () => {
    await bench()
    openMenu()
    fireEvent.keyDown(screen.getByRole('button', { name: '快捷脚本' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    openMenu()
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ignores other keys and an Escape that arrives while the menu is closed', async () => {
    await bench()
    const trigger = screen.getByRole('button', { name: '快捷脚本' })
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    openMenu()
    fireEvent.keyDown(trigger, { key: 'a' })
    expect(screen.queryByRole('dialog')).toBeTruthy()
  })

  it('keeps the menu open for presses inside it and toggles closed from the trigger', async () => {
    saveScripts([saved()])
    await bench()
    openMenu()
    fireEvent.pointerDown(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '快捷脚本' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
