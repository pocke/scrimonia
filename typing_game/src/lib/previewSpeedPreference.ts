const STORAGE_KEY = 'scrimonia-preview-speed'

export const PREVIEW_SPEEDS = [0.5, 0.75, 1, 1.5, 2]

export function loadPreviewSpeed(): number {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return PREVIEW_SPEEDS.includes(value) ? value : 1
  } catch {
    return 1
  }
}

export function savePreviewSpeed(speed: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(speed))
  } catch {
    // 保存できなくても、今のセッション中は state の値で動く
  }
}
