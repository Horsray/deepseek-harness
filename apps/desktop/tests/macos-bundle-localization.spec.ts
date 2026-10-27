import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SHIPPED_LOCALE_IDS } from '../../../scripts/shipped-locales.ts'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'
import {
  assertMacOSBundleLocalizations,
  expectedMacOSBundleLocalizations,
  readMacOSBundleLocalizations,
  verifyMacOSBundleLocalizations,
} from '../scripts/verify-macos-bundle-localization.mjs'

const EXPECTED_LOCALIZATIONS = expectedMacOSBundleLocalizations(SHIPPED_LOCALE_IDS)

/** Capture the rejection message so assertions cover both the offending value and the user-visible symptom. */
function rejectionMessage(plist: Record<string, unknown>, expected = EXPECTED_LOCALIZATIONS): string {
  try {
    assertMacOSBundleLocalizations(plist, expected)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected the bundle localization assertion to reject')
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

/** Render a minimal XML Info.plist; an omitted list exercises a bundle without the declaration. */
function renderInfoPlist(localizations?: readonly string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    ...(localizations === undefined ? [] : [
      '<key>CFBundleLocalizations</key>',
      `<array>${localizations.map(localization => `<string>${localization}</string>`).join('')}</array>`,
    ]),
    '</dict>',
    '</plist>',
    '',
  ].join('\n')
}

/** Write one throwaway `.app` bundle; leaving `plist` undefined produces a bundle without an Info.plist. */
async function writeApplication(plist?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-macos-bundle-localization-'))
  temporaryDirectories.push(root)
  const appPath = join(root, 'DeepSeek Harness.app')
  await mkdir(join(appPath, 'Contents'), { recursive: true })
  if (plist !== undefined) await writeFile(join(appPath, 'Contents', 'Info.plist'), plist, 'utf8')
  return appPath
}

describe('macOS bundle localizations', () => {
  it('maps the shipped zh locale to zh_CN and preserves display order', () => {
    expect(expectedMacOSBundleLocalizations(['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt']))
      .toEqual(['en', 'zh_CN', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])
    expect(expectedMacOSBundleLocalizations(['zh', 'en'])).toEqual(['zh_CN', 'en'])
    expect(EXPECTED_LOCALIZATIONS).toEqual(['en', 'zh_CN', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])
  })

  it('accepts a bundle that declares exactly the expected localizations', () => {
    expect(() => {
      assertMacOSBundleLocalizations({ CFBundleLocalizations: [...EXPECTED_LOCALIZATIONS] }, EXPECTED_LOCALIZATIONS)
    }).not.toThrow()
  })

  it('rejects a bundle without the declaration and names the English directory-name symptom', () => {
    const message = rejectionMessage({})
    expect(message).toContain('CFBundleLocalizations')
    expect(message).toContain('declares nothing')
    expect(message).toContain(JSON.stringify(EXPECTED_LOCALIZATIONS))
    expect(message).toContain('native directory dialogs')
    expect(message).toContain('standard directory names in English')
  })

  it.each([
    ['a missing localization', EXPECTED_LOCALIZATIONS.slice(0, -1)],
    ['an extra localization', [...EXPECTED_LOCALIZATIONS, 'ko']],
    ['a different order', [...EXPECTED_LOCALIZATIONS].reverse()],
  ])('rejects a declaration with %s', (_label, declared) => {
    const message = rejectionMessage({ CFBundleLocalizations: declared })
    expect(message).toContain(JSON.stringify(declared))
    expect(message).toContain(`expected ${JSON.stringify(EXPECTED_LOCALIZATIONS)} in that order`)
    expect(message).toContain('standard directory names in English')
  })

  it('matches the localizations the release configuration declares in mac.extendInfo', () => {
    const config = createElectronBuilderConfig({
      DSH_DESKTOP_APP_ID: 'com.example.desktop',
      DSH_DESKTOP_UNSIGNED: '1',
    }, 'darwin', 'arm64')
    expect(config.mac.extendInfo.CFBundleLocalizations).toEqual(EXPECTED_LOCALIZATIONS)
  })
})

describe.skipIf(process.platform !== 'darwin')('packaged macOS application inspection', () => {
  it('reads and verifies the declarations of a packed application', async () => {
    const appPath = await writeApplication(renderInfoPlist(EXPECTED_LOCALIZATIONS))
    await expect(verifyMacOSBundleLocalizations(appPath, EXPECTED_LOCALIZATIONS)).resolves.toBeUndefined()
    await expect(readMacOSBundleLocalizations(appPath)).resolves.toMatchObject({
      CFBundleLocalizations: EXPECTED_LOCALIZATIONS,
    })
  })

  it('rejects a packed application whose Info.plist lost the declaration', async () => {
    const appPath = await writeApplication(renderInfoPlist())
    await expect(verifyMacOSBundleLocalizations(appPath, EXPECTED_LOCALIZATIONS))
      .rejects.toThrow(/CFBundleLocalizations declares nothing/u)
    await expect(verifyMacOSBundleLocalizations(appPath, EXPECTED_LOCALIZATIONS))
      .rejects.toThrow(/standard directory names in English/u)
  })

  it('rejects an application without a readable Info.plist and names the plist path', async () => {
    const appPath = await writeApplication()
    await expect(readMacOSBundleLocalizations(appPath)).rejects.toThrow(/Info\.plist/u)
    await expect(readMacOSBundleLocalizations(appPath)).rejects.toThrow(/plutil/u)
  })
})
