// @vitest-environment jsdom
/** Page-icon reminder count: Badging API calls and shipped-icon restoration. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAttentionBadge } from '../src/client/favicon-badge.ts'

const setAppBadge = vi.fn(() => Promise.resolve())
const clearAppBadge = vi.fn(() => Promise.resolve())

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" href="/favicon.svg"><link rel="icon" href="/favicon-dark.svg">'
  Object.defineProperty(navigator, 'setAppBadge', { value: setAppBadge, configurable: true })
  Object.defineProperty(navigator, 'clearAppBadge', { value: clearAppBadge, configurable: true })
  // jsdom ships no 2D canvas; the badge keeps the shipped icon and still
  // reports the count through the Badging API.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null, configurable: true })
})

afterEach(() => {
  setAppBadge.mockClear()
  clearAppBadge.mockClear()
  Reflect.deleteProperty(navigator, 'setAppBadge')
  Reflect.deleteProperty(navigator, 'clearAppBadge')
  Reflect.deleteProperty(globalThis, 'dshDesktop')
})

/** Shipped icon hrefs in document order. */
function iconHrefs(): readonly string[] {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')].map(link => link.href)
}

describe('attention badge', () => {
  it('reports the count to the Badging API and keeps shipped icons without a canvas', () => {
    const original = iconHrefs()
    const badge = createAttentionBadge()
    badge.set(3)
    expect(setAppBadge).toHaveBeenCalledWith(3)
    expect(iconHrefs()).toEqual(original)
    badge.dispose()
  })

  it('clears the app badge and restores the shipped icons at zero', () => {
    const original = iconHrefs()
    const badge = createAttentionBadge()
    badge.set(2)
    badge.set(0)
    expect(clearAppBadge).toHaveBeenCalled()
    expect(iconHrefs()).toEqual(original)
    badge.dispose()
  })

  it('ignores counts after disposal', () => {
    const badge = createAttentionBadge()
    badge.dispose()
    setAppBadge.mockClear()
    badge.set(5)
    expect(setAppBadge).not.toHaveBeenCalled()
  })

  it('reports the count to the Desktop shell bridge', () => {
    const set = vi.fn(() => Promise.resolve())
    Object.defineProperty(globalThis, 'dshDesktop', { value: { badge: { set } }, configurable: true })
    const badge = createAttentionBadge()
    badge.set(4)
    expect(set).toHaveBeenCalledWith(4)
    badge.set(0)
    expect(set).toHaveBeenCalledWith(0)
    badge.dispose()
  })

  it('tolerates an environment without the Badging API', () => {
    Reflect.deleteProperty(navigator, 'setAppBadge')
    Reflect.deleteProperty(navigator, 'clearAppBadge')
    const badge = createAttentionBadge()
    expect(() => { badge.set(1); badge.set(0) }).not.toThrow()
    badge.dispose()
  })
})
