/**
 * Reminder detection over one Session status snapshot.
 *
 * Two facts need the user: a Session that started waiting for an approval,
 * plan review, or answer, and a Session whose Turn just ended. Detection is a
 * pure fold so the count and the announcements are reproducible from the
 * snapshot.
 *
 * Neither fact is filtered by focus or by whether the Session is on screen.
 * A desktop window that has lost focus keeps `document.visibilityState` at
 * `visible`, so no client-side signal reliably tells "the user is watching";
 * approximating it drops reminders exactly when the work is stalled behind an
 * unanswered request. Reminders fire on the appearance of a new request and on
 * a running-to-idle edge, once each.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AttentionNoticeKind } from './attention-store.ts'

/** Session row facts detection reads. */
export interface DetectionRow {
  /** Human-facing Session label captured into the reminder sentence. */
  readonly displayTitle: string
  /** Subagent children finish constantly; their Turns are not the user's work. */
  readonly origin?: 'subagent'
}

/** Status facts detection reads from one Session entry. */
export interface DetectionStatus {
  /** Latest known running state; absent until a baseline establishes it. */
  readonly running: boolean | undefined
  readonly pendingInteraction: { readonly key: string; readonly kind: string } | undefined
  /** Unacknowledged background completion, used for the icon count. */
  readonly completionUnread: boolean
}

/** What previous passes already observed. */
export interface DetectionMemory {
  /** Pending-interaction request key already announced per Session. */
  readonly interactions: Map<SessionId, string>
  /** Running state observed in the previous pass, for the ending edge. */
  readonly running: Map<SessionId, boolean | undefined>
}

/** One reminder to announce. */
export interface DetectedNotice {
  readonly sessionId: SessionId
  /** Session title captured now, before a later rename can rewrite it. */
  readonly title: string
  readonly kind: AttentionNoticeKind
}

/** One detection pass. */
export interface DetectionResult {
  /** Unacknowledged facts to show on the page icon. */
  readonly count: number
  /** Reminders that appeared in this pass, in status order. */
  readonly notices: readonly DetectedNotice[]
}

/**
 * Map a domain interaction discriminator onto a reminder category.
 * @param kind - pending-interaction `kind` published by its domain.
 * @returns the reminder category; unknown domain kinds read as a question.
 */
export function noticeKindOf(kind: string): AttentionNoticeKind {
  return kind === 'approval' || kind === 'plan-review' ? kind : 'question'
}

/**
 * Fold one status snapshot into the page-icon count and the reminders to announce.
 * @param memory - observations from earlier passes; updated in place.
 * @param statuses - unified Session status snapshot.
 * @param byId - Session rows addressed by the same ids.
 * @param baseline - false on the first pass, which adopts existing facts silently.
 * @returns the count and the reminders that appeared in this pass.
 */
export function detectReminders(
  memory: DetectionMemory,
  statuses: ReadonlyMap<SessionId, DetectionStatus>,
  byId: Readonly<Partial<Record<SessionId, DetectionRow>>>,
  baseline: boolean,
): DetectionResult {
  const notices: DetectedNotice[] = []
  let count = 0
  for (const [sessionId, status] of statuses) {
    const row = byId[sessionId]
    const title = row?.displayTitle ?? sessionId
    const interaction = status.pendingInteraction
    if (interaction !== undefined) {
      count += 1
      const key = interaction.key
      if (memory.interactions.get(sessionId) !== key) {
        memory.interactions.set(sessionId, key)
        if (baseline) notices.push({ sessionId, title, kind: noticeKindOf(interaction.kind) })
      }
    } else {
      memory.interactions.delete(sessionId)
    }
    if (status.completionUnread) count += 1
    // The running-to-idle edge is the Turn ending; it fires for the Session on
    // screen too, because finishing work is worth a sound even while watched.
    const previousRunning = memory.running.get(sessionId)
    memory.running.set(sessionId, status.running)
    if (baseline && previousRunning === true && status.running === false && row?.origin !== 'subagent') {
      notices.push({ sessionId, title, kind: 'completion' })
    }
  }
  return { count, notices }
}
