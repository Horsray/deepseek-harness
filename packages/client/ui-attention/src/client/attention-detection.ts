/**
 * Reminder detection over one Session status snapshot.
 *
 * Detection is a pure fold: the same snapshot and memory always produce the
 * same count and the same announcements. Memory records what was already
 * announced so a burst of status changes cannot repeat a reminder, and a
 * settled request or an acknowledged completion clears its own record so the
 * next occurrence can be announced again.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AttentionNoticeKind } from './attention-store.ts'

/** Session row facts detection reads. */
export interface DetectionRow {
  /** Human-facing Session label captured into the reminder sentence. */
  readonly displayTitle: string
  readonly retainedBy: { readonly mainView?: number }
}

/** Status facts detection reads from one Session entry. */
export interface DetectionStatus {
  readonly pendingInteraction: { readonly key: string; readonly kind: string } | undefined
  readonly completionUnread: boolean
}

/** What previous passes already announced. */
export interface DetectionMemory {
  /** Pending-interaction request key already announced per Session. */
  readonly interactions: Map<SessionId, string>
  /** Sessions whose completion was already announced. */
  readonly completions: Set<SessionId>
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
 * Whether one Session's asking card is already in front of the user.
 * @param row - Session row, absent when the list does not carry the Session.
 * @param visible - whether the page is currently visible.
 * @returns true when the Session is the main view on a visible page.
 */
function inForeground(row: DetectionRow | undefined, visible: boolean): boolean {
  if (row === undefined || (row.retainedBy.mainView ?? 0) <= 0) return false
  return visible
}

/**
 * Fold one status snapshot into the page-icon count and the reminders to announce.
 * @param memory - announcements from earlier passes; updated in place.
 * @param statuses - unified Session status snapshot.
 * @param byId - Session rows addressed by the same ids.
 * @param visible - whether the page is currently visible.
 * @param baseline - false on the first pass, which adopts existing facts silently.
 * @returns the count and the reminders that appeared in this pass.
 */
export function detectReminders(
  memory: DetectionMemory,
  statuses: ReadonlyMap<SessionId, DetectionStatus>,
  byId: Readonly<Partial<Record<SessionId, DetectionRow>>>,
  visible: boolean,
  baseline: boolean,
): DetectionResult {
  const notices: DetectedNotice[] = []
  let count = 0
  for (const [sessionId, status] of statuses) {
    const row = byId[sessionId]
    const interaction = status.pendingInteraction
    if (interaction !== undefined) {
      const foreground = inForeground(row, visible)
      if (!foreground) count += 1
      const key = interaction.key
      if (memory.interactions.get(sessionId) !== key) {
        memory.interactions.set(sessionId, key)
        if (baseline && !foreground) {
          notices.push({ sessionId, title: row?.displayTitle ?? sessionId, kind: noticeKindOf(interaction.kind) })
        }
      }
    } else {
      memory.interactions.delete(sessionId)
    }
    if (status.completionUnread) {
      count += 1
      if (!memory.completions.has(sessionId)) {
        memory.completions.add(sessionId)
        if (baseline) {
          notices.push({ sessionId, title: row?.displayTitle ?? sessionId, kind: 'completion' })
        }
      }
    } else {
      memory.completions.delete(sessionId)
    }
  }
  return { count, notices }
}
