import type { PianoSynth } from './pianoSynth'
import type { PreviewStroke } from './previewPlanner'

const STROKE_INTERVAL_MS = 300
const NOTE_LENGTH_RATIO = 0.8

export function playPreview(synth: PianoSynth, strokes: PreviewStroke[], onEnd: () => void): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const sounding = new Set<number>()
  let stopped = false

  const schedule = (fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, delay)
    timers.add(id)
  }

  let at = 0
  for (const stroke of strokes) {
    if (stroke.pauseBefore) at += STROKE_INTERVAL_MS
    schedule(() => {
      for (const note of stroke.noteNumbers) {
        synth.noteOn(note, stroke.velocity)
        sounding.add(note)
      }
    }, at)
    schedule(() => {
      for (const note of stroke.noteNumbers) {
        synth.noteOff(note)
        sounding.delete(note)
      }
    }, at + STROKE_INTERVAL_MS * NOTE_LENGTH_RATIO)
    at += STROKE_INTERVAL_MS
  }
  schedule(() => {
    stopped = true
    onEnd()
  }, at)

  return () => {
    if (stopped) return
    stopped = true
    for (const id of timers) clearTimeout(id)
    timers.clear()
    for (const note of sounding) synth.noteOff(note)
    sounding.clear()
  }
}
