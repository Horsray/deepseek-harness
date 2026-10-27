/** Durable browser preference fields for attention reminders, shared by the Host schema and the browser scope. */

import z from '@deepseek-ai/schemastery'

/** User-settings namespace owned by this plugin; also its Host entry id. */
export const ATTENTION_SETTINGS_NAMESPACE = 'ui-attention'

/** Reminder preferences a user can change without restarting the Host. */
export interface AttentionSettings {
  /** Show a toast when a Session starts waiting for approval, plan review, or an answer. */
  interactionToast: boolean
  /** Show a toast when a background Session finishes a Turn the user has not acknowledged. */
  completionToast: boolean
  /** Play the synthesized chime alongside a reminder toast. */
  soundEnabled: boolean
  /** Count unacknowledged reminders on the page icon. */
  badgeEnabled: boolean
}

/** Every reminder preference starts enabled. */
export const DEFAULT_ATTENTION_SETTINGS: AttentionSettings = {
  interactionToast: true,
  completionToast: true,
  soundEnabled: true,
  badgeEnabled: true,
}

/** Per-field schemas; the Host decorates each as a live preference. */
export const AttentionSettingsFields = {
  interactionToast: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.interactionToast),
  completionToast: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.completionToast),
  soundEnabled: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.soundEnabled),
  badgeEnabled: z.boolean().default(DEFAULT_ATTENTION_SETTINGS.badgeEnabled),
}

/** Durable reminder preferences; also the wire envelope the browser scope validates against. */
export const AttentionSettingsSchema = z.object(AttentionSettingsFields)
