/**
 * Synthesized reminder chime with three timbres.
 *
 * Electron allows audio without a gesture, so a reminder is audible even
 * before the first click; a plain browser keeps the context suspended until a
 * gesture, and resuming here means the tones scheduled with a reminder play as
 * soon as that gesture arrives instead of being dropped. Timbres are
 * synthesized with harmonics so the package ships no audio asset.
 */

import { DEFAULT_SOUND_PRESET, type SoundPreset } from '../attention-settings.ts'

/** Reminder chime player. */
export interface AttentionChime {
  /**
   * Start waiting for the first user gesture that unlocks audio.
   * @returns the disposer removing any pending listeners.
   */
  arm(): () => void
  /**
   * Play the chime once.
   * @param preset - timbre to synthesize; the default timbre applies when omitted.
   * @returns whether an audio context was available to schedule the tones.
   */
  play(preset?: SoundPreset): boolean
  /** Release the audio context and pending listeners. */
  dispose(): void
}

/** Web Audio constructor as a plain factory reference. */
interface AudioContextConstructor {
  new (contextOptions?: AudioContextOptions): AudioContext
}

/** Global scope as the two constructors may appear. */
interface AudioScope {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
}

/** Browsers ship WebKit's prefixed constructor only before `AudioContext` was standard. */
function audioContextConstructor(): AudioContextConstructor | undefined {
  const scope: AudioScope = globalThis
  return scope.AudioContext ?? scope.webkitAudioContext
}

/** Unlock event types that browsers accept as a user gesture. */
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const

/** One harmonic partial of a synthesized note. */
interface Harmonic {
  /** Frequency multiplier over the fundamental. */
  readonly ratio: number
  /** Relative level of this partial. */
  readonly gain: number
}

/** One note of a timbre. */
interface Tone {
  readonly frequency: number
  /** Seconds after the chime starts. */
  readonly start: number
  readonly duration: number
  /** Peak level of the note. */
  readonly volume: number
  readonly harmonics: readonly Harmonic[]
  readonly wave: OscillatorType
}

/** Bright glass timbre: high, quick decay, four partials. */
const GLASS: readonly Tone[] = [{
  frequency: 880, start: 0, duration: 0.6, volume: 0.12, wave: 'sine',
  harmonics: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.5 }, { ratio: 3, gain: 0.25 }, { ratio: 4, gain: 0.1 }],
}]

/** Rising timbre: E5, A5, C6 arpeggio, soft partials. */
const ASCENDING: readonly Tone[] = [
  { frequency: 659.25, start: 0, duration: 0.5, volume: 0.1, wave: 'sine', harmonics: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.3 }] },
  { frequency: 880, start: 0.09, duration: 0.5, volume: 0.1, wave: 'sine', harmonics: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.3 }] },
  { frequency: 1046.5, start: 0.18, duration: 0.5, volume: 0.1, wave: 'sine', harmonics: [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.3 }] },
]

/** Warm marimba timbre: low fundamental with strong fourth and eighth partials. */
const MARIMBA: readonly Tone[] = [{
  frequency: 523.25, start: 0, duration: 0.4, volume: 0.12, wave: 'sine',
  harmonics: [{ ratio: 1, gain: 0.6 }, { ratio: 4, gain: 1 }, { ratio: 8, gain: 0.4 }],
}]

/** Timbres by preset id. */
const TIMBRES: Readonly<Record<SoundPreset, readonly Tone[]>> = {
  glass: GLASS,
  ascending: ASCENDING,
  marimba: MARIMBA,
}

/**
 * Schedule every partial of every tone on one context.
 * @param context - running audio context.
 * @param tones - timbre to schedule.
 */
function schedule(context: AudioContext, tones: readonly Tone[]): void {
  const start = context.currentTime
  for (const tone of tones) {
    for (const harmonic of tone.harmonics) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const from = start + tone.start
      const to = from + tone.duration
      oscillator.type = tone.wave
      oscillator.frequency.setValueAtTime(tone.frequency * harmonic.ratio, from)
      gain.gain.setValueAtTime(0.0001, from)
      gain.gain.exponentialRampToValueAtTime(tone.volume * harmonic.gain, from + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, to)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(from)
      oscillator.stop(to + 0.05)
    }
  }
}

/**
 * Create the chime player.
 * @returns the chime with its unlock, play, and disposal operations.
 */
export function createAttentionChime(): AttentionChime {
  let context: AudioContext | undefined
  let disarmed = false

  const ensure = (): AudioContext | undefined => {
    if (disarmed) return undefined
    if (context !== undefined) return context
    const Constructor = audioContextConstructor()
    if (Constructor === undefined) return undefined
    try {
      context = new Constructor()
    } catch (_unsupportedAudio) {
      // A policy or platform may refuse construction outright; the reminder
      // itself still stands, so the chime simply stays unavailable.
      return undefined
    }
    return context
  }

  const resume = (): void => {
    const created = ensure()
    if (created === undefined) return
    if (created.state === 'suspended') void created.resume().catch(() => {
      // A refused resume leaves the context suspended; the next user gesture
      // retries rather than reporting a failure the user cannot act on.
    })
  }

  let disarm = (): void => {}
  const arm = (): (() => void) => {
    if (typeof window === 'undefined') return () => {}
    const unlock = (): void => {
      resume()
      disarm()
    }
    for (const type of GESTURES) window.addEventListener(type, unlock, { capture: true })
    disarm = () => {
      for (const type of GESTURES) window.removeEventListener(type, unlock, { capture: true })
      disarm = () => {}
    }
    return () => { disarm() }
  }

  return {
    arm,
    play: (preset = DEFAULT_SOUND_PRESET) => {
      const created = ensure()
      if (created === undefined) return false
      // A plain browser keeps the context suspended until a gesture; resuming
      // here lets the scheduled tones play as soon as that gesture arrives.
      if (created.state === 'suspended') void created.resume().catch(() => {})
      schedule(created, TIMBRES[preset])
      return true
    },
    dispose: () => {
      disarmed = true
      disarm()
      const created = context
      context = undefined
      if (created !== undefined && created.state !== 'closed') void created.close().catch(() => {
        // Closing a context already torn down by the page cannot fail the
        // plugin's disposal; nothing reads the chime afterwards.
      })
    },
  }
}
