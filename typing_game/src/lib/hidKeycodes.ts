import type { KeymapEntry } from '../types'

// HID Usage ID → 表示文字 の変換テーブル
// ソース: gems/picoruby-scrimonia/mrblib/04_scrimonia_keycodes.rb

const HID_KEYCODE_TO_CHAR: Record<number, string> = {
  0x04: 'a', 0x05: 'b', 0x06: 'c', 0x07: 'd', 0x08: 'e',
  0x09: 'f', 0x0a: 'g', 0x0b: 'h', 0x0c: 'i', 0x0d: 'j',
  0x0e: 'k', 0x0f: 'l', 0x10: 'm', 0x11: 'n', 0x12: 'o',
  0x13: 'p', 0x14: 'q', 0x15: 'r', 0x16: 's', 0x17: 't',
  0x18: 'u', 0x19: 'v', 0x1a: 'w', 0x1b: 'x', 0x1c: 'y',
  0x1d: 'z',

  0x1e: '1', 0x1f: '2', 0x20: '3', 0x21: '4', 0x22: '5',
  0x23: '6', 0x24: '7', 0x25: '8', 0x26: '9', 0x27: '0',

  0x28: 'Enter', 0x29: 'Esc', 0x2a: 'Backspace', 0x2b: 'Tab',
  0x2c: 'Space', 0x2d: '-', 0x2e: '=', 0x2f: '[', 0x30: ']',
  0x31: '\\', 0x33: ';', 0x34: "'", 0x35: '`', 0x36: ',',
  0x37: '.', 0x38: '/',

  0x3a: 'F1', 0x3b: 'F2', 0x3c: 'F3', 0x3d: 'F4',
  0x3e: 'F5', 0x3f: 'F6', 0x40: 'F7', 0x41: 'F8',
  0x42: 'F9', 0x43: 'F10', 0x44: 'F11', 0x45: 'F12',

  0x4f: 'Right', 0x50: 'Left', 0x51: 'Down', 0x52: 'Up',
  0x4c: 'Del', 0x4a: 'Home', 0x4d: 'End', 0x4b: 'PgUp', 0x4e: 'PgDn',
}

// HID Modifier bitmask → 表示名
const HID_MODIFIER_TO_NAME: Record<number, string> = {
  0x01: 'Ctrl', 0x02: 'Shift', 0x04: 'Alt', 0x08: 'GUI',
  0x10: 'RCtrl', 0x20: 'RShift', 0x40: 'RAlt', 0x80: 'RGUI',
}

// Scrimonia::Note::NOTE_NAMES と同じ並び。
const NOTE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']

function noteNumberToName(noteNumber: number): string {
  const octave = Math.floor(noteNumber / 12) - 1
  return `${NOTE_NAMES[noteNumber % 12]}${octave}`
}

export function hidCodeToChar(hidCode: number, type: 'keycode' | 'modifier' | 'midi'): string {
  if (type === 'modifier') {
    return HID_MODIFIER_TO_NAME[hidCode] ?? `Mod(0x${hidCode.toString(16)})`
  }
  if (type === 'midi') {
    return noteNumberToName(hidCode)
  }
  return HID_KEYCODE_TO_CHAR[hidCode] ?? `0x${hidCode.toString(16)}`
}

// マクロの text 中の空白・タブ・改行・復帰は鍵盤上のラベルでは見えないため、
// 目に見える記号に置き換える。
const MACRO_TEXT_DISPLAY: Record<string, string> = {
  ' ': '␣',
  '\t': '⇥',
  '\n': '⏎',
  '\r': '␍',
}
const LABEL_MAX_LENGTH = 10

function truncateLabel(label: string): string {
  // string.slice は UTF-16 コードユニット単位なので、サロゲートペアを含む
  // 文字列 (絵文字など) だと途中で切って壊れる。Array.from はコードポイント
  // 単位で列挙するのでそれを避けられる。
  const chars = Array.from(label)
  return chars.length > LABEL_MAX_LENGTH ? chars.slice(0, LABEL_MAX_LENGTH - 1).join('') + '…' : label
}

function macroTextLabel(text: string): string {
  const replaced = Array.from(text, ch => MACRO_TEXT_DISPLAY[ch] ?? ch).join('')
  return truncateLabel(replaced)
}

/** 鍵盤上に表示するラベル文字列。type ごとに hidCode / text / layerName から組み立てる。 */
export function entryLabel(entry: KeymapEntry): string {
  if (entry.type === 'macro') {
    return macroTextLabel(entry.text)
  }
  if (entry.type === 'layer') {
    // gems/picoruby-scrimonia/mrblib/06_scrimonia_runner.rb の
    // apply_layer_change は mode == :hold のときだけ hold_returns を記録し、
    // それ以外は無条件に switch_layer するので、:hold 以外は switch 扱い。
    return truncateLabel((entry.layerMode === 'hold' ? '⇩' : '→') + entry.layerName)
  }
  return hidCodeToChar(entry.hidCode, entry.type)
}
