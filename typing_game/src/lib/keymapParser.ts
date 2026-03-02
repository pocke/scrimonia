import type { KeymapData } from '../types'
import { buildRubySource } from './midiPicoStub'
import { executeRuby } from './picoruby'

declare global {
  interface Window {
    midiPicoKeymapDataJson?: string
  }
}

/**
 * keymap.rb の内容をパースして KeymapData を返す。
 *
 * 1. MidiPico スタブ + keymap.rb を結合した Ruby コードを生成
 * 2. PicoRuby.wasm で実行
 * 3. Ruby 側が window.midiPicoKeymapDataJson に JSON 文字列を書き込む
 * 4. TypeScript 側で JSON.parse して返す
 */
export async function parseKeymap(keymapRbContent: string): Promise<KeymapData> {
  delete window.midiPicoKeymapDataJson

  const source = buildRubySource(keymapRbContent)
  await executeRuby(source)

  const json = window.midiPicoKeymapDataJson
  if (!json) {
    throw new Error('keymap.rb のパースに失敗しました。mp.start! が呼ばれていることを確認してください。')
  }

  return JSON.parse(json) as KeymapData
}
