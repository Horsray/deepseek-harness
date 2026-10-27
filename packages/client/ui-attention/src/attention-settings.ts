/** Browser preference fields for attention reminders, shared by the Host schema and the browser scope. */

import z from '@deepseek-ai/schemastery'

/** User-settings namespace owned by this plugin; also its Host entry id. */
export const ATTENTION_SETTINGS_NAMESPACE = 'ui-attention'

/** Reminder chime timbres offered in Settings. */
export const SOUND_PRESETS = ['glass', 'ascending', 'marimba'] as const

/** One synthesized reminder timbre. */
export type SoundPreset = typeof SOUND_PRESETS[number]

/** Keep the bright glass timbre for users without an explicit choice. */
export const DEFAULT_SOUND_PRESET: SoundPreset = 'glass'

/** Reminder preferences a user can change without restarting the Host. */
export interface AttentionSettings {
  /** Show a toast when a Session starts waiting for approval, plan review, or an answer. */
  interactionToast: boolean
  /** Show a toast when a Session finishes a Turn. */
  completionToast: boolean
  /** Play the synthesized chime alongside a reminder toast. */
  soundEnabled: boolean
  /** Timbral preset the chime plays. */
  soundPreset: SoundPreset
  /** Count unacknowledged reminders on the page icon. */
  badgeEnabled: boolean
}

/** Every reminder preference starts enabled. */
export const DEFAULT_ATTENTION_SETTINGS: AttentionSettings = {
  interactionToast: true,
  completionToast: true,
  soundEnabled: true,
  soundPreset: DEFAULT_SOUND_PRESET,
  badgeEnabled: true,
}

/** Per-field schemas; the Host decorates each as a live preference. */
export const AttentionSettingsFields = {
  interactionToast: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.interactionToast),
  completionToast: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.completionToast),
  soundEnabled: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.soundEnabled),
  soundPreset: z.union([...SOUND_PRESETS]).default(DEFAULT_ATTENTION_SETTINGS.soundPreset),
  badgeEnabled: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.badgeEnabled),
}
