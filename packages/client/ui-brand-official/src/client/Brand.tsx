/** Company brand artwork occupying the sidebar's generic brand slots. */
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import css from './Brand.module.css'
import wordmark from './assets/company-wordmark.webp'
import wordmarkDark from './assets/company-wordmark-dark.webp'
import mark from './assets/company-mark.webp'
import markDark from './assets/company-mark-dark.webp'

/**
 * Artwork for each surface: the expanded row carries the wordmark beside the
 * name seat, while the collapsed rail can only fit the square sign.
 */
const ARTWORK = {
  row: { light: wordmark, dark: wordmarkDark },
  rail: { light: mark, dark: markDark },
} as const

/**
 * Wordmark height relative to the slot edge. The artwork is a wide lockup, so a
 * square-edge height would make it dominate the row.
 */
const WORDMARK_SCALE = 0.75

/**
 * Render the company mark with the presentation requested by its host surface.
 * @param props - Host-supplied placement and edge size.
 * @returns the company artwork for that surface.
 */
export function OfficialBrandMark({ size, surface }: SidebarBrandMarkOwnerProps) {
  const artwork = ARTWORK[surface]
  const height = surface === 'row' ? Math.round(size * WORDMARK_SCALE) : size
  const style = { height: `${height}px` }
  return (
    <span className={css.brand} style={style}>
      <img className={css.light} src={artwork.light} style={style} alt="" />
      <img className={css.dark} src={artwork.dark} style={style} alt="" />
    </span>
  )
}

/**
 * The wordmark already carries the company name, so the name seat stays empty.
 * @returns nothing; the mark owns the whole brand width.
 */
export function OfficialBrandName() {
  return null
}
