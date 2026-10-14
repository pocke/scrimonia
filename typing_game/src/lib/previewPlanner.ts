import type { LayerKeymap } from '../types'
import { buildReverseKeymap, type NoteHint } from './reverseKeymap'
import { type RomajiChunk } from './romajiTable'
import { type RomajiInputState, processKey } from './romajiMatcher'
import { type RomajiPreferences, getPreferredCandidate } from './romajiPreferences'

export interface PreviewStroke {
  noteNumbers: number[]
  /** 再生に使うベロシティ。範囲指定なら中央値、指定なしなら範囲の外で DEFAULT_VELOCITY に最も近い値。 */
  velocity: number
  text: string
  requiresVelocity: boolean
  pauseBefore: boolean
  /** この打鍵が入力するチャンクの範囲 (両端を含む)。 */
  chunkStart: number
  chunkEnd: number
}

export type PreviewPlan =
  | { ok: true; strokes: PreviewStroke[] }
  | { ok: false; chunkIndex: number }

const DEFAULT_VELOCITY = 90

export function textToCharChunks(text: string): RomajiChunk[] {
  return Array.from(text).map(ch => ({ kana: ch, candidates: [ch] }))
}

interface Edge {
  text: string
  hint: NoteHint
  velocity: number
  requiresVelocity: boolean
}

type Cost = [number, number, number]

interface Node {
  state: RomajiInputState
  cost: Cost
  prev: Node | null
  stroke: PreviewStroke | null
  done: boolean
}

function compareCost(a: Cost, b: Cost): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

function noteSetKey(noteNumbers: number[]): string {
  return [...noteNumbers].sort((a, b) => a - b).join(',')
}

function clampVelocity(v: number): number {
  return Number.isFinite(v) ? Math.min(127, Math.max(1, Math.round(v))) : DEFAULT_VELOCITY
}

/** ranges のどれにも入らないベロシティのうち DEFAULT_VELOCITY に最も近いもの。無ければ null。 */
function velocityOutside(ranges: [number, number][]): number | null {
  let best: number | null = null
  for (let v = 1; v <= 127; v++) {
    if (ranges.some(([min, max]) => v >= min && v <= max)) continue
    if (best === null || Math.abs(v - DEFAULT_VELOCITY) < Math.abs(best - DEFAULT_VELOCITY)) best = v
  }
  return best
}

function buildEdges(keymap: LayerKeymap): Edge[] {
  // 同じノート集合にベロシティ付きエントリがあると、ベロシティ指定なしのエントリより
  // そちらが優先される (doc/keymap.md)。指定なしのエントリは、その範囲の外のベロシティで
  // 弾いたときだけ発火し、打ち分けも必要になる。範囲が全域を覆うと一度も発火しない。
  const rangesByNotes = new Map<string, [number, number][]>()
  for (const entry of keymap) {
    if (!entry.velocity) continue
    const key = noteSetKey(entry.noteNumbers)
    rangesByNotes.set(key, [...(rangesByNotes.get(key) ?? []), entry.velocity])
  }

  const toEdge = (text: string, hint: NoteHint): Edge | null => {
    if (hint.velocity) {
      const mid = (hint.velocity[0] + hint.velocity[1]) / 2
      return { text, hint, velocity: clampVelocity(mid), requiresVelocity: true }
    }
    const ranges = rangesByNotes.get(noteSetKey(hint.noteNumbers))
    if (!ranges) return { text, hint, velocity: DEFAULT_VELOCITY, requiresVelocity: false }
    const velocity = velocityOutside(ranges)
    return velocity === null ? null : { text, hint, velocity, requiresVelocity: true }
  }

  const reverse = buildReverseKeymap(keymap)
  const edges: Edge[] = []
  const add = (edge: Edge | null) => {
    if (edge) edges.push(edge)
  }
  for (const [char, hints] of reverse.byChar) {
    if (char.length !== 1) continue
    for (const hint of hints) add(toEdge(char, hint))
  }
  for (const macro of reverse.macros) add(toEdge(macro.text, macro))
  return edges
}

/** text を state から打つ。途中の文字でお題を打ち終えたり、受理されない文字があれば null。 */
function applyText(
  state: RomajiInputState,
  text: string,
  preferences: RomajiPreferences,
): { state: RomajiInputState; nonPreferred: number } | null {
  let current = state
  let nonPreferred = 0
  for (let i = 0; i < text.length; i++) {
    const result = processKey(current, text[i])
    if (result.type === 'error') return null
    if (result.type === 'complete' && i < text.length - 1) return null
    if (result.type === 'advance' || result.type === 'complete') {
      const chunk = current.chunks[current.currentChunkIndex]
      const confirmed = result.nextState.confirmedRomaji.slice(current.confirmedRomaji.length)
      if (confirmed !== getPreferredCandidate(chunk, preferences)) nonPreferred++
    }
    current = result.nextState
  }
  return { state: current, nonPreferred }
}

function stateKey(state: RomajiInputState): string {
  return `${state.currentChunkIndex}:${state.currentInput}`
}

/**
 * chunks を最後まで打つ打鍵列を、コスト (打ち分けが必要な打鍵数, 打鍵数,
 * ユーザーの流儀と違う候補で確定したチャンク数) の辞書式順で最小になるように探す。
 */
export function planPreview(
  keymap: LayerKeymap,
  chunks: RomajiChunk[],
  preferences: RomajiPreferences,
): PreviewPlan {
  const edges = buildEdges(keymap)
  const start: RomajiInputState = { chunks, currentChunkIndex: 0, currentInput: '', confirmedRomaji: '' }
  const nodes = new Map<string, Node>()
  const startNode: Node = { state: start, cost: [0, 0, 0], prev: null, stroke: null, done: false }
  nodes.set(stateKey(start), startNode)
  let furthestChunk = 0

  for (;;) {
    let best: Node | null = null
    for (const node of nodes.values()) {
      if (!node.done && (!best || compareCost(node.cost, best.cost) < 0)) best = node
    }
    if (!best) return { ok: false, chunkIndex: furthestChunk }
    best.done = true

    const state = best.state
    furthestChunk = Math.max(furthestChunk, state.currentChunkIndex)
    if (state.currentChunkIndex >= chunks.length) {
      const strokes: PreviewStroke[] = []
      for (let n: Node | null = best; n?.stroke; n = n.prev) strokes.push(n.stroke)
      return { ok: true, strokes: strokes.reverse() }
    }

    const startsPhrase = state.currentInput === '' && !!chunks[state.currentChunkIndex].spaceBefore
    for (const edge of edges) {
      const applied = applyText(state, edge.text, preferences)
      if (!applied) continue
      const cost: Cost = [
        best.cost[0] + (edge.requiresVelocity ? 1 : 0),
        best.cost[1] + 1,
        best.cost[2] + applied.nonPreferred,
      ]
      const key = stateKey(applied.state)
      const existing = nodes.get(key)
      if (existing && (existing.done || compareCost(cost, existing.cost) >= 0)) continue
      nodes.set(key, {
        state: applied.state,
        cost,
        prev: best,
        stroke: {
          noteNumbers: edge.hint.noteNumbers,
          velocity: edge.velocity,
          text: edge.text,
          requiresVelocity: edge.requiresVelocity,
          pauseBefore: startsPhrase,
          chunkStart: state.currentChunkIndex,
          chunkEnd: applied.state.currentInput === ''
            ? applied.state.currentChunkIndex - 1
            : applied.state.currentChunkIndex,
        },
        done: false,
      })
    }
  }
}
