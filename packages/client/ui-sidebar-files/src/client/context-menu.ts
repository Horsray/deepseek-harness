/**
 * What the file tree's context menu offers for one row: whether a file runs as
 * a script, and the shell line each terminal gesture types.
 *
 * The menu labels and the terminal handoff share these helpers, so a row's
 * "run" gesture cannot disagree with the command that reaches the shell. Paths
 * arrive from the Host's listing and stay absolute: every command quotes them
 * rather than assuming a shell that splits on spaces.
 */

/** Script extensions whose files run directly in a terminal. */
const RUNNABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'sh', 'bash', 'zsh', 'command', 'fish', 'csh', 'py', 'rb', 'pl', 'pm',
])

/** One row's kind, as the directory listing reports it. */
export type FileRowKind = 'file' | 'directory'

/**
 * Whether a file row runs as a script in a terminal.
 * @param name - the row's basename.
 * @returns true for a known script extension; extensionless files are not run.
 */
export function isRunnableScript(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return false
  return RUNNABLE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}

/**
 * Quote one path for a POSIX shell command line.
 * @param path - absolute Host path.
 * @returns the path in single quotes, with embedded quotes escaped.
 */
export function shellQuote(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`
}

/**
 * The directory containing one path, on either separator convention.
 * @param path - absolute Host path.
 * @returns the parent directory, or the path itself when it has no parent segment.
 */
export function parentDirectory(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (index < 0) return path
  return path.slice(0, index === 0 ? 1 : index)
}

/**
 * The line a terminal gesture types for one row: `cd` for a directory, and
 * `cd` plus the quoted script for a runnable file, so the run's working
 * directory is the file's own.
 * @param path - absolute Host path of the row.
 * @param kind - whether the row is a directory; a file row is expected to be runnable.
 * @returns the command line, without a trailing newline.
 */
export function terminalCommand(path: string, kind: FileRowKind): string {
  if (kind === 'directory') return `cd ${shellQuote(path)}`
  return `cd ${shellQuote(parentDirectory(path))} && ${shellQuote(path)}`
}
