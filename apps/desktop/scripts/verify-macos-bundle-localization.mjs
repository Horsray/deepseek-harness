/** Verify that a packaged macOS application declares the bundle localizations AppKit needs for directory names. */

import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'

const plutil = promisify(execFile)

/**
 * AppKit falls back to English for standard folders when the active localization is undeclared.
 * `Desktop`, `Documents` and `Downloads` are the visible symptom in the native folder picker.
 */
const ENGLISH_DIRECTORY_NAMES = 'without this declaration macOS shows standard directory names in English '
  + '(Desktop, Documents, Downloads) in native directory dialogs'

/**
 * Map shipped locale ids to the identifiers macOS expects in `CFBundleLocalizations`.
 * @param {readonly string[]} localeIds - Shipped locale ids in display order; `zh` is simplified Chinese.
 * @returns {string[]} macOS localization identifiers in the same order, with `zh` mapped to `zh_CN`.
 */
export function expectedMacOSBundleLocalizations(localeIds) {
  return localeIds.map(localeId => localeId === 'zh' ? 'zh_CN' : localeId)
}

/**
 * Require an Info.plist to declare exactly the expected localizations in the expected order.
 * @param {Record<string, unknown>} plist - Info.plist parsed from a packaged application.
 * @param {readonly string[]} expectedLocales - Localizations this release must declare, in order.
 * @returns {void}
 */
export function assertMacOSBundleLocalizations(plist, expectedLocales) {
  const declared = typeof plist === 'object' && plist !== null && !Array.isArray(plist)
    ? plist.CFBundleLocalizations
    : undefined
  const matches = Array.isArray(declared) && declared.length === expectedLocales.length
    && declared.every((localization, index) => localization === expectedLocales[index])
  if (matches) return
  const actual = declared === undefined ? 'nothing' : JSON.stringify(declared)
  throw new Error(`desktop macOS bundle localization: Info.plist CFBundleLocalizations declares ${actual}, `
    + `expected ${JSON.stringify(expectedLocales)} in that order; ${ENGLISH_DIRECTORY_NAMES}.`)
}

/**
 * Read the Info.plist of one packaged application through `plutil`, which accepts binary and XML plists.
 * @param {string} appPath - Path to the packaged `.app` directory.
 * @returns {Promise<Record<string, unknown>>} Parsed Info.plist, ready for `assertMacOSBundleLocalizations`.
 */
export async function readMacOSBundleLocalizations(appPath) {
  const plistPath = join(appPath, 'Contents', 'Info.plist')
  let stdout
  try {
    ({ stdout } = await plutil('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' }))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`desktop macOS bundle localization: could not read ${plistPath} with /usr/bin/plutil: ${detail}`)
  }
  let plist
  try {
    plist = JSON.parse(stdout)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`desktop macOS bundle localization: /usr/bin/plutil returned invalid JSON for ${plistPath}: ${detail}`)
  }
  if (typeof plist !== 'object' || plist === null || Array.isArray(plist)) {
    throw new Error(`desktop macOS bundle localization: ${plistPath} does not contain an Info.plist dictionary`)
  }
  return plist
}

/**
 * Verify a packaged macOS application declares the localizations needed for localized directory names.
 * @param {string} appPath - Path to the packaged `.app` directory.
 * @param {readonly string[]} expectedLocales - Localizations this release must declare, in order.
 * @returns {Promise<void>} Resolves when the bundle declares exactly the expected localizations.
 */
export async function verifyMacOSBundleLocalizations(appPath, expectedLocales) {
  assertMacOSBundleLocalizations(await readMacOSBundleLocalizations(appPath), expectedLocales)
}
