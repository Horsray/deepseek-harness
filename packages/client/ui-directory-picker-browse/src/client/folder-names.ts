/**
 * Locale-owned display names for the standard folders a listing shows at the
 * home level. The Host returns filesystem names verbatim — macOS keeps
 * `Desktop`, `Documents`, and `Downloads` on disk while Finder presents the
 * operator's language — so the dialog translates them here instead of
 * rendering raw names. Paths, creation targets, and the path editor keep the
 * real names: only the row and crumb labels change.
 * @module @deepseek-ai/dsh-client-ui-directory-picker-browse/folder-names
 */

import type { DirectoryEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { Translate } from '@deepseek-ai/dsh-client-locale/client'

/**
 * Locale key per standard folder name. macOS and Windows share the names that
 * matter for a home listing except `Movies` (macOS) versus `Videos` (Windows),
 * so both are mapped; an entry named anything else is left untouched, which
 * keeps renamed user folders and ordinary project directories as they are.
 */
const STANDARD_FOLDER_KEYS = new Map<string, string>([
  ['Desktop', 'folder.desktop'],
  ['Documents', 'folder.documents'],
  ['Downloads', 'folder.downloads'],
  ['Movies', 'folder.movies'],
  ['Videos', 'folder.videos'],
  ['Music', 'folder.music'],
  ['Pictures', 'folder.pictures'],
  ['Public', 'folder.public'],
  ['Library', 'folder.library'],
  ['Applications', 'folder.applications'],
])

/**
 * Whether `path` names a direct child of `home`. The comparison follows the
 * separator the home path itself uses (Windows paths compare case-insensitively,
 * matching the platform's own path rules) so a listing never depends on the
 * browser's own path helpers.
 * @param path - entry path from the Host listing.
 * @param home - the listing's home directory.
 * @returns whether the entry is one level below home.
 */
function isHomeChild(path: string, home: string): boolean {
  const windows = home.includes('\\')
  const cut = windows ? Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) : path.lastIndexOf('/')
  if (cut < 0) return false
  const parent = path.slice(0, cut)
  return windows ? parent.toLowerCase() === home.toLowerCase() : parent === home
}

/**
 * The label a listing row or crumb shows for one entry: the translated
 * standard-folder name when the entry is a known folder at the home level,
 * otherwise the filesystem name the Host returned.
 * @param entry - host-listed directory (its `name` is the filesystem name).
 * @param home - the listing's home directory, from the same Host response.
 * @param t - the dialog's namespace-bound translate seat.
 * @returns the display label for the entry.
 */
export function localizedFolderName(entry: DirectoryEntry, home: string, t: Translate): string {
  if (!isHomeChild(entry.path, home)) return entry.name
  const key = STANDARD_FOLDER_KEYS.get(entry.name)
  return key === undefined ? entry.name : t(key)
}
