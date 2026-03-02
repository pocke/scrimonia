import type { LayerKeymap } from '../types'
import { hidCodeToChar } from './hidKeycodes'

export interface NoteHint {
  noteNumbers: number[]
  noteNames: string[]
  velocity: [number, number] | null
}

/** 文字 → その文字を入力できるMIDIノート情報の逆引きテーブル */
export type ReverseKeymap = Map<string, NoteHint[]>

// hidCodeToChar の表示名と event.key / テキスト中の文字が異なるもの
const DISPLAY_TO_EVENT_KEY: Record<string, string> = {
  'Space': ' ',
  'Esc': 'Escape',
  'Enter': '\n',
}

function addHint(map: ReverseKeymap, key: string, hint: NoteHint) {
  const existing = map.get(key) ?? []
  existing.push(hint)
  map.set(key, existing)
}

/**
 * KeymapEntry の配列から、文字 → ノート情報の逆引きテーブルを構築する。
 * modifier エントリはスキップする（タイピングゲームでは文字入力のみ対象）。
 */
export function buildReverseKeymap(keymap: LayerKeymap): ReverseKeymap {
  const reverse: ReverseKeymap = new Map()

  for (const entry of keymap) {
    if (entry.type === 'modifier') continue

    const displayChar = hidCodeToChar(entry.hidCode, entry.type)
    const hint: NoteHint = {
      noteNumbers: entry.noteNumbers,
      noteNames: entry.noteNames,
      velocity: entry.velocity,
    }

    addHint(reverse, displayChar, hint)

    // 表示名と実際のキー値が異なる場合、両方で検索できるようにする
    const eventKey = DISPLAY_TO_EVENT_KEY[displayChar]
    if (eventKey) {
      addHint(reverse, eventKey, hint)
    }
  }

  return reverse
}
