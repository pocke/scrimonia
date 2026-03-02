// MIDIノート番号からピアノ鍵盤の描画レイアウトを計算する

// 1オクターブ内の半音インデックス → 黒鍵かどうか
// C=0, Cs=1, D=2, Ds=3, E=4, F=5, Fs=6, G=7, Gs=8, A=9, As=10, B=11
const BLACK_KEY_INDICES = new Set([1, 3, 6, 8, 10])

export function isBlackKey(noteNumber: number): boolean {
  return BLACK_KEY_INDICES.has(noteNumber % 12)
}

// 1オクターブ内の半音インデックス → そのオクターブ内での白鍵番号 (0-6)
// C=0, D=1, E=2, F=3, G=4, A=5, B=6
const SEMITONE_TO_WHITE_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]

export const WHITE_KEY_WIDTH = 40
export const WHITE_KEY_HEIGHT = 160
export const BLACK_KEY_WIDTH = 26
export const BLACK_KEY_HEIGHT = 100

// 白鍵の形状タイプ: 黒鍵に隣接するノッチの位置
type WhiteKeyShape = 'left' | 'right' | 'both' | 'full'

// C=right, D=both, E=left, F=right, G=both, A=both, B=left
const WHITE_KEY_SHAPES: WhiteKeyShape[] = ['right', 'both', 'left', 'right', 'both', 'both', 'left']

export interface KeyLayout {
  noteNumber: number
  isBlack: boolean
  x: number
  shape: WhiteKeyShape | 'black'
}

/**
 * 指定されたノート範囲のピアノ鍵盤レイアウトを計算する。
 * 範囲はオクターブ境界（C）に切り上げ/切り下げされる。
 */
export function buildKeyboardLayout(minNote: number, maxNote: number): KeyLayout[] {
  // オクターブ境界に拡張: 最小を直前の C に、最大を直後の B に
  const startNote = minNote - (minNote % 12)
  const endNote = maxNote + (11 - (maxNote % 12))

  const layouts: KeyLayout[] = []

  for (let note = startNote; note <= endNote; note++) {
    const semitone = note % 12
    const black = isBlackKey(note)

    if (black) {
      // 黒鍵の x 位置: 隣接する白鍵の境界にセンタリング
      const whiteIndex = whiteKeyCount(startNote, note)
      const x = whiteIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2
      layouts.push({ noteNumber: note, isBlack: true, x, shape: 'black' })
    } else {
      const whiteIndex = whiteKeyCount(startNote, note)
      const x = whiteIndex * WHITE_KEY_WIDTH
      const whiteKeyIndex = SEMITONE_TO_WHITE_INDEX[semitone]
      // オクターブ境界でない C の場合も right
      const shape = WHITE_KEY_SHAPES[whiteKeyIndex]

      // 端のキーはノッチ不要な場合がある
      let actualShape = shape
      if (note === startNote) {
        actualShape = shape === 'both' ? 'left' : shape === 'right' ? 'full' : shape
      }
      if (note === endNote) {
        actualShape = shape === 'both' ? 'right' : shape === 'left' ? 'full' : shape
      }

      layouts.push({
        noteNumber: note,
        isBlack: false,
        x,
        shape: actualShape,
      })
    }
  }

  return layouts
}

/** startNote から note の直前までにある白鍵の数 */
function whiteKeyCount(startNote: number, note: number): number {
  let count = 0
  for (let n = startNote; n < note; n++) {
    if (!isBlackKey(n)) count++
  }
  return count
}

/** レイアウト中の白鍵の総数 */
export function totalWhiteKeys(layouts: KeyLayout[]): number {
  return layouts.filter(k => !k.isBlack).length
}

/**
 * 白鍵の SVG path を生成する。
 * ピアノらしい形状: 黒鍵がある部分は上部が狭く、下部で広がる。
 */
export function whiteKeyPath(x: number, shape: WhiteKeyShape): string {
  const w = WHITE_KEY_WIDTH
  const h = WHITE_KEY_HEIGHT
  const bh = BLACK_KEY_HEIGHT
  const halfBlack = BLACK_KEY_WIDTH / 2

  switch (shape) {
    case 'full':
      // ノッチなし（端のキー）
      return `M${x},0 L${x + w},0 L${x + w},${h} L${x},${h} Z`

    case 'left':
      // 左にノッチ（E, B）: 左上が狭い
      return `M${x + halfBlack},0 L${x + w},0 L${x + w},${h} L${x},${h} L${x},${bh} L${x + halfBlack},${bh} Z`

    case 'right':
      // 右にノッチ（C, F）: 右上が狭い
      return `M${x},0 L${x + w - halfBlack},0 L${x + w - halfBlack},${bh} L${x + w},${bh} L${x + w},${h} L${x},${h} Z`

    case 'both':
      // 両側にノッチ（D, G, A）: 上部が中央の狭い部分
      return `M${x + halfBlack},0 L${x + w - halfBlack},0 L${x + w - halfBlack},${bh} L${x + w},${bh} L${x + w},${h} L${x},${h} L${x},${bh} L${x + halfBlack},${bh} Z`
  }
}
