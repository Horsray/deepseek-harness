/** Reminder detection fold: what to announce and what to count. */
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { detectReminders, noticeKindOf, type DetectionMemory, type DetectionStatus } from '../src/client/attention-detection.ts'

const asking = 'detection-asking' as SessionId
const busy = 'detection-busy' as SessionId

/** Fresh memory for one test. */
function memory(): DetectionMemory {
  return { interactions: new Map(), completions: new Set() }
}

/** Session rows addressed by the sample ids. */
const rows = {
  [asking]: { displayTitle: 'Asking', retainedBy: {} },
  [busy]: { displayTitle: 'Busy', retainedBy: { mainView: 1 } },
}

describe('reminder detection', () => {
  it('maps domain kinds onto reminder categories', () => {
    expect(noticeKindOf('approval')).toBe('approval')
    expect(noticeKindOf('plan-review')).toBe('plan-review')
    expect(noticeKindOf('question')).toBe('question')
    expect(noticeKindOf('something-else')).toBe('question')
  })

  it('adopts the first snapshot silently', () => {
    const statuses = new Map<SessionId, DetectionStatus>([
      [asking, { pendingInteraction: { key: 'k1', kind: 'approval' }, completionUnread: false }],
    ])
    const result = detectReminders(memory(), statuses, rows, true, false)
    expect(result.notices).toEqual([])
    expect(result.count).toBe(1)
  })

  it('announces a new interaction once and counts it until it settles', () => {
    const store = memory()
    const waiting = new Map<SessionId, DetectionStatus>([
      [asking, { pendingInteraction: { key: 'k1', kind: 'approval' }, completionUnread: false }],
    ])
    expect(detectReminders(store, waiting, rows, true, true).notices).toEqual([
      { sessionId: asking, title: 'Asking', kind: 'approval' },
    ])
    expect(detectReminders(store, waiting, rows, true, true).notices).toEqual([])
    expect(detectReminders(store, waiting, rows, true, true).count).toBe(1)
    const settled = new Map<SessionId, DetectionStatus>([
      [asking, { pendingInteraction: undefined, completionUnread: false }],
    ])
    expect(detectReminders(store, settled, rows, true, true)).toMatchObject({ count: 0, notices: [] })
  })

  it('suppresses the reminder but not the count for a foreground main-view Session', () => {
    const statuses = new Map<SessionId, DetectionStatus>([
      [busy, { pendingInteraction: { key: 'k2', kind: 'question' }, completionUnread: false }],
    ])
    const result = detectReminders(memory(), statuses, rows, true, true)
    expect(result.notices).toEqual([])
    expect(result.count).toBe(0)
    // The same Session counts once the card is no longer in front of the user.
    expect(detectReminders({ interactions: new Map(), completions: new Set() }, statuses, rows, false, true).count).toBe(1)
  })

  it('announces a completion once and stops counting it after acknowledgement', () => {
    const store = memory()
    const finished = new Map<SessionId, DetectionStatus>([
      [asking, { pendingInteraction: undefined, completionUnread: true }],
    ])
    expect(detectReminders(store, finished, rows, true, true).notices).toEqual([
      { sessionId: asking, title: 'Asking', kind: 'completion' },
    ])
    expect(detectReminders(store, finished, rows, true, true).notices).toEqual([])
    expect(detectReminders(store, finished, rows, true, true).count).toBe(1)
    const acknowledged = new Map<SessionId, DetectionStatus>([
      [asking, { pendingInteraction: undefined, completionUnread: false }],
    ])
    expect(detectReminders(store, acknowledged, rows, true, true)).toMatchObject({ count: 0, notices: [] })
  })

  it('falls back to the Session id when the list carries no row', () => {
    const statuses = new Map<SessionId, DetectionStatus>([
      [asking, { pendingInteraction: { key: 'k3', kind: 'approval' }, completionUnread: false }],
    ])
    expect(detectReminders(memory(), statuses, {}, true, true).notices).toEqual([
      { sessionId: asking, title: asking, kind: 'approval' },
    ])
  })
})
