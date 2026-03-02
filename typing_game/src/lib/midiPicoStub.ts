// MidiPico gem の Ruby 定義 (01-04) をプロジェクトのソースから直接読み込み、
// ブラウザ用スタブ (05) と結合して PicoRuby.wasm で実行する。

import MIDI_PICO_NOTE from '../../../gems/picoruby-midi-pico/mrblib/01_midi_pico_note.rb?raw'
import MIDI_PICO_ACTION from '../../../gems/picoruby-midi-pico/mrblib/02_midi_pico_action.rb?raw'
import MIDI_PICO_NOTES from '../../../gems/picoruby-midi-pico/mrblib/03_midi_pico_notes.rb?raw'
import MIDI_PICO_KEYCODES from '../../../gems/picoruby-midi-pico/mrblib/04_midi_pico_keycodes.rb?raw'

// ブラウザ用スタブ: add_layer のマッピングデータを収集し、
// JSON 文字列として JS にエクスポートする。
// JS::Object#[]= は npm バイナリ (v0.9.6) で method_missing 経由になり
// Hash/Array を直接渡せないため、JSON 文字列で受け渡す。
const MIDI_PICO_STUB = `
require 'js'

class MidiPico
  def initialize
    @layers = {}
  end

  def add_layer(name, mapping)
    entries = []
    mapping.each do |key, value|
      if key.is_a?(Array)
        # 和音はタイピングゲームでは使わないのでスキップ
      elsif key.is_a?(Note)
        note_number = key.number
        note_name = Note.name_for(key.number)
        vel_min = nil
        vel_max = nil
        if key.velocity.is_a?(Range)
          vel_min = key.velocity.first
          vel_max = key.velocity.last
        end
        if value.is_a?(Action::Keycode)
          entries << [note_number, note_name, vel_min, vel_max, "keycode", value.keycode]
        elsif value.is_a?(Action::Modifier)
          entries << [note_number, note_name, vel_min, vel_max, "modifier", value.modifier]
        end
      end
    end
    @layers[name.to_s] = entries
  end

  def start!
    # JSON を手動で組み立てる（json gem の有無に依存しない）
    layer_parts = []
    @layers.each do |name, entries|
      entry_strs = []
      entries.each do |e|
        vel = if e[2]
          "[" + e[2].to_s + "," + e[3].to_s + "]"
        else
          "null"
        end
        entry_strs << '{"noteNumber":' + e[0].to_s +
          ',"noteName":"' + e[1] + '"' +
          ',"velocity":' + vel +
          ',"type":"' + e[4] + '"' +
          ',"hidCode":' + e[5].to_s + '}'
      end
      layer_parts << '"' + name + '":[' + entry_strs.join(",") + ']'
    end
    json = "{" + layer_parts.join(",") + "}"
    JS.global.midiPicoKeymapDataJson = json
  end
end
`

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
