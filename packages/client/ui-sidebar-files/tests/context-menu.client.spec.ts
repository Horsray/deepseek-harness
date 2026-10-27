/** Terminal commands the file tree's context menu builds for one row. */
import { describe, expect, it } from 'vitest'
import { isRunnableScript, parentDirectory, shellQuote, terminalCommand } from '../src/client/context-menu.ts'

describe('isRunnableScript', () => {
  it('accepts the script extensions a terminal runs', () => {
    expect(isRunnableScript('deploy.sh')).toBe(true)
    expect(isRunnableScript('tool.PY')).toBe(true)
    expect(isRunnableScript('release.command')).toBe(true)
  })

  it('refuses ordinary files and names without an extension', () => {
    expect(isRunnableScript('README.md')).toBe(false)
    expect(isRunnableScript('Makefile')).toBe(false)
    expect(isRunnableScript('.env')).toBe(false)
    expect(isRunnableScript('scripts.')).toBe(false)
  })
})

describe('shellQuote', () => {
  it('wraps a path in single quotes', () => {
    expect(shellQuote('/work/app')).toBe("'/work/app'")
  })

  it('escapes a quote embedded in the path', () => {
    expect(shellQuote("/work/it's")).toBe("'/work/it'\\''s'")
  })
})

describe('parentDirectory', () => {
  it('splits on either separator convention', () => {
    expect(parentDirectory('/work/app/a.sh')).toBe('/work/app')
    expect(parentDirectory('C:\\work\\a.sh')).toBe('C:\\work')
  })

  it('keeps the root for a path one segment below it', () => {
    expect(parentDirectory('/a.sh')).toBe('/')
  })

  it('keeps a path without a parent segment', () => {
    expect(parentDirectory('a.sh')).toBe('a.sh')
  })
})

describe('terminalCommand', () => {
  it('changes into a directory for a directory row', () => {
    expect(terminalCommand('/work/app', 'directory')).toBe("cd '/work/app'")
  })

  it('changes into the file\'s directory and runs a script row', () => {
    expect(terminalCommand('/work/app/task.sh', 'file')).toBe("cd '/work/app' && '/work/app/task.sh'")
  })
})
