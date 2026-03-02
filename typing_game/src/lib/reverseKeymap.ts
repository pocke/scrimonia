import type { LayerKeymap } from '../types'
import { hidCodeToChar } from './hidKeycodes'

export interface NoteHint {
  noteNumber: number
  noteName: string
  velocity: [number, number] | null
}

/** 文字 → その文字を入力できるMIDIノート情報の逆引きテーブル */
export type ReverseKeymap = Map<string, NoteHint[]>

/**
 * KeymapEntry の配列から、文字 → ノート情報の逆引きテーブルを構築する。
 * modifier エントリはスキップする（タイピングゲームでは文字入力のみ対象）。
 */
export function buildReverseKeymap(keymap: LayerKeymap): ReverseKeymap {
  const reverse: ReverseKeymap = new Map()

  for (const entry of keymap) {
    if (entry.type === 'modifier') continue

    const char = hidCodeToChar(entry.hidCode, entry.type)
    const hint: NoteHint = {
      noteNumber: entry.noteNumber,
      noteName: entry.noteName,
      velocity: entry.velocity,
    }

    const existing = reverse.get(char) ?? []
    existing.push(hint)
    reverse.set(char, existing)
  }

  return reverse
}
