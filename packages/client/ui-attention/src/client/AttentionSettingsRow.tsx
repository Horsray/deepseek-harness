/** General Settings rows controlling the browser attention reminders. */
import { useState } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AttentionSettings } from '../attention-settings.ts'
import css from './AttentionSettingsRow.module.css'

/** Preference values and the ordered writer supplied by the plugin. */
export interface AttentionSettingsRowInjected {
  hooks: { settings: ObservableSnapshot<AttentionSettings> }
  setField(field: keyof AttentionSettings, value: boolean): Promise<boolean>
}

/** One switch row: copy keys plus the preference it edits. */
interface Row {
  readonly field: keyof AttentionSettings
  readonly title: 'settings.interaction' | 'settings.completion' | 'settings.sound' | 'settings.badge'
  readonly description:
    | 'settings.interactionDescription'
    | 'settings.completionDescription'
    | 'settings.soundDescription'
    | 'settings.badgeDescription'
}

/** Reminder switches in reading order: what to announce, then how. */
const ROWS: readonly Row[] = [
  { field: 'interactionToast', title: 'settings.interaction', description: 'settings.interactionDescription' },
  { field: 'completionToast', title: 'settings.completion', description: 'settings.completionDescription' },
  { field: 'soundEnabled', title: 'settings.sound', description: 'settings.soundDescription' },
  { field: 'badgeEnabled', title: 'settings.badge', description: 'settings.badgeDescription' },
]

/**
 * Render the reminder preference section.
 * @param props - accepted preferences, their writer, and localized copy.
 * @returns the General Settings section rows.
 */
export function AttentionSettingsRow({ useSettings, setField, t }:
PropsRuntime<'settings.general.item'> & PropsLocale<'attention'> & InjectFace<AttentionSettingsRowInjected>) {
  const settings = useSettings(value => value)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return <section className={css.section} aria-label={t('settings.title')}>
    {ROWS.map(row => <div key={row.field} className={css.row}>
      <div>
        <div className={css.title}>{t(row.title)}</div>
        <div className={css.description}>{t(row.description)}</div>
      </div>
      <Switch
        checked={settings[row.field]}
        disabled={busy}
        label={t(row.title)}
        onChange={(next) => {
          setFailed(false)
          setBusy(true)
          void setField(row.field, next)
            .then((accepted) => { if (!accepted) setFailed(true) })
            .catch(() => { setFailed(true) })
            .finally(() => { setBusy(false) })
        }}
      />
    </div>)}
    {failed && <div className={css.error} role="alert">{t('settings.error')}</div>}
  </section>
}
