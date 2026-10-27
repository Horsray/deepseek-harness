/**
 * One queue of reminder notices shared by the overlay toast.
 *
 * The observer publishes the notice on display; a dismissal that has been
 * shown advances to the next queued notice. Notices carry the Session title
 * already resolved at detection time, so a later rename cannot rewrite the
 * sentence the user was shown.
 */

import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Reminder categories the overlay renders. */
export type AttentionNoticeKind = 'approval' | 'plan-review' | 'question' | 'completion'

/** One queued reminder sentence. */
export interface AttentionNotice {
  /** Per-show sequence; a re-show with a fresh sequence restarts the banner. */
  readonly seq: number
  readonly sessionId: SessionId
  /** Session display title captured when the reminder was raised. */
  readonly title: string
  readonly kind: AttentionNoticeKind
}

/** Store the reminder detection reports into and the overlay reads. */
export interface AttentionStore {
  /** Observable notice on display, or null while the queue is empty. */
  readonly hooks: { readonly notice: HostObservable<AttentionNotice | null> }
  /**
   * Queue one reminder.
   * @param notice - session, title, and category to announce.
   */
  show(notice: Omit<AttentionNotice, 'seq'>): void
  /**
   * Retire a displayed reminder and show the one queued behind it.
   * @param seq - sequence the overlay finished showing; a newer notice stays.
   */
  dismiss(seq: number): void
  /** Drop the queue and stop publishing. */
  dispose(): void
}

/**
 * Create the reminder queue one overlay entry renders.
 * @returns the notice observable with its show and dismiss actions.
 */
export function createAttentionStore(): AttentionStore {
  let current: AttentionNotice | null = null
  const queue: AttentionNotice[] = []
  const listeners = new Set<() => void>()
  let seq = 0
  let disposed = false

  const publish = (next: AttentionNotice | null): void => {
    if (next === current) return
    current = next
    for (const listener of listeners) listener()
  }

  const advance = (): void => {
    const next = queue.shift()
    publish(next ?? null)
  }

  return {
    hooks: {
      notice: {
        getSnapshot: () => current,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      },
    },
    show: (notice) => {
      if (disposed) return
      seq += 1
      const entry: AttentionNotice = { ...notice, seq }
      if (current === null) publish(entry)
      // A second reminder waits behind the banner on screen instead of
      // replacing it mid-sentence; a burst of completions must not shorten
      // the first reminder's reading time.
      else queue.push(entry)
    },
    dismiss: (renderedSeq) => {
      if (disposed || current === null || current.seq !== renderedSeq) return
      advance()
    },
    dispose: () => {
      disposed = true
      queue.length = 0
      publish(null)
      listeners.clear()
    },
  }
}
