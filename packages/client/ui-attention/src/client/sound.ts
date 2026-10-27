/**
 * Synthesized reminder chime.
 *
 * Browsers refuse to start audio without a user gesture, so the chime stays
 * silent until the page has seen one pointer, key, or touch press; after that
 * window the context is resumed and later reminders play. A reminder that
 * arrives before the first gesture is not replayed later — a stale chime
 * would announce work the user has already moved past.
 */

/** One upward two-tone chime; synthesized so no audio asset ships with the plugin. */
export interface AttentionChime {
  /**
   * Start waiting for the first user gesture that unlocks audio.
   * @returns the disposer removing any pending listeners.
   */
  arm(): () => void
  /**
   * Play the chime once.
   * @returns whether audio was unlocked and the chime actually played.
   */
  play(): boolean
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

/** Two ascending tones, in seconds from the context's current time. */
const TONES = [
  { frequency: 880, start: 0, duration: 0.09 },
  { frequency: 1174.66, start: 0.1, duration: 0.14 },
] as const

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
    play: () => {
      const created = ensure()
      if (created === undefined || created.state !== 'running') return false
      const start = created.currentTime
      for (const tone of TONES) {
        const oscillator = created.createOscillator()
        const gain = created.createGain()
        const from = start + tone.start
        const to = from + tone.duration
        oscillator.frequency.value = tone.frequency
        gain.gain.setValueAtTime(0.0001, from)
        gain.gain.exponentialRampToValueAtTime(0.18, from + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, to)
        oscillator.connect(gain)
        gain.connect(created.destination)
        oscillator.start(from)
        oscillator.stop(to)
      }
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
