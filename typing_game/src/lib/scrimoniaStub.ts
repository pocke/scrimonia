// Scrimonia gem の Ruby 定義 (01-04) をプロジェクトのソースから直接読み込み、
// ブラウザ用スタブと結合して PicoRuby.wasm で実行する。

import WASM_STRING_POLYFILL from './wasm_string_polyfill.rb?raw'
import SCRIMONIA_NOTE from '../../../gems/picoruby-scrimonia/mrblib/01_scrimonia_note.rb?raw'
import SCRIMONIA_ACTION from '../../../gems/picoruby-scrimonia/mrblib/02_scrimonia_action.rb?raw'
import SCRIMONIA_NOTES from '../../../gems/picoruby-scrimonia/mrblib/03_scrimonia_notes.rb?raw'
import SCRIMONIA_KEYCODES from '../../../gems/picoruby-scrimonia/mrblib/04_scrimonia_keycodes.rb?raw'
import SCRIMONIA_STUB from './scrimonia_stub.rb?raw'

/**
 * ユーザーの keymap.rb の先頭にスタブコードを追加した実行用 Ruby コードを生成する。
 * keymap.rb 内の `require 'scrimonia'` はスタブで代替されるため除去する。
 */
export function buildRubySource(keymapRb: string): string {
  const cleanedKeymap = keymapRb
    .split('\n')
    .filter(line => !line.match(/^\s*require\s+['"]scrimonia['"]/))
    .join('\n')

  return [
    WASM_STRING_POLYFILL,
    SCRIMONIA_NOTE,
    SCRIMONIA_ACTION,
    SCRIMONIA_NOTES,
    SCRIMONIA_KEYCODES,
    SCRIMONIA_STUB,
    cleanedKeymap,
  ].join('\n')
}
