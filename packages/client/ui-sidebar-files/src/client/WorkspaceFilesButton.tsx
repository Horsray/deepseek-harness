/**
 * The conversation header's entry into the Workspace files tab.
 *
 * It sits beside the other session utilities and opens (or reveals) the same
 * `files` page the sidebar's guide and shortcut open, so there is one tab and
 * one page however the reader arrives.
 */
import type { ReactNode } from 'react'
import { IconWorkspaceTreeOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from './locales.ts'
import css from './WorkspaceFilesButton.module.css'

/** What the header control asks of its plugin: reveal the Workspace files tab. */
export interface WorkspaceFilesButtonInjected {
  /** Open or reveal the `files` page in the on-screen Session's sidebar. */
  readonly open: () => void
}

/** Full props of the header contribution. */
export type WorkspaceFilesButtonProps =
  & PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<'sidebarFiles'>
  & InjectFace<WorkspaceFilesButtonInjected>

/**
 * Render the header entry into the Workspace files tab.
 * @param props - the session scope, copy, and the injected open gesture.
 * @returns one icon button.
 */
export function WorkspaceFilesButton({ open, t }: WorkspaceFilesButtonProps): ReactNode {
  const label = t('header.open')
  return (
    <Tooltip label={label} side="bottom" delayMs={500}>
      <button type="button" className={css.control} aria-label={label} data-workspace-files-open onClick={open}>
        <IconWorkspaceTreeOutlineRegular size={17} />
      </button>
    </Tooltip>
  )
}
