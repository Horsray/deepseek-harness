/** Reminder detection fold: what to announce and what to count. */
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { detectReminders, noticeKindOf, type DetectionMemory, type DetectionStatus } from '../src/client/attention-detection.ts'

const asking = 'detection-asking' as SessionId
const working = 'detection-working' as SessionId
const child = 'detection-child' as SessionId

/** Fresh memory for one test. */
function memory(): DetectionMemory {
  return { interactions: new Map(), running: new Map() }
}

/** Session rows addressed by the sample ids. */
const rows = {
  [asking]: { displayTitle: 'Asking' },
  [working]: { displayTitle: 'Working' },
  [child]: { displayTitle: 'Child', origin: 'subagent' as const },
}

/** One status entry asking for approval. */
function waiting(key: string, kind = 'approval'): DetectionStatus {
  return { running: false, pendingInteraction: { key, kind }, completionUnread: false }
}

describe('reminder detection', () => {
  it('maps domain kinds onto reminder categories', () => {
    expect(noticeKindOf('approval')).toBe('approval')
    expect(noticeKindOf('plan-review')).toBe('plan-review')
    expect(noticeKindOf('question')).toBe('question')
    expect(noticeKindOf('something-else')).toBe('question')
  })

  it('adopts the first snapshot silently while still counting it', () => {
    const statuses = new Map<SessionId, DetectionStatus>([[asking, waiting('k1')]])
    const result = detectReminders(memory(), statuses, rows, false)
    expect(result.notices).toEqual([])
    expect(result.count).toBe(1)
  })

  it('announces a new interaction once and counts it until it settles', () => {
    const store = memory()
    const waitingRows = new Map<SessionId, DetectionStatus>([[asking, waiting('k1')]])
    expect(detectReminders(store, waitingRows, rows, true).notices).toEqual([
      { sessionId: asking, title: 'Asking', kind: 'approval' },
    ])
    expect(detectReminders(store, waitingRows, rows, true).notices).toEqual([])
    expect(detectReminders(store, waitingRows, rows, true).count).toBe(1)
    const settled = new Map<SessionId, DetectionStatus>([
      [asking, { running: false, pendingInteraction: undefined, completionUnread: false }],
    ])
    expect(detectReminders(store, settled, rows, true)).toMatchObject({ count: 0, notices: [] })
    // A replacement request after the first settled is a new reminder.
    expect(detectReminders(store, new Map([[asking, waiting('k2', 'question')]]), rows, true).notices).toEqual([
      { sessionId: asking, title: 'Asking', kind: 'question' },
    ])
  })

  it('announces the Turn end on the running-to-idle edge', () => {
    const store = memory()
    const running = new Map<SessionId, DetectionStatus>([
      [working, { running: true, pendingInteraction: undefined, completionUnread: false }],
    ])
    // The first pass only records the running state.
    expect(detectReminders(store, running, rows, false).notices).toEqual([])
    const finished = new Map<SessionId, DetectionStatus>([
      [working, { running: false, pendingInteraction: undefined, completionUnread: true }],
    ])
    expect(detectReminders(store, finished, rows, true).notices).toEqual([
      { sessionId: working, title: 'Working', kind: 'completion' },
    ])
    expect(detectReminders(store, finished, rows, true).notices).toEqual([])
    expect(detectReminders(store, finished, rows, true).count).toBe(1)
  })

  it('does not announce a finished subagent Turn', () => {
    const store = memory()
    detectReminders(store, new Map([[child, { running: true, pendingInteraction: undefined, completionUnread: false }]]), rows, false)
    const finished = new Map<SessionId, DetectionStatus>([
      [child, { running: false, pendingInteraction: undefined, completionUnread: false }],
    ])
    expect(detectReminders(store, finished, rows, true).notices).toEqual([])
  })

  it('announces while the page is in front, because a stalled request stays stalled', () => {
    const store = memory()
    const first = new Map<SessionId, DetectionStatus>([[asking, waiting('k9')]])
    detectReminders(store, first, rows, false)
    const next = new Map<SessionId, DetectionStatus>([[asking, waiting('k10')]])
    expect(detectReminders(store, next, rows, true).notices).toHaveLength(1)
  })

  it('falls back to the Session id when the list carries no row', () => {
    expect(detectReminders(memory(), new Map([[asking, waiting('k3')]]), {}, true).notices).toEqual([
      { sessionId: asking, title: asking, kind: 'approval' },
    ])
  })
})
