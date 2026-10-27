/** Verify that a packaged macOS application declares the bundle localizations AppKit needs for directory names. */

/**
 * Map shipped locale ids to the identifiers macOS expects in `CFBundleLocalizations`.
 * @param localeIds - Shipped locale ids in display order; `zh` is simplified Chinese.
 * @returns macOS localization identifiers in the same order, with `zh` mapped to `zh_CN`.
 */
export function expectedMacOSBundleLocalizations(localeIds: readonly string[]): string[]

/**
 * Require an Info.plist to declare exactly the expected localizations in the expected order.
 * @param plist - Info.plist parsed from a packaged application.
 * @param expectedLocales - Localizations this release must declare, in order.
 */
export function assertMacOSBundleLocalizations(
  plist: Record<string, unknown>,
  expectedLocales: readonly string[],
): void

/**
 * Read the Info.plist of one packaged application through `plutil`, which accepts binary and XML plists.
 * @param appPath - Path to the packaged `.app` directory.
 * @returns Parsed Info.plist, ready for `assertMacOSBundleLocalizations`.
 */
export function readMacOSBundleLocalizations(appPath: string): Promise<Record<string, unknown>>

/**
 * Verify a packaged macOS application declares the localizations needed for localized directory names.
 * @param appPath - Path to the packaged `.app` directory.
 * @param expectedLocales - Localizations this release must declare, in order.
 */
export function verifyMacOSBundleLocalizations(
  appPath: string,
  expectedLocales: readonly string[],
): Promise<void>
