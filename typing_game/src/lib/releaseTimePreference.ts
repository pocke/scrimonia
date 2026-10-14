import { DEFAULT_RELEASE_SEC } from './pianoSynth'

export { DEFAULT_RELEASE_SEC }

const STORAGE_KEY = 'scrimonia-release-sec'

export const MIN_RELEASE_SEC = 0.1
export const MAX_RELEASE_SEC = 3

export function loadReleaseSec(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_RELEASE_SEC
    const value = Number(raw)
    if (!Number.isFinite(value) || value < MIN_RELEASE_SEC || value > MAX_RELEASE_SEC) {
      return DEFAULT_RELEASE_SEC
    }
    return value
  } catch {
    return DEFAULT_RELEASE_SEC
  }
}

export function saveReleaseSec(sec: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(sec))
  } catch {
    // 保存できなくても、今のセッション中は state の値で動く
  }
}
