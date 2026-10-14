import type { Synth } from './synth'
import type { PreviewStroke } from './previewPlanner'

export const STROKE_INTERVAL_MS = 300
const NOTE_LENGTH_RATIO = 0.8

interface PlayOptions {
  intervalMs?: number
  /** strokes のこの位置から再生する。 */
  startIndex?: number
  /** 打鍵の音を鳴らす時点でその打鍵の index を、再生が終わるか止めたときに null を渡す。 */
  onStroke?: (index: number | null) => void
}

export function playPreview(
  synth: Synth,
  strokes: PreviewStroke[],
  onEnd: () => void,
  { intervalMs = STROKE_INTERVAL_MS, startIndex = 0, onStroke }: PlayOptions = {},
): () => void {
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
  for (let i = startIndex; i < strokes.length; i++) {
    const stroke = strokes[i]
    if (stroke.pauseBefore && i > startIndex) at += intervalMs
    schedule(() => {
      onStroke?.(i)
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
    }, at + intervalMs * NOTE_LENGTH_RATIO)
    at += intervalMs
  }
  schedule(() => {
    stopped = true
    onStroke?.(null)
    onEnd()
  }, at)

  return () => {
    if (stopped) return
    stopped = true
    for (const id of timers) clearTimeout(id)
    timers.clear()
    for (const note of sounding) synth.noteOff(note)
    sounding.clear()
    onStroke?.(null)
  }
}
