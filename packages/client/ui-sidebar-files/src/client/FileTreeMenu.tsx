/**
 * The file tree's context menu: the gestures one row offers, anchored where the
 * reader right-clicked.
 *
 * The menu is portalled from a fixed viewport point so it escapes the tree's
 * scroll body; which row the menu belongs to, and what each gesture does, stays
 * with the body that opened it. A file row runs in a terminal only when its
 * basename is a script, and Host-desktop gestures appear only while the Host
 * reports one.
 */
import type { ReactNode } from 'react'
import {
  IconCodeOutlineRegular, IconCopyOutlineRegular, IconFolderOpenOutlineRegular,
  IconInspectOutlineRegular, IconRightUpOutlineRegular, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { FileRowKind } from './context-menu.ts'
import type {} from './locales.ts'
import css from './FileTreeMenu.module.css'

/** One row's menu, and the pointer position that opened it. */
export interface FileTreeMenuTarget {
  /** Absolute path of the row. */
  readonly path: string
  /** Absolute path of the listing the row belongs to. */
  readonly parent: string
  /** The row's basename, as the listing reported it. */
  readonly name: string
  /** Whether the row is a directory. */
  readonly kind: FileRowKind
  /** Viewport x of the right-click. */
  readonly x: number
  /** Viewport y of the right-click. */
  readonly y: number
}

/** What one row's menu asks of the body that owns it. */
export interface FileTreeMenuGestures {
  /** Open the row's resource, or expand/collapse a directory. */
  readonly open: () => void
  /** Type the row's command into a fresh terminal. */
  readonly terminal: () => void
  /** Copy the row's absolute path. */
  readonly copyPath: () => void
  /** Reveal the row in the file manager. */
  readonly reveal: () => void
  /** Open the row in its default application. */
  readonly openInApp: () => void
  /** Dismiss the menu. */
  readonly close: () => void
}

/** Full props of one row's menu. */
export interface FileTreeMenuProps extends FileTreeMenuGestures {
  readonly target: FileTreeMenuTarget
  /** Whether the Host desktop can hand paths to native applications. */
  readonly desktop: boolean
  /** Whether a terminal service is loaded for the run gesture. */
  readonly terminalAvailable: boolean
  /** Whether a file row is a script the terminal runs. */
  readonly runnable: boolean
  readonly t: TranslateNS<'sidebarFiles'>
}

/**
 * Build the entries one row offers.
 * @param props - the row, the Host capabilities, and the copy.
 * @returns the menu entries in reading order.
 */
export function fileTreeMenuEntries(props: FileTreeMenuProps): MenuEntry[] {
  const { target, desktop, terminalAvailable, runnable, t } = props
  const terminal = !terminalAvailable
    ? undefined
    : target.kind === 'directory'
      ? { id: 'terminal', label: t('menu.openInTerminal'), icon: <IconCodeOutlineRegular size={14} /> }
      : runnable
        ? { id: 'terminal', label: t('menu.runInTerminal'), icon: <IconCodeOutlineRegular size={14} /> }
        : undefined
  const desktopEntries: MenuEntry[] = desktop
    ? [
      { id: 'reveal', label: t('menu.reveal'), icon: <IconFolderOpenOutlineRegular size={14} /> },
      { id: 'openInApp', label: t('menu.openInApp'), icon: <IconRightUpOutlineRegular size={14} /> },
    ]
    : []
  return [
    { id: 'open', label: t('menu.open'), icon: <IconInspectOutlineRegular size={14} /> },
    ...terminal === undefined ? [] : [terminal],
    { type: 'separator', id: 'separator-copy' },
    { id: 'copyPath', label: t('menu.copyPath'), icon: <IconCopyOutlineRegular size={14} /> },
    ...desktopEntries,
  ]
}

/**
 * Render one row's menu at the pointer position that opened it.
 * @param props - the row, the Host capabilities, and the gestures.
 * @returns the portalled menu.
 */
export function FileTreeMenu(props: FileTreeMenuProps): ReactNode {
  const select = (id: string): void => {
    props.close()
    switch (id) {
      case 'open': props.open(); return
      case 'terminal': props.terminal(); return
      case 'copyPath': props.copyPath(); return
      case 'reveal': props.reveal(); return
      case 'openInApp': props.openInApp(); return
      default: return
    }
  }
  return (
    <Menu
      open
      portal
      autoFocus
      dense
      className={css.anchor}
      anchor={<span />}
      getAnchorRect={() => new DOMRect(props.target.x, props.target.y, 0, 0)}
      items={fileTreeMenuEntries(props)}
      onSelect={select}
      onClose={props.close}
    />
  )
}
