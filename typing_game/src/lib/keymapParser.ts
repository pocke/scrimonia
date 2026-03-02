import type { KeymapData } from '../types'
import { buildRubySource } from './midiPicoStub'
import { executeRuby } from './picoruby'

declare global {
  interface Window {
    midiPicoKeymapData?: KeymapData
  }
}

/**
 * keymap.rb の内容をパースして KeymapData を返す。
 *
 * 1. MidiPico スタブ + keymap.rb を結合した Ruby コードを生成
 * 2. PicoRuby.wasm で実行
 * 3. Ruby 側が window.midiPicoKeymapData にデータを書き込む
 * 4. TypeScript 側でそのデータを取得して返す
 */
export async function parseKeymap(keymapRbContent: string): Promise<KeymapData> {
  delete window.midiPicoKeymapData

  const source = buildRubySource(keymapRbContent)
  await executeRuby(source)

  const data = window.midiPicoKeymapData
  if (!data) {
    throw new Error('keymap.rb のパースに失敗しました。mp.start! が呼ばれていることを確認してください。')
  }

  return data
}
