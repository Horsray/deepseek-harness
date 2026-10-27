/** Synthesized reminder chime: unlock gating and playback. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAttentionChime } from '../src/client/sound.ts'

class FakeOscillator {
  readonly frequency = { value: 0 }
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

describe('attention chime', () => {
  it('stays unavailable without an audio implementation', () => {
    Reflect.deleteProperty(globalThis, 'AudioContext')
    const chime = createAttentionChime()
    expect(chime.play()).toBe(false)
    chime.dispose()
  })

  it('plays two tones once the context is running', () => {
    const contexts: FakeAudioContext[] = []
    class TrackedContext extends FakeAudioContext {
      constructor() { super(); contexts.push(this) }
    }
    Object.defineProperty(globalThis, 'AudioContext', { value: TrackedContext, configurable: true })
    const chime = createAttentionChime()
    expect(chime.play()).toBe(true)
    expect(contexts).toHaveLength(1)
    expect(contexts[0]!.oscillators).toHaveLength(2)
    expect(contexts[0]!.oscillators.map(oscillator => oscillator.started)).toEqual([
      [contexts[0]!.oscillators[0]!.started[0]],
      [contexts[0]!.oscillators[1]!.started[0]],
    ])
    chime.dispose()
  })

  it('stays silent while the context is suspended and resumes after disposal is refused', async () => {
    class SuspendedContext extends FakeAudioContext {
      override state: AudioContextState = 'suspended'
      override resume(): Promise<void> { return Promise.reject(new Error('blocked')) }
    }
    Object.defineProperty(globalThis, 'AudioContext', { value: SuspendedContext, configurable: true })
    const chime = createAttentionChime()
    expect(chime.play()).toBe(false)
    chime.dispose()
  })
})
