/** Browser-local catalog of user-run shell scripts behind the composer play menu. */
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'

/** One saved script: the menu label plus the absolute path the terminal runs. */
export interface QuickScript {
  readonly id: string
  readonly name: string
  readonly path: string
}

/** Storage key for the saved catalog; the version moves with the stored entry shape. */
const STORAGE_KEY = 'dsh.quick-script.v1'

/** Narrow one parsed entry: a hand-edited or older store must not break the menu. */
function isQuickScript(value: unknown): value is QuickScript {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'string' && value.id !== ''
    && 'name' in value && typeof value.name === 'string'
    && 'path' in value && typeof value.path === 'string'
}

/**
 * Read the saved catalog. Unavailable storage and malformed values read as an
 * empty catalog, so the composer never fails on a stale key.
 * @returns the saved scripts in menu order.
 */
export function loadScripts(): readonly QuickScript[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isQuickScript)
  } catch {
    // A private-mode store or a corrupted value must not break the composer.
    return []
  }
}

/**
 * Persist the catalog. A browser that refuses storage keeps the in-memory list
 * for this page; the next load then starts from the saved one.
 * @param scripts - complete catalog to store.
 */
export function saveScripts(scripts: readonly QuickScript[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts))
  } catch {
    // Storage quota and private-mode denials are not user errors here.
  }
}

/**
 * Append one script under a freshly minted id.
 * @param scripts - current catalog.
 * @param name - menu label; callers pass it already trimmed.
 * @param path - absolute script path; callers pass it already trimmed.
 * @returns the updated catalog.
 */
export function addScript(scripts: readonly QuickScript[], name: string, path: string): readonly QuickScript[] {
  return [...scripts, { id: randomUUID(), name, path }]
}

/**
 * Drop one script by identity.
 * @param scripts - current catalog.
 * @param id - the entry to remove.
 * @returns the updated catalog.
 */
export function removeScript(scripts: readonly QuickScript[], id: string): readonly QuickScript[] {
  return scripts.filter(script => script.id !== id)
}

/**
 * Quote one path for a POSIX shell command line.
 * @param path - the path as typed.
 * @returns the double-quoted, escaped path.
 */
function quotePath(path: string): string {
  return `"${path.replace(/["\\$`]/g, match => `\\${match}`)}"`
}

/**
 * Build the terminal line that switches to the script's directory and runs it
 * with bash, matching the tool the script authors target.
 * @param script - saved script to run.
 * @returns one command line without its terminating newline.
 */
export function scriptCommand(script: QuickScript): string {
  const separator = script.path.lastIndexOf('/')
  const directory = separator > 0 ? script.path.slice(0, separator) : '/'
  return `cd ${quotePath(directory)} && bash ${quotePath(script.path)}`
}
