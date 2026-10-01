import type { KeymapEntry, LayerKeymap } from '../types'

/**
 * デバイスが USB MIDI でも PC に送る単音パススルーの鍵盤か判定する。
 * パススルーの音は Web MIDI 側で出力ノートとして鳴るので、シリアル側でも鳴らすと二重になる。
 * ファームの find_action と同じく、velocity 条件付きで最初に一致したエントリを優先し、
 * なければ条件なしの最後のエントリを採る。
 */
export function isMidiPassthroughNote(layer: LayerKeymap | null, note: number, velocity: number): boolean {
  if (!layer) return false
  let fallback: KeymapEntry | undefined
  for (const entry of layer) {
    if (entry.noteNumbers.length !== 1 || entry.noteNumbers[0] !== note) continue
    if (entry.velocity === null) {
      fallback = entry
    } else if (entry.velocity[0] <= velocity && velocity <= entry.velocity[1]) {
      return entry.type === 'midi'
    }
  }
  return fallback?.type === 'midi'
}
