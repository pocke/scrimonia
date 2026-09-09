interface KeymapEntryBase {
  noteNumbers: number[]
  noteNames: string[]
  velocity: [number, number] | null
}

export type KeymapEntry =
  | (KeymapEntryBase & { type: 'keycode'; hidCode: number })
  | (KeymapEntryBase & { type: 'modifier'; hidCode: number })
  // type === 'midi' の hidCode には「出力する MIDI ノート番号」が入る
  // (フィールド名は keycode/modifier との共用のため hidCode のまま)。
  | (KeymapEntryBase & { type: 'midi'; hidCode: number })
  | (KeymapEntryBase & { type: 'macro'; text: string })
  | (KeymapEntryBase & { type: 'layer'; layerName: string; layerMode: 'hold' | 'switch' })

export type LayerKeymap = KeymapEntry[]
export type KeymapData = Record<string, LayerKeymap>

/** ピアノ上で和音 (マクロ) を点線でハイライトするための情報。 */
export interface ChordHighlight {
  noteNumbers: number[]
  label: string
}
