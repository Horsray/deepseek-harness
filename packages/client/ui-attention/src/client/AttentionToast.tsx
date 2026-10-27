/**
 * One app-wide reminder banner rendered in the shell overlay.
 *
 * The overlay entry lives outside the Chat panel and every Session binding, so
 * a reminder survives switching or closing the panel that produced it. The
 * banner shows the sentence for the notice on display and retires it once the
 * shared toast primitive finishes fading.
 */

import type { ReactNode } from 'react'
import { IconWarningOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { AttentionNotice, AttentionNoticeKind } from './attention-store.ts'
import type { AttentionToastKey } from './locales.ts'

/** Reminder queue and dismissal supplied by the plugin's inject face. */
export interface AttentionToastInjected {
  hooks: { notice: ObservableSnapshot<AttentionNotice | null> }
  dismiss(seq: number): void
}

/** Copy key per reminder category; the generic question sentence covers unknown kinds. */
function sentenceKey(kind: AttentionNoticeKind): AttentionToastKey {
  switch (kind) {
    case 'approval': return 'toast.interaction.approval'
    case 'plan-review': return 'toast.interaction.planReview'
    case 'question': return 'toast.interaction.question'
    case 'completion': return 'toast.completion'
  }
}

/**
 * Render the reminder on display.
 * @param props - the notice hook, its dismissal, and the locale seat.
 * @returns the banner, or null while the queue is empty.
 */
export function AttentionToast({ useNotice, dismiss, t }:
PropsRuntime<'shell.overlay'> & PropsLocale<'attention'> & InjectFace<AttentionToastInjected>): ReactNode {
  const notice = useNotice(value => value)
  if (notice === null) return null
  const text = notice.text ?? t(sentenceKey(notice.kind), { title: notice.title })
  return notice.kind === 'completion'
    ? <Toast key={`attention-${String(notice.seq)}`} text={text} tone="success" onDone={() => { dismiss(notice.seq) }} />
    : <Toast
      key={`attention-${String(notice.seq)}`}
      text={text}
      icon={<IconWarningOutlineRegular />}
      holdMs={4000}
      onDone={() => { dismiss(notice.seq) }}
    />
}
