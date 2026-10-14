import { renderKotoWaveform } from './kotoWaveform'

const MIN_GAIN = 0.0001
const PEAK_GAIN = 0.8

const LOWPASS_MIN_HZ = 2500
const LOWPASS_MAX_HZ = 14000
const LOWPASS_Q_DB = -3

const BODY_RESONANCES = [
  { frequency: 1400, q: 1.5, gain: 2 },
]

const PITCH_BEND_MAX_CENTS = 10
const PITCH_BEND_SEC = 0.08

const bufferCache = new Map<number, AudioBuffer>()
let cachedSampleRate = 0

function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

function getBuffer(ctx: AudioContext, note: number): AudioBuffer {
  if (cachedSampleRate !== ctx.sampleRate) {
    bufferCache.clear()
    cachedSampleRate = ctx.sampleRate
  }
  let buffer = bufferCache.get(note)
  if (!buffer) {
    const samples = renderKotoWaveform(midiNoteToFrequency(note), ctx.sampleRate)
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buffer.copyToChannel(samples, 0)
    bufferCache.set(note, buffer)
  }
  return buffer
}

export class KotoVoice {
  private ctx: AudioContext
  private source: AudioBufferSourceNode
  private gain: GainNode
  private filters: BiquadFilterNode[] = []
  private released = false
  private naturalEndTime: number

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    note: number,
    velocity: number,
    onEnded: () => void,
  ) {
    this.ctx = ctx
    const now = ctx.currentTime
    const buffer = getBuffer(ctx, note)
    const strength = velocity / 127
    this.naturalEndTime = now + buffer.duration

    this.source = ctx.createBufferSource()
    this.source.buffer = buffer
    const bendCents = PITCH_BEND_MAX_CENTS * strength
    this.source.playbackRate.setValueAtTime(Math.pow(2, bendCents / 1200), now)
    this.source.playbackRate.exponentialRampToValueAtTime(1, now + PITCH_BEND_SEC)

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.Q.value = LOWPASS_Q_DB
    lowpass.frequency.value = LOWPASS_MIN_HZ * Math.pow(LOWPASS_MAX_HZ / LOWPASS_MIN_HZ, strength)
    this.filters.push(lowpass)

    for (const r of BODY_RESONANCES) {
      const peaking = ctx.createBiquadFilter()
      peaking.type = 'peaking'
      peaking.frequency.value = r.frequency
      peaking.Q.value = r.q
      peaking.gain.value = r.gain
      this.filters.push(peaking)
    }

    this.gain = ctx.createGain()
    this.gain.gain.value = strength * PEAK_GAIN

    let node: AudioNode = this.source
    for (const f of this.filters) {
      node.connect(f)
      node = f
    }
    node.connect(this.gain).connect(destination)

    this.source.onended = () => {
      this.source.disconnect()
      for (const f of this.filters) f.disconnect()
      this.gain.disconnect()
      onEnded()
    }
    this.source.start(now)
  }

  release(releaseSec: number) {
    if (this.released) return
    this.released = true
    const now = this.ctx.currentTime
    const current = Math.max(this.gain.gain.value, MIN_GAIN)
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(current, now)
    const endTime = Math.min(now + releaseSec, this.naturalEndTime)
    this.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, endTime)
    this.source.stop(endTime + 0.05)
  }
}
