/**
 * Page-icon reminder count.
 *
 * The shell ships two SVG favicons (light and dark media queries). A count
 * paints a red circle with the number over each of them and swaps the
 * `href` for a generated data URL; reaching zero restores the shipped icons.
 * The Badging API is asked in parallel so an installed app shows the count on
 * its own icon — the browser ignores that request where it has no such icon.
 */

/** Reminder count published to the page icon. */
export interface AttentionBadge {
  /**
   * Show a count, or restore the shipped icons when it drops to zero.
   * @param count - unacknowledged reminders to display.
   */
  set(count: number): void
  /** Restore the shipped icons and clear the app badge. */
  dispose(): void
}

/** Installed-app badge operations, absent in browsers without the API. */
interface BadgeNavigator {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Desktop shell badge bridge, absent in a plain browser. */
interface DesktopBadgeScope {
  dshDesktop?: { badge?: { set(count: number): Promise<void> } }
}

/** Dock or taskbar badge operations exposed by the Desktop preload. */
function desktopBadge(): { set(count: number): Promise<void> } | undefined {
  if (typeof globalThis === 'undefined') return undefined
  return (globalThis as DesktopBadgeScope).dshDesktop?.badge
}

/** Shipped page icons; both the light and dark links are painted. */
const ICON_SELECTOR = 'link[rel~="icon"]'
/** Square paint size, large enough for two digits at the sizes browsers render. */
const PAINT_SIZE = 64
/** Badge center and radius, kept inside the square's top-right corner. */
const BADGE_CENTER = 47
const BADGE_RADIUS = 15
/** Badge fill, the shared error red used by destructive affordances. */
const BADGE_FILL = '#e5484d'

/** Digits at or above this value collapse to `99+`. */
const BADGE_MAX = 99

/**
 * Create the page-icon count painter.
 * @returns the badge with its count and disposal operations.
 */
export function createAttentionBadge(): AttentionBadge {
  const links = typeof document === 'undefined'
    ? []
    : [...document.querySelectorAll<HTMLLinkElement>(ICON_SELECTOR)]
  const originals = links.map(link => link.href)
  let current = 0
  let generation = 0
  let disposed = false

  const restore = (): void => {
    for (const [index, link] of links.entries()) {
      const original = originals[index]
      if (original !== undefined) link.href = original
    }
  }

  const publish = (count: number): void => {
    const navigatorWithBadge = typeof navigator === 'undefined' ? undefined : navigator as BadgeNavigator
    const desktop = desktopBadge()
    if (count <= 0) {
      void navigatorWithBadge?.clearAppBadge?.().catch(() => {})
      void desktop?.set(0).catch(() => {})
      restore()
      return
    }
    void navigatorWithBadge?.setAppBadge?.(count).catch(() => {})
    // The Desktop shell owns the real application icon, so the same count
    // reaches both the page icon and the Dock or taskbar badge.
    void desktop?.set(count).catch(() => {})
    const painted = ++generation
    for (const [index, link] of links.entries()) {
      const href = originals[index]
      if (href === undefined) continue
      void renderedIcon(href, count).then((badged) => {
        // A later count or disposal owns the icon now; a stale paint must not
        // overwrite it.
        if (disposed || generation !== painted || current !== count) return
        if (badged !== undefined) link.href = badged
      })
    }
  }

  return {
    set: (count) => {
      if (disposed) return
      const next = Math.max(0, Math.trunc(count))
      current = next
      publish(next)
    },
    dispose: () => {
      disposed = true
      generation += 1
      current = 0
      restore()
      const navigatorWithBadge = typeof navigator === 'undefined' ? undefined : navigator as BadgeNavigator
      void navigatorWithBadge?.clearAppBadge?.().catch(() => {})
      void desktopBadge()?.set(0).catch(() => {})
    },
  }
}

/** Whether this realm can paint pixels at all. */
function canPaint(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('2d') !== null
  } catch (_unsupportedCanvas) {
    // Environments without a canvas implementation (jsdom, some embedded
    // webviews) keep the shipped icons; the count still reaches the Badging API.
    return false
  }
}

/**
 * Paint the count over one shipped icon.
 * @param href - shipped icon URL.
 * @param count - reminder count to render.
 * @returns the generated data URL, or undefined when the icon cannot be painted.
 */
function renderedIcon(href: string, count: number): Promise<string | undefined> {
  if (!canPaint()) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => { resolve(paint(image, count)) }
    image.onerror = () => { resolve(undefined) }
    image.src = href
  })
}

/**
 * Draw the shipped icon plus its count badge on a square canvas.
 * @param image - decoded shipped icon.
 * @param count - reminder count to render.
 * @returns the PNG data URL, or undefined when painting fails.
 */
function paint(image: HTMLImageElement, count: number): string | undefined {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = PAINT_SIZE
    canvas.height = PAINT_SIZE
    const context = canvas.getContext('2d')
    if (context === null) return undefined
    context.drawImage(image, 0, 0, PAINT_SIZE, PAINT_SIZE)
    context.beginPath()
    context.arc(BADGE_CENTER, BADGE_CENTER, BADGE_RADIUS, 0, Math.PI * 2)
    context.fillStyle = BADGE_FILL
    context.fill()
    const label = count > BADGE_MAX ? `${String(BADGE_MAX)}+` : String(count)
    context.fillStyle = '#ffffff'
    context.font = `700 ${label.length > 2 ? 20 : 26}px system-ui, -apple-system, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, BADGE_CENTER, BADGE_CENTER + 1)
    return canvas.toDataURL('image/png')
  } catch (_unsupportedPaint) {
    // Tainted or zero-sized source icons cannot be re-painted; the shipped
    // icon stays in place rather than showing a broken one.
    return undefined
  }
}
