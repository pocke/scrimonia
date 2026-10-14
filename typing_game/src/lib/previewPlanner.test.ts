import { describe, it, expect } from 'vitest'
import type { KeymapEntry, LayerKeymap } from '../types'
import { textToRomajiChunks } from './romajiTable'
import { DEFAULT_PREFERENCES } from './romajiPreferences'
import { planPreview, textToCharChunks } from './previewPlanner'

const SPACE = 0x2c

function hid(ch: string): number {
  return ch === ' ' ? SPACE : 0x04 + (ch.charCodeAt(0) - 'a'.charCodeAt(0))
}

function key(ch: string, noteNumbers: number[], velocity: [number, number] | null = null): KeymapEntry {
  return { type: 'keycode', hidCode: hid(ch), noteNumbers, noteNames: [], velocity }
}

function macro(text: string, noteNumbers: number[], velocity: [number, number] | null = null): KeymapEntry {
  return { type: 'macro', text, noteNumbers, noteNames: [], velocity }
}

function plan(keymap: LayerKeymap, kana: string, preferences = DEFAULT_PREFERENCES) {
  return planPreview(keymap, textToRomajiChunks(kana), preferences)
}

function strokesOf(result: ReturnType<typeof plan>) {
  if (!result.ok) throw new Error(`not ok: chunk ${result.chunkIndex}`)
  return result.strokes
}

describe('planPreview', () => {
  it('prefers a macro without velocity over velocity-dependent keys', () => {
    const keymap: LayerKeymap = [
      key('g', [64], [1, 70]),
      key('g', [65], [71, 127]),
      key('a', [60]),
      macro('ga', [61, 48]),
    ]
    const strokes = strokesOf(plan(keymap, 'が'))
    expect(strokes).toHaveLength(1)
    expect(strokes[0].noteNumbers).toEqual([61, 48])
    expect(strokes[0].requiresVelocity).toBe(false)
  })

  it('picks the macro when both options need one velocity choice but the macro is shorter', () => {
    const keymap: LayerKeymap = [
      key('n', [60], [1, 70]),
      key('a', [48]),
      macro('na', [60, 48], [1, 70]),
    ]
    const strokes = strokesOf(plan(keymap, 'な'))
    expect(strokes.map(s => s.text)).toEqual(['na'])
    expect(strokes[0].requiresVelocity).toBe(true)
    expect(strokes[0].velocity).toBe(36)
  })

  it('treats a null-velocity entry as velocity-dependent when the same notes have a velocity entry', () => {
    const keymap: LayerKeymap = [
      key('k', [60]),
      key('z', [60], [71, 127]),
      key('i', [50]),
      macro('ki', [71]),
    ]
    // k は同じノートに velocity 付きの z があるので打ち分けが必要。
    // ki マクロ (ノート 71) は打ち分け不要なのでそちらを選ぶ。
    const strokes = strokesOf(plan(keymap, 'き'))
    expect(strokes).toHaveLength(1)
    expect(strokes[0].noteNumbers).toEqual([71])
    expect(strokes[0].requiresVelocity).toBe(false)

    const withoutMacro = strokesOf(plan(keymap.filter(e => e.type !== 'macro'), 'き'))
    expect(withoutMacro.map(s => s.requiresVelocity)).toEqual([true, false])
  })

  it('follows romaji preferences when costs tie', () => {
    const keymap: LayerKeymap = [macro('si', [60, 61]), macro('shi', [62, 63])]
    expect(strokesOf(plan(keymap, 'し', { ...DEFAULT_PREFERENCES, shi: 'si' })).map(s => s.text)).toEqual(['si'])
    expect(strokesOf(plan(keymap, 'し', { ...DEFAULT_PREFERENCES, shi: 'shi' })).map(s => s.text)).toEqual(['shi'])
  })

  it('returns the first chunk that cannot be typed', () => {
    const keymap: LayerKeymap = [key('a', [60])]
    const result = plan(keymap, 'あい')
    expect(result).toEqual({ ok: false, chunkIndex: 1 })
  })

  it('sets pauseBefore on the first stroke of a phrase', () => {
    const keymap: LayerKeymap = [key('a', [60]), key('i', [61])]
    const strokes = strokesOf(plan(keymap, 'あ い'))
    expect(strokes.map(s => s.pauseBefore)).toEqual([false, true])
  })

  it('types a space in English chunks with the space key', () => {
    const keymap: LayerKeymap = [key('a', [60]), key('b', [61]), key(' ', [62])]
    const result = planPreview(keymap, textToCharChunks('a b'), DEFAULT_PREFERENCES)
    expect(strokesOf(result).map(s => s.text)).toEqual(['a', ' ', 'b'])
  })
})
