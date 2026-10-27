/**
 * Browser attention reminders, node half. The surface itself lives in the
 * browser half; this half registers the validated runtime preferences so the
 * browser can read and write them through the configuration form projection.
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { AttentionSettingsFields } from './attention-settings.ts'
import type { AttentionSettings } from './attention-settings.ts'

export {
  ATTENTION_SETTINGS_NAMESPACE, DEFAULT_ATTENTION_SETTINGS, DEFAULT_SOUND_PRESET, SOUND_PRESETS,
  type AttentionSettings, type SoundPreset,
} from './attention-settings.ts'

/** Live reminder preferences projected to the browser. */
export interface Config {
  /** Show a toast when a Session starts waiting for the user. */
  interactionToast: Volatile<AttentionSettings['interactionToast']>
  /** Show a toast when a background Session finishes a Turn. */
  completionToast: Volatile<AttentionSettings['completionToast']>
  /** Play the synthesized chime alongside a reminder toast. */
  soundEnabled: Volatile<AttentionSettings['soundEnabled']>
  /** Timbral preset the chime plays. */
  soundPreset: Volatile<AttentionSettings['soundPreset']>
  /** Count unacknowledged reminders on the page icon. */
  badgeEnabled: Volatile<AttentionSettings['badgeEnabled']>
}

/** Live reminder preferences; every field applies to the open browser without a restart. */
export const Config = z.object({
  interactionToast: AttentionSettingsFields.interactionToast.volatile(),
  completionToast: AttentionSettingsFields.completionToast.volatile(),
  soundEnabled: AttentionSettingsFields.soundEnabled.volatile(),
  soundPreset: AttentionSettingsFields.soundPreset.volatile(),
  badgeEnabled: AttentionSettingsFields.badgeEnabled.volatile(),
})

/**
 * Publish these preferences as user settings.
 * @param ctx - Host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
