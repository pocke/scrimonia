import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadInstrument, saveInstrument } from './instrumentPreference'

const KEY = 'scrimonia-instrument'

describe('instrumentPreference', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('未保存ならピアノを返す', () => {
    expect(loadInstrument()).toBe('piano')
  })

  it('不正な保存値ならピアノを返す', () => {
    store.set(KEY, 'violin')
    expect(loadInstrument()).toBe('piano')
  })

  it('localStorage が例外を投げてもピアノを返す', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
    })
    expect(loadInstrument()).toBe('piano')
  })

  it('保存した琴を読み出せる', () => {
    saveInstrument('koto')
    expect(loadInstrument()).toBe('koto')
  })
})
