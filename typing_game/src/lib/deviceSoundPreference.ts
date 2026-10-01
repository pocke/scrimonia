const STORAGE_KEY = 'scrimonia-device-sound'

export function loadDeviceSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveDeviceSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // 保存できなくても、今のセッション中は state の値で動く
  }
}
