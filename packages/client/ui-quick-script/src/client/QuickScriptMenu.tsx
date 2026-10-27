/**
 * QuickScriptMenu: the composer's play control (`conversation.input.right`),
 * rendered immediately before the model selector. It lists saved shell scripts,
 * runs one in a fresh sidebar terminal, and adds or deletes entries inline.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  IconPlayOutlineRegular, IconPlusOutlineRegular, IconTrashOutlineRegular, MenuSurface, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the input.right seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { cardPosition } from './card-position.ts'
import { addScript, loadScripts, removeScript, saveScripts, type QuickScript } from './quick-script.ts'
import { NS, type QuickScriptKey } from './locales.ts'
import css from './QuickScriptMenu.module.css'

/** Injected face: the terminal handoff behind each row. */
export interface QuickScriptInjected {
  /**
   * Run one saved script in a new sidebar terminal.
   * @param script - the row's saved script.
   * @returns whether a terminal page could be opened.
   */
  run: (script: QuickScript) => boolean
}

/** Unplaced portal card: hidden but laid out at a fixed origin so offsetWidth/Height are real (the measure pass). */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/**
 * Render the composer play control and its script menu.
 * @param props - the standard runtime seat, the injected run handoff, and copy.
 * @returns the trigger and, while open, the portalled menu card.
 */
export function QuickScriptMenu({ run, t }:
  PropsRuntime<'conversation.input.right'> & InjectFace<QuickScriptInjected> & PropsLocale<typeof NS>,
) {
  const [open, setOpen] = useState(false)
  const [scripts, setScripts] = useState<readonly QuickScript[]>(loadScripts)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failed, setFailed] = useState(false)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const close = (restoreFocus: boolean): void => {
    setOpen(false)
    setAdding(false)
    setInvalid(false)
    setFailed(false)
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  // The portal needs viewport coordinates from the trigger and the card's
  // measured size before paint; slot content can resize without parent renders.
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return }
    const place = (): void => {
      /* v8 ignore start -- geometry comes from real layout: jsdom reports no
         trigger rect and a zero-sized card, so these branches run only in a
         browser. Their arithmetic is unit-tested through cardPosition. */
      const rect = triggerRef.current?.getBoundingClientRect()
      const panel = panelRef.current
      if (rect === undefined || panel === null) return
      setPosition(cardPosition({
        anchor: rect,
        size: { width: panel.offsetWidth, height: panel.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }))
      /* v8 ignore stop */
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Pointer presses outside the trigger and the card dismiss the menu; the
  // trigger's own click runs the toggle instead of arriving here twice.
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => {
      const target = event.target
      /* v8 ignore next -- a pointer event's target is always a Node in a browser. */
      if (!(target instanceof Node)) return
      const root = rootRef.current
      const panel = panelRef.current
      /* v8 ignore next -- the trigger and card are attached while the card is open. */
      if (root === null || panel === null) return
      if (root.contains(target) || panel.contains(target)) return
      close(false)
    }
    document.addEventListener('pointerdown', dismiss, true)
    return () => { document.removeEventListener('pointerdown', dismiss, true) }
  }, [open])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedPath = path.trim()
    if (trimmedName === '' || trimmedPath === '') { setInvalid(true); return }
    const next = addScript(scripts, trimmedName, trimmedPath)
    saveScripts(next)
    setScripts(next)
    setName('')
    setPath('')
    setAdding(false)
    setInvalid(false)
  }

  const drop = (id: string): void => {
    const next = removeScript(scripts, id)
    saveScripts(next)
    setScripts(next)
  }

  const runOne = (script: QuickScript): void => {
    if (!run(script)) { setFailed(true); return }
    close(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    close(true)
  }

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onKeyDown}>
      <Tooltip label={t('action.open')} side="top" delayMs={500}>
        <button
          ref={triggerRef}
          type="button"
          className={css.trigger}
          aria-label={t('action.open')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => { if (open) close(true); else setOpen(true) }}
        >
          <IconPlayOutlineRegular size={16} />
        </button>
      </Tooltip>

      {open && createPortal(
        <MenuSurface
          ref={panelRef}
          className={css.menu}
          style={position ?? MEASURE_STYLE}
          role="dialog"
          aria-label={t('action.open')}
        >
          {scripts.length === 0 && !adding && <p className={css.empty}>{t('menu.empty')}</p>}
          {scripts.map(script => (
            <div key={script.id} className={css.row}>
              <button type="button" className={css.run} title={script.path} onClick={() => { runOne(script) }}>
                <IconPlayOutlineRegular size={12} className={css.rowGlyph} />
                <span className={css.name}>{script.name}</span>
              </button>
              <button
                type="button"
                className={css.delete}
                aria-label={t('menu.delete')}
                onClick={() => { drop(script.id) }}
              >
                <IconTrashOutlineRegular size={12} />
              </button>
            </div>
          ))}
          <div className={css.footer}>
            {adding
              ? (
                <form className={css.form} onSubmit={submit}>
                  <input
                    autoFocus
                    className={css.input}
                    value={name}
                    aria-label={t('form.name')}
                    placeholder={t('form.name')}
                    onChange={(event) => { setName(event.target.value); setInvalid(false) }}
                  />
                  <input
                    className={css.input}
                    value={path}
                    aria-label={t('form.path')}
                    placeholder={t('form.path')}
                    onChange={(event) => { setPath(event.target.value); setInvalid(false) }}
                  />
                  {invalid && <p className={css.error} role="status">{t('form.invalid')}</p>}
                  <div className={css.actions}>
                    <button type="button" className={css.secondary} onClick={() => { setAdding(false); setInvalid(false) }}>
                      {t('form.cancel')}
                    </button>
                    <button type="submit" className={css.primary}>{t('form.save')}</button>
                  </div>
                </form>
              )
              : (
                <button
                  type="button"
                  className={css.add}
                  onClick={() => { setAdding(true); setInvalid(false) }}
                >
                  <IconPlusOutlineRegular size={12} />
                  <span>{t('menu.add')}</span>
                </button>
              )}
          </div>
          {failed && <p className={css.error} role="status">{t('run.failed')}</p>}
        </MenuSurface>,
        document.body,
      )}
    </div>
  )
}

/** The menu's copy keys, re-exported for the package's own dictionary check. */
export type { QuickScriptKey }
