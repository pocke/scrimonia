// MidiPico gem の Ruby 定義 (01-04) をプロジェクトのソースから直接読み込み、
// ブラウザ用スタブと結合して PicoRuby.wasm で実行する。

import MIDI_PICO_NOTE from '../../../gems/picoruby-midi-pico/mrblib/01_midi_pico_note.rb?raw'
import MIDI_PICO_ACTION from '../../../gems/picoruby-midi-pico/mrblib/02_midi_pico_action.rb?raw'
import MIDI_PICO_NOTES from '../../../gems/picoruby-midi-pico/mrblib/03_midi_pico_notes.rb?raw'
import MIDI_PICO_KEYCODES from '../../../gems/picoruby-midi-pico/mrblib/04_midi_pico_keycodes.rb?raw'
import MIDI_PICO_STUB from './midi_pico_stub.rb?raw'

/**
 * ユーザーの keymap.rb の先頭にスタブコードを追加した実行用 Ruby コードを生成する。
 * keymap.rb 内の `require 'midi_pico'` はスタブで代替されるため除去する。
 */
export function buildRubySource(keymapRb: string): string {
  const cleanedKeymap = keymapRb
    .split('\n')
    .filter(line => !line.match(/^\s*require\s+['"]midi_pico['"]/))
    .join('\n')

  return [
    MIDI_PICO_NOTE,
    MIDI_PICO_ACTION,
    MIDI_PICO_NOTES,
    MIDI_PICO_KEYCODES,
    MIDI_PICO_STUB,
    cleanedKeymap,
  ].join('\n')
}
