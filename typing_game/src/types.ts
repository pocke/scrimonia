export interface KeymapEntry {
  noteNumbers: number[]
  noteNames: string[]
  velocity: [number, number] | null
  type: 'keycode' | 'modifier' | 'midi'
  // type === 'midi' のときは「出力する MIDI ノート番号」が入る (フィールド名は
  // keycode/modifier との共用のため hidCode のまま)。
  hidCode: number
}

export type LayerKeymap = KeymapEntry[]
export type KeymapData = Record<string, LayerKeymap>
