import type { LayerKeymap } from '../types'
import { hidCodeToChar } from './hidKeycodes'

export interface NoteHint {
  noteNumbers: number[]
  noteNames: string[]
  velocity: [number, number] | null
}

export interface MacroHint extends NoteHint {
  text: string
}

/** 逆引きテーブル。1文字を打てるノート情報 (byChar) と、複数文字をまとめて打つマクロ (macros) を分けて持つ。 */
export interface ReverseKeymap {
  byChar: Map<string, NoteHint[]>
  macros: MacroHint[]
}

// hidCodeToChar の表示名と event.key / テキスト中の文字が異なるもの
const DISPLAY_TO_EVENT_KEY: Record<string, string> = {
  'Space': ' ',
  'Esc': 'Escape',
  'Enter': '\n',
}

function addHint(map: Map<string, NoteHint[]>, key: string, hint: NoteHint) {
  const existing = map.get(key) ?? []
  existing.push(hint)
  map.set(key, existing)
}

/**
 * KeymapEntry の配列から、文字 → ノート情報の逆引きテーブルを構築する。
 * modifier / layer エントリはスキップする（タイピングゲームでは文字入力のみ対象）。
 */
export function buildReverseKeymap(keymap: LayerKeymap): ReverseKeymap {
  const byChar = new Map<string, NoteHint[]>()
  const macros: MacroHint[] = []

  for (const entry of keymap) {
    if (entry.type === 'modifier' || entry.type === 'layer') continue

    const hint: NoteHint = {
      noteNumbers: entry.noteNumbers,
      noteNames: entry.noteNames,
      velocity: entry.velocity,
    }

    if (entry.type === 'macro') {
      // Macro.new("") は Ruby 側で有効な値のため、空文字なら "" が remaining の
      // 先頭に必ず一致し、常時ハイライトされ続けてしまう。文字を打たないマクロは
      // ヒントとして無意味なので取り除く。
      if (entry.text.length > 0) {
        macros.push({ ...hint, text: entry.text })
      }
      continue
    }

    const displayChar = hidCodeToChar(entry.hidCode, entry.type)
    addHint(byChar, displayChar, hint)

    // 表示名と実際のキー値が異なる場合、両方で検索できるようにする
    const eventKey = DISPLAY_TO_EVENT_KEY[displayChar]
    if (eventKey) {
      addHint(byChar, eventKey, hint)
    }
  }

  return { byChar, macros }
}
