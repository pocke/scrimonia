import type { LayerKeymap, KeymapEntry } from '../types'
import { hidCodeToChar } from '../lib/hidKeycodes'
import {
  buildKeyboardLayout,
  totalWhiteKeys,
  whiteKeyPath,
  WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  BLACK_KEY_WIDTH,
  BLACK_KEY_HEIGHT,
  type KeyLayout,
} from '../lib/pianoLayout'

interface Props {
  keymap: LayerKeymap
  /** タイピングのヒント (= 次に押すべき鍵) として青系でハイライトするノート。 */
  highlightNotes?: number[]
  /** 現在押下中で正しい (ヒントに含まれる) ノート。緑系でハイライトする。 */
  activeNotes?: number[]
  /** 現在押下中だがヒントに含まれない誤打鍵。赤系でハイライトする。 */
  wrongNotes?: number[]
}

export function PianoKeyboard({ keymap, highlightNotes, activeNotes, wrongNotes }: Props) {
  if (keymap.length === 0) return null

  const allNoteNumbers = keymap.flatMap(e => e.noteNumbers)
  const minNote = Math.min(...allNoteNumbers)
  const maxNote = Math.max(...allNoteNumbers)

  const layouts = buildKeyboardLayout(minNote, maxNote)
  const whiteCount = totalWhiteKeys(layouts)

  const svgWidth = whiteCount * WHITE_KEY_WIDTH
  const svgHeight = WHITE_KEY_HEIGHT + 30

  const highlightSet = new Set(highlightNotes ?? [])
  const activeSet = new Set(activeNotes ?? [])
  const wrongSet = new Set(wrongNotes ?? [])

  // ノート番号ごとのマッピングを構築（和音エントリは各ノートに登録）
  const noteMap = new Map<number, KeymapEntry[]>()
  for (const entry of keymap) {
    for (const noteNum of entry.noteNumbers) {
      const existing = noteMap.get(noteNum) ?? []
      existing.push(entry)
      noteMap.set(noteNum, existing)
    }
  }

  // 和音エントリの線を描画するためのレイアウトマップ
  const layoutMap = new Map<number, KeyLayout>()
  for (const layout of layouts) {
    layoutMap.set(layout.noteNumber, layout)
  }

  // 和音エントリ（noteNumbers.length > 1）を収集
  const chordEntries = keymap.filter(e => e.noteNumbers.length > 1)

  const whiteKeys = layouts.filter(k => !k.isBlack)
  const blackKeys = layouts.filter(k => k.isBlack)

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full max-w-4xl"
      style={{ maxHeight: '300px' }}
    >
      {/* 白鍵 */}
      {whiteKeys.map(key => {
        const entries = noteMap.get(key.noteNumber)
        const isWrong = wrongSet.has(key.noteNumber)
        const isActive = activeSet.has(key.noteNumber)
        const isHighlighted = highlightSet.has(key.noteNumber)
        const isModifier = entries?.some(e => e.type === 'modifier')
        const hasMappings = entries && entries.length > 0

        let fill = '#f8f8f8'
        if (isWrong) fill = '#fca5a5'
        else if (isActive) fill = '#86efac'
        else if (isHighlighted) fill = '#93c5fd'
        else if (isModifier) fill = '#fed7aa'
        else if (hasMappings) fill = '#ffffff'

        return (
          <g key={key.noteNumber}>
            <path
              d={whiteKeyPath(key.x, key.shape as 'left' | 'right' | 'both' | 'full')}
              fill={fill}
              stroke="#374151"
              strokeWidth={1}
            />
            {entries && <KeyLabels entries={entries} x={key.x + WHITE_KEY_WIDTH / 2} isBlack={false} />}
            <text
              x={key.x + WHITE_KEY_WIDTH / 2}
              y={WHITE_KEY_HEIGHT + 18}
              textAnchor="middle"
              fontSize={10}
              fill="#9ca3af"
            >
              {key.noteNumber % 12 === 0 ? `C${Math.floor(key.noteNumber / 12) - 1}` : ''}
            </text>
          </g>
        )
      })}

      {/* 黒鍵（白鍵の上に描画） */}
      {blackKeys.map(key => {
        const entries = noteMap.get(key.noteNumber)
        const isWrong = wrongSet.has(key.noteNumber)
        const isActive = activeSet.has(key.noteNumber)
        const isHighlighted = highlightSet.has(key.noteNumber)
        const isModifier = entries?.some(e => e.type === 'modifier')
        const hasMappings = entries && entries.length > 0

        let fill = '#1f2937'
        if (isWrong) fill = '#dc2626'
        else if (isActive) fill = '#16a34a'
        else if (isHighlighted) fill = '#3b82f6'
        else if (isModifier) fill = '#c2410c'
        else if (hasMappings) fill = '#111827'

        return (
          <g key={key.noteNumber}>
            <rect
              x={key.x}
              y={0}
              width={BLACK_KEY_WIDTH}
              height={BLACK_KEY_HEIGHT}
              fill={fill}
              stroke="#111827"
              strokeWidth={1}
              rx={2}
            />
            {entries && <KeyLabels entries={entries} x={key.x + BLACK_KEY_WIDTH / 2} isBlack={true} />}
          </g>
        )
      })}

      {/* 和音の接続線 */}
      {chordEntries.map((entry, i) => {
        const positions = entry.noteNumbers
          .map(n => layoutMap.get(n))
          .filter((l): l is KeyLayout => l != null)

        if (positions.length < 2) return null

        const points = positions.map(l => ({
          x: l.isBlack ? l.x + BLACK_KEY_WIDTH / 2 : l.x + WHITE_KEY_WIDTH / 2,
          y: l.isBlack ? BLACK_KEY_HEIGHT + 5 : WHITE_KEY_HEIGHT - 5,
        }))

        return (
          <g key={`chord-${i}`}>
            {points.slice(1).map((p, j) => (
              <line
                key={j}
                x1={points[j].x}
                y1={points[j].y}
                x2={p.x}
                y2={p.y}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4,3"
                opacity={0.7}
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

function velocityLabel(velocity: [number, number] | null): string {
  if (!velocity) return ''
  return `${velocity[0]}–${velocity[1]}`
}

function KeyLabels({ entries, x, isBlack }: { entries: KeymapEntry[], x: number, isBlack: boolean }) {
  const textColor = isBlack ? '#e5e7eb' : '#1f2937'

  const sorted = [...entries].sort((a, b) => (a.velocity?.[0] ?? 0) - (b.velocity?.[0] ?? 0))
  const count = sorted.length
  const hasVelocity = count > 1

  if (isBlack) {
    const spacing = Math.min(24, (BLACK_KEY_HEIGHT - 20) / count)
    const startY = 20 + (BLACK_KEY_HEIGHT - 20 - spacing * count) / 2

    return (
      <g>
        {sorted.map((entry, i) => {
          const label = hidCodeToChar(entry.hidCode, entry.type)
          const y = startY + i * spacing
          return (
            <g key={i}>
              <text x={x} y={y} textAnchor="middle" fontSize={9} fill={textColor} fontWeight="bold">
                {label}
              </text>
              {hasVelocity && (
                <text x={x} y={y + 10} textAnchor="middle" fontSize={6} fill="#9ca3af">
                  {velocityLabel(entry.velocity)}
                </text>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  const availableHeight = WHITE_KEY_HEIGHT - BLACK_KEY_HEIGHT - 10
  const spacing = Math.min(28, availableHeight / count)
  const startY = BLACK_KEY_HEIGHT + 15 + (availableHeight - spacing * count) / 2

  return (
    <g>
      {sorted.map((entry, i) => {
        const label = hidCodeToChar(entry.hidCode, entry.type)
        const y = startY + i * spacing
        return (
          <g key={i}>
            <text x={x} y={y} textAnchor="middle" fontSize={12} fill={textColor} fontWeight="bold">
              {label}
            </text>
            {hasVelocity && (
              <text x={x} y={y + 13} textAnchor="middle" fontSize={7} fill="#9ca3af">
                {velocityLabel(entry.velocity)}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
