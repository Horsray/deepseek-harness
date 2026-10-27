/** General Settings rows controlling the browser attention reminders. */
import { useState } from 'react'
import { Button, SegmentedControl, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SOUND_PRESETS, type AttentionSettings, type SoundPreset } from '../attention-settings.ts'
import css from './AttentionSettingsRow.module.css'

/** Preferences the toggle rows edit, all boolean. */
type ToggleField = 'interactionToast' | 'completionToast' | 'soundEnabled' | 'badgeEnabled'

/** Preference values and the ordered writer supplied by the plugin. */
export interface AttentionSettingsRowInjected {
  hooks: { settings: ObservableSnapshot<AttentionSettings> }
  setToggle(field: ToggleField, value: boolean): Promise<boolean>
  setPreset(preset: SoundPreset): Promise<boolean>
  /** Show one reminder immediately so the user can confirm the reminder works. */
  preview(preset?: SoundPreset): void
}

/** One switch row: copy keys plus the preference it edits. */
interface Row {
  readonly field: ToggleField
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

/** Localized name of each chime timbre. */
const PRESET_LABELS: Readonly<Record<SoundPreset, 'sound.glass' | 'sound.ascending' | 'sound.marimba'>> = {
  glass: 'sound.glass',
  ascending: 'sound.ascending',
  marimba: 'sound.marimba',
}

/**
 * Render the reminder preference section.
 * @param props - accepted preferences, their writer, the preview, and localized copy.
 * @returns the General Settings section rows.
 */
export function AttentionSettingsRow({ useSettings, setToggle, setPreset, preview, t }:
PropsRuntime<'settings.general.item'> & PropsLocale<'attention'> & InjectFace<AttentionSettingsRowInjected>) {
  const settings = useSettings(value => value)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  /** Run one preference write, keeping the failure notice on rejection. */
  const write = (task: Promise<boolean>, after?: () => void): void => {
    setFailed(false)
    setBusy(true)
    void task
      .then((accepted) => {
        if (!accepted) { setFailed(true); return }
        after?.()
      })
      .catch(() => { setFailed(true) })
      .finally(() => { setBusy(false) })
  }
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
        onChange={(next) => { write(setToggle(row.field, next)) }}
      />
    </div>)}
    <div className={css.row}>
      <div className={css.title}>{t('settings.soundPreset')}</div>
      <SegmentedControl
        id="attention-sound-preset"
        value={settings.soundPreset}
        label={t('settings.soundPreset')}
        options={SOUND_PRESETS.map(preset => ({ value: preset, label: t(PRESET_LABELS[preset]) }))}
        disabled={busy}
        onChange={(next) => {
          // Audition the chosen timbre as soon as the preference is accepted,
          // so choosing a chime and hearing it are the same gesture.
          write(setPreset(next), () => { preview(next) })
        }}
      />
    </div>
    <div className={css.row}>
      <div>
        <div className={css.title}>{t('settings.preview')}</div>
        <div className={css.description}>{t('settings.previewDescription')}</div>
      </div>
      <Button variant="outline" size="sm" onClick={() => { preview() }}>{t('settings.preview')}</Button>
    </div>
    {failed && <div className={css.error} role="alert">{t('settings.error')}</div>}
  </section>
}
