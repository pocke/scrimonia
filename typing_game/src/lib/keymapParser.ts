import type { KeymapData } from '../types'
import { buildRubySource } from './scrimoniaStub'
import { executeRuby } from './picoruby'

declare global {
  interface Window {
    scrimoniaKeymapDataJson?: string
  }
}

/**
 * keymap.rb の内容をパースして KeymapData を返す。
 *
 * 1. Scrimonia スタブ + keymap.rb を結合した Ruby コードを生成
 * 2. PicoRuby.wasm で実行
 * 3. Ruby 側が window.scrimoniaKeymapDataJson に JSON 文字列を書き込む
 * 4. TypeScript 側で JSON.parse して返す
 */
export async function parseKeymap(keymapRbContent: string): Promise<KeymapData> {
  delete window.scrimoniaKeymapDataJson

  const source = buildRubySource(keymapRbContent)
  await executeRuby(source, () => window.scrimoniaKeymapDataJson != null)

  const json = window.scrimoniaKeymapDataJson
  if (!json) {
    throw new Error('keymap.rb のパースに失敗しました。mp.start! が呼ばれていることを確認してください。')
  }

  return JSON.parse(json) as KeymapData
}
