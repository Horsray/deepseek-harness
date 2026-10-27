/** Reminder queue behaviour shared by the overlay toast. */
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createAttentionStore } from '../src/client/attention-store.ts'

const sessionId = 'attention-store-session' as SessionId

describe('attention store', () => {
  it('publishes nothing until a reminder arrives', () => {
    const store = createAttentionStore()
    expect(store.hooks.notice.getSnapshot()).toBeNull()
    store.dispose()
  })

  it('shows the first reminder immediately and queues the rest behind it', () => {
    const store = createAttentionStore()
    store.show({ sessionId, title: 'Alpha', kind: 'approval' })
    const first = store.hooks.notice.getSnapshot()
    expect(first).toMatchObject({ title: 'Alpha', kind: 'approval' })
    store.show({ sessionId, title: 'Beta', kind: 'completion' })
    expect(store.hooks.notice.getSnapshot()).toBe(first)
    store.dismiss(first!.seq)
    expect(store.hooks.notice.getSnapshot()).toMatchObject({ title: 'Beta', kind: 'completion' })
    store.dispose()
  })

  it('ignores a dismissal for a reminder that is no longer on display', () => {
    const store = createAttentionStore()
    store.show({ sessionId, title: 'Alpha', kind: 'question' })
    const first = store.hooks.notice.getSnapshot()
    store.dismiss((first!.seq) + 1)
    expect(store.hooks.notice.getSnapshot()).toBe(first)
    store.dispose()
  })

  it('notifies subscribers exactly when the displayed reminder changes', () => {
    const store = createAttentionStore()
    let changes = 0
    const unsubscribe = store.hooks.notice.subscribe(() => { changes += 1 })
    store.show({ sessionId, title: 'Alpha', kind: 'approval' })
    store.show({ sessionId, title: 'Beta', kind: 'approval' })
    expect(changes).toBe(1)
    store.dismiss(store.hooks.notice.getSnapshot()!.seq)
    expect(changes).toBe(2)
    unsubscribe()
    store.dispose()
  })

  it('drops the queue on disposal and stops publishing', () => {
    const store = createAttentionStore()
    store.show({ sessionId, title: 'Alpha', kind: 'approval' })
    store.dispose()
    expect(store.hooks.notice.getSnapshot()).toBeNull()
    store.show({ sessionId, title: 'Beta', kind: 'completion' })
    expect(store.hooks.notice.getSnapshot()).toBeNull()
  })
})
