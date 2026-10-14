import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_RELEASE_SEC,
  MAX_RELEASE_SEC,
  MIN_RELEASE_SEC,
  loadReleaseSec,
  saveReleaseSec,
} from './releaseTimePreference'

const KEY = 'scrimonia-release-sec'

describe('releaseTimePreference', () => {
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

  it('未保存なら既定値を返す', () => {
    expect(loadReleaseSec()).toBe(DEFAULT_RELEASE_SEC)
  })

  it('数値でない保存値なら既定値を返す', () => {
    store.set(KEY, 'abc')
    expect(loadReleaseSec()).toBe(DEFAULT_RELEASE_SEC)
  })

  it('範囲外の保存値なら既定値を返す', () => {
    store.set(KEY, String(MIN_RELEASE_SEC - 0.05))
    expect(loadReleaseSec()).toBe(DEFAULT_RELEASE_SEC)
    store.set(KEY, String(MAX_RELEASE_SEC + 1))
    expect(loadReleaseSec()).toBe(DEFAULT_RELEASE_SEC)
  })

  it('範囲の両端の保存値はそのまま返す', () => {
    store.set(KEY, String(MIN_RELEASE_SEC))
    expect(loadReleaseSec()).toBe(MIN_RELEASE_SEC)
    store.set(KEY, String(MAX_RELEASE_SEC))
    expect(loadReleaseSec()).toBe(MAX_RELEASE_SEC)
  })

  it('範囲内の保存値はそのまま返す', () => {
    saveReleaseSec(1.5)
    expect(loadReleaseSec()).toBe(1.5)
  })
})
