function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

interface Partial {
  ratio: number
  gain: number
}

const PIANO_PARTIALS: Partial[] = [
  { ratio: 1, gain: 1.0 },
  { ratio: 2, gain: 0.45 },
  { ratio: 3, gain: 0.2 },
  { ratio: 4, gain: 0.1 },
  { ratio: 5, gain: 0.05 },
]

const ATTACK_SEC = 0.005
const NATURAL_DECAY_SEC = 6
const RELEASE_SEC = 0.25
const MIN_GAIN = 0.0001

class Voice {
  private ctx: AudioContext
  private oscillators: OscillatorNode[] = []
  private gain: GainNode
  private released = false

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    note: number,
    velocity: number,
    onEnded: () => void,
  ) {
    this.ctx = ctx
    const freq = midiNoteToFrequency(note)
    const now = ctx.currentTime
    const peak = Math.max(velocity, 1) / 127 * 0.5

    this.gain = ctx.createGain()
    this.gain.gain.setValueAtTime(0, now)
    this.gain.gain.linearRampToValueAtTime(peak, now + ATTACK_SEC)
    this.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + ATTACK_SEC + NATURAL_DECAY_SEC)
    this.gain.connect(destination)

    for (const p of PIANO_PARTIALS) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * p.ratio
      const partialGain = ctx.createGain()
      partialGain.gain.value = p.gain
      osc.connect(partialGain).connect(this.gain)
      osc.start(now)
      osc.stop(now + ATTACK_SEC + NATURAL_DECAY_SEC + 0.1)
      this.oscillators.push(osc)
    }
    const last = this.oscillators[this.oscillators.length - 1]
    last.onended = () => {
      this.gain.disconnect()
      onEnded()
    }
  }

  release() {
    if (this.released) return
    this.released = true
    const now = this.ctx.currentTime
    const current = Math.max(this.gain.gain.value, MIN_GAIN)
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(current, now)
    this.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + RELEASE_SEC)
    for (const osc of this.oscillators) {
      osc.stop(now + RELEASE_SEC + 0.05)
    }
  }
}

export class PianoSynth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private voices = new Map<number, Voice>()

  private ensureContext(): { ctx: AudioContext; master: GainNode } {
    if (!this.ctx || !this.master) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return { ctx: this.ctx, master: this.master }
  }

  noteOn(note: number, velocity: number) {
    const { ctx, master } = this.ensureContext()
    this.voices.get(note)?.release()
    const voice = new Voice(ctx, master, note, velocity, () => {
      if (this.voices.get(note) === voice) {
        this.voices.delete(note)
      }
    })
    this.voices.set(note, voice)
  }

  noteOff(note: number) {
    this.voices.get(note)?.release()
    this.voices.delete(note)
  }

  releaseAll() {
    for (const v of this.voices.values()) v.release()
    this.voices.clear()
  }

  destroy() {
    this.releaseAll()
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}
