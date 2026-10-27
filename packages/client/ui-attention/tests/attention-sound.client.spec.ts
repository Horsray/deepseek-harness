/** Synthesized reminder chime: unlock gating, timbres, and playback. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAttentionChime } from '../src/client/sound.ts'

class FakeOscillator {
  readonly frequency = { value: 0, setValueAtTime: () => {} }
  type: OscillatorType = 'sine'
  readonly started: number[] = []
  connect(): void {}
  start(time: number): void { this.started.push(time) }
  stop(): void {}
}

class FakeGain {
  readonly gain = {
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  }
  connect(): void {}
}

class FakeAudioContext {
  state: AudioContextState = 'running'
  readonly destination = {}
  readonly oscillators: FakeOscillator[] = []
  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }
  createGain(): FakeGain { return new FakeGain() }
  resume(): Promise<void> { return Promise.resolve() }
  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }
}

const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')

afterEach(() => {
  if (originalAudioContext === undefined) Reflect.deleteProperty(globalThis, 'AudioContext')
  else Object.defineProperty(globalThis, 'AudioContext', originalAudioContext)
  vi.restoreAllMocks()
})

/** Install a context constructor that records its instances. */
function installContext(): FakeAudioContext[] {
  const contexts: FakeAudioContext[] = []
  class TrackedContext extends FakeAudioContext {
    constructor() { super(); contexts.push(this) }
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: TrackedContext, configurable: true })
  return contexts
}

describe('attention chime', () => {
  it('stays unavailable without an audio implementation', () => {
    Reflect.deleteProperty(globalThis, 'AudioContext')
    const chime = createAttentionChime()
    expect(chime.play()).toBe(false)
    chime.dispose()
  })

  it('schedules the glass timbre with its four partials by default', () => {
    const contexts = installContext()
    const chime = createAttentionChime()
    expect(chime.play()).toBe(true)
    expect(contexts).toHaveLength(1)
    expect(contexts[0]!.oscillators).toHaveLength(4)
    chime.dispose()
  })

  it('schedules three rising notes for the ascending timbre', () => {
    const contexts = installContext()
    const chime = createAttentionChime()
    chime.play('ascending')
    expect(contexts[0]!.oscillators).toHaveLength(6)
    chime.dispose()
  })

  it('schedules the marimba timbre with its three partials', () => {
    const contexts = installContext()
    const chime = createAttentionChime()
    chime.play('marimba')
    expect(contexts[0]!.oscillators).toHaveLength(3)
    chime.dispose()
  })

  it('reuses one context across reminders', () => {
    const contexts = installContext()
    const chime = createAttentionChime()
    chime.play('glass')
    chime.play('marimba')
    expect(contexts).toHaveLength(1)
    expect(contexts[0]!.oscillators).toHaveLength(7)
    chime.dispose()
  })

  it('resumes a suspended context and schedules the tones anyway', () => {
    const resumed: FakeAudioContext[] = []
    class SuspendedContext extends FakeAudioContext {
      override state: AudioContextState = 'suspended'
      override resume(): Promise<void> {
        this.state = 'running'
        resumed.push(this)
        return Promise.resolve()
      }
    }
    Object.defineProperty(globalThis, 'AudioContext', { value: SuspendedContext, configurable: true })
    const chime = createAttentionChime()
    expect(chime.play()).toBe(true)
    expect(resumed).toHaveLength(1)
    chime.dispose()
  })

  it('closes the audio context on disposal and stops playing afterwards', () => {
    const contexts = installContext()
    const chime = createAttentionChime()
    chime.play()
    chime.dispose()
    expect(contexts[0]!.state).toBe('closed')
    expect(chime.play()).toBe(false)
  })
})
