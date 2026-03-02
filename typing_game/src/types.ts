export interface KeymapEntry {
  noteNumbers: number[]
  noteNames: string[]
  velocity: [number, number] | null
  type: 'keycode' | 'modifier'
  hidCode: number
}

export type LayerKeymap = KeymapEntry[]
export type KeymapData = Record<string, LayerKeymap>
