import type { LayerKeymap } from '../types'
import { buildReverseKeymap, type NoteHint } from './reverseKeymap'
import { type RomajiChunk } from './romajiTable'
import { type RomajiInputState, processKey } from './romajiMatcher'
import { type RomajiPreferences, getPreferredCandidate } from './romajiPreferences'

export interface PreviewStroke {
  noteNumbers: number[]
  /** 再生に使うベロシティ。範囲指定なら中央値、指定なしなら DEFAULT_VELOCITY。 */
  velocity: number
  /** この打鍵で入力される文字列 */
  text: string
  /** 弱打/強打の打ち分けが必要な打鍵か */
  requiresVelocity: boolean
  /** 句の先頭を打ち始める打鍵か。再生時に間を空ける。 */
  pauseBefore: boolean
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

function buildEdges(keymap: LayerKeymap): Edge[] {
  // 同じノート集合にベロシティ付きエントリがあると、ベロシティ指定なしのエントリより
  // そちらが優先される (doc/keymap.md)。指定なしのエントリでも打ち分けが要る。
  const velocityNoteSets = new Set<string>()
  for (const entry of keymap) {
    if (entry.velocity) velocityNoteSets.add(noteSetKey(entry.noteNumbers))
  }
  const needsVelocity = (hint: NoteHint) =>
    hint.velocity !== null || velocityNoteSets.has(noteSetKey(hint.noteNumbers))

  const reverse = buildReverseKeymap(keymap)
  const edges: Edge[] = []
  for (const [char, hints] of reverse.byChar) {
    if (char.length !== 1) continue
    for (const hint of hints) edges.push({ text: char, hint, requiresVelocity: needsVelocity(hint) })
  }
  for (const macro of reverse.macros) {
    edges.push({ text: macro.text, hint: macro, requiresVelocity: needsVelocity(macro) })
  }
  return edges
}

function playbackVelocity(hint: NoteHint): number {
  return hint.velocity ? Math.round((hint.velocity[0] + hint.velocity[1]) / 2) : DEFAULT_VELOCITY
}

/** text を state から打ち、最後の文字で入力が終わらずに全て受理されたときだけ結果を返す。 */
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
          velocity: playbackVelocity(edge.hint),
          text: edge.text,
          requiresVelocity: edge.requiresVelocity,
          pauseBefore: startsPhrase,
        },
        done: false,
      })
    }
  }
}
