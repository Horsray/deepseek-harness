/**
 * Web attention reminders, browser half: one `shell.overlay` banner, a
 * synthesized chime, and a page-icon count for the two facts that need the
 * user back — a Session waiting on an approval, plan review, or answer, and a
 * background Session that finished unacknowledged work.
 *
 * Detection rides the unified Session status source (`uiSession.sessionStatus`)
 * and is a pure fold over its snapshot (see `attention-detection.ts`). The
 * initial snapshot is a baseline, so reminders that were already true when this
 * plugin activated never fire. A reminder is suppressed while its Session is
 * the main view and the page is visible, because the card asking for the answer
 * is already on screen; the page-icon count still covers that Session once the
 * user moves away.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AttentionSettings } from '../attention-settings.ts'
import { ATTENTION_SETTINGS_NAMESPACE, DEFAULT_ATTENTION_SETTINGS } from '../attention-settings.ts'
import type { AttentionNoticeKind } from './attention-store.ts'
import { createAttentionStore } from './attention-store.ts'
import { detectReminders, type DetectionMemory } from './attention-detection.ts'
import { createAttentionChime } from './sound.ts'
import { createAttentionBadge } from './favicon-badge.ts'
import { AttentionToast, type AttentionToastInjected } from './AttentionToast.tsx'
import { AttentionSettingsRow, type AttentionSettingsRowInjected } from './AttentionSettingsRow.tsx'
import { de, en, es, fr, ja, pt, ru, zh, type AttentionKey } from './locales.ts'

export type { AttentionKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Reminder banner and Settings copy. */
    attention: AttentionKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'attention'

/** Required services: Session status, Settings forms, slots, and copy. */
export const inject = ['sessions', 'locale', 'slots', 'uiSession', 'configForms']

/**
 * Install the reminder banner, chime, page-icon count, and their preferences.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-attention: dictionaries')

  const settings = ctx.configForms.get<AttentionSettings>(ATTENTION_SETTINGS_NAMESPACE)
  // The form snapshot carries the decoded section next to its status; reminder
  // logic reads the preferences themselves, defaulting before the Host answers.
  const preferences: HostObservable<AttentionSettings> = {
    getSnapshot: () => settings.getSnapshot().value ?? DEFAULT_ATTENTION_SETTINGS,
    subscribe: listener => settings.subscribe(listener),
  }

  const store = createAttentionStore()
  const chime = createAttentionChime()
  const badge = createAttentionBadge()
  const disarm = chime.arm()

  ctx.effect(() => () => {
    disarm()
    chime.dispose()
    badge.dispose()
    store.dispose()
  }, 'ui-attention: reminder resources')

  const memory: DetectionMemory = { interactions: new Map(), completions: new Set() }
  let baseline = false

  const announce = (sessionId: SessionId, kind: AttentionNoticeKind, prefs: AttentionSettings): void => {
    const title = ctx.sessions.list.getSnapshot().byId[sessionId]?.displayTitle ?? sessionId
    const toastEnabled = kind === 'completion' ? prefs.completionToast : prefs.interactionToast
    if (toastEnabled) store.show({ sessionId, title, kind })
    if (prefs.soundEnabled) chime.play()
  }

  const sync = (): void => {
    const prefs = preferences.getSnapshot()
    const visible = typeof document === 'undefined' || !document.hidden
    const result = detectReminders(
      memory,
      ctx.uiSession.sessionStatus.getSnapshot(),
      ctx.sessions.list.getSnapshot().byId,
      visible,
      baseline,
    )
    // The first snapshot describes whatever was already true before this
    // plugin existed; adopting it silently keeps a page load from replaying
    // every reminder the user had already seen.
    baseline = true
    for (const notice of result.notices) announce(notice.sessionId, notice.kind, prefs)
    badge.set(prefs.badgeEnabled ? result.count : 0)
  }

  ctx.effect(() => {
    const unsubscribeStatus = ctx.uiSession.sessionStatus.subscribe(sync)
    const unsubscribePreferences = preferences.subscribe(sync)
    sync()
    return () => {
      unsubscribeStatus()
      unsubscribePreferences()
    }
  }, 'ui-attention: session status')

  // Leaving or entering the tab changes whether the asking card counts as
  // seen, so the icon count follows visibility without raising a reminder.
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const onVisibility = (): void => { sync() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility) }
  }, 'ui-attention: page visibility')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'attention.toast', locale: NS,
    inject: (): AttentionToastInjected => ({
      hooks: { notice: store.hooks.notice },
      dismiss: (seq) => { store.dismiss(seq) },
    }),
  }, AttentionToast))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'attention', order: 20, locale: NS,
    inject: (): AttentionSettingsRowInjected => ({
      hooks: { settings: preferences },
      setField: (field, value) => settings.set(field, value),
    }),
  }, AttentionSettingsRow))
}
