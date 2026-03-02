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
} from '../lib/pianoLayout'

interface Props {
  keymap: LayerKeymap
  highlightNote?: number
}

export function PianoKeyboard({ keymap, highlightNote }: Props) {
  if (keymap.length === 0) return null

  const noteNumbers = keymap.map(e => e.noteNumber)
  const minNote = Math.min(...noteNumbers)
  const maxNote = Math.max(...noteNumbers)

  const layouts = buildKeyboardLayout(minNote, maxNote)
  const whiteCount = totalWhiteKeys(layouts)

  const svgWidth = whiteCount * WHITE_KEY_WIDTH
  const svgHeight = WHITE_KEY_HEIGHT + 30 // 鍵盤 + ノート名ラベル分

  // ノート番号ごとのマッピングを構築
  const noteMap = new Map<number, KeymapEntry[]>()
  for (const entry of keymap) {
    const existing = noteMap.get(entry.noteNumber) ?? []
    existing.push(entry)
    noteMap.set(entry.noteNumber, existing)
  }

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
        const isHighlighted = key.noteNumber === highlightNote
        const isModifier = entries?.some(e => e.type === 'modifier')
        const hasMappings = entries && entries.length > 0

        let fill = '#f8f8f8'
        if (isHighlighted) fill = '#93c5fd'
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
            {/* マッピングラベル */}
            {entries && <KeyLabels entries={entries} x={key.x + WHITE_KEY_WIDTH / 2} isBlack={false} />}
            {/* ノート名 */}
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
        const isHighlighted = key.noteNumber === highlightNote
        const isModifier = entries?.some(e => e.type === 'modifier')
        const hasMappings = entries && entries.length > 0

        let fill = '#1f2937'
        if (isHighlighted) fill = '#3b82f6'
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
    </svg>
  )
}

function KeyLabels({ entries, x, isBlack }: { entries: KeymapEntry[], x: number, isBlack: boolean }) {
  const textColor = isBlack ? '#e5e7eb' : '#1f2937'
  const fontSize = isBlack ? 10 : 12

  if (entries.length === 1) {
    const label = hidCodeToChar(entries[0].hidCode, entries[0].type)
    const y = isBlack ? BLACK_KEY_HEIGHT - 12 : WHITE_KEY_HEIGHT - 20
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={fontSize} fill={textColor} fontWeight="bold">
        {label}
      </text>
    )
  }

  // ベロシティで分割されたマッピング: 上下に表示
  // velocity[0] が小さい方 (soft) を上、大きい方 (hard) を下に
  const sorted = [...entries].sort((a, b) => (a.velocity?.[0] ?? 0) - (b.velocity?.[0] ?? 0))

  if (isBlack) {
    return (
      <g>
        {sorted.map((entry, i) => {
          const label = hidCodeToChar(entry.hidCode, entry.type)
          const y = 30 + i * 28
          return (
            <g key={i}>
              <text x={x} y={y} textAnchor="middle" fontSize={9} fill={textColor} fontWeight="bold">
                {label}
              </text>
              <text x={x} y={y + 11} textAnchor="middle" fontSize={7} fill="#9ca3af">
                {entry.velocity ? (i === 0 ? '弱' : '強') : ''}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <g>
      {sorted.map((entry, i) => {
        const label = hidCodeToChar(entry.hidCode, entry.type)
        const baseY = BLACK_KEY_HEIGHT + 15
        const y = baseY + i * 24
        return (
          <g key={i}>
            <text x={x} y={y} textAnchor="middle" fontSize={fontSize} fill={textColor} fontWeight="bold">
              {label}
            </text>
            <text x={x} y={y + 13} textAnchor="middle" fontSize={8} fill="#9ca3af">
              {entry.velocity ? (i === 0 ? '弱' : '強') : ''}
            </text>
          </g>
        )
      })}
    </g>
  )
}
