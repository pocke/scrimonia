import type { Instrument } from './synth'

const STORAGE_KEY = 'scrimonia-instrument'
const DEFAULT_INSTRUMENT: Instrument = 'piano'

export function loadInstrument(): Instrument {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'piano' || raw === 'koto' ? raw : DEFAULT_INSTRUMENT
  } catch {
    return DEFAULT_INSTRUMENT
  }
}

export function saveInstrument(instrument: Instrument): void {
  try {
    localStorage.setItem(STORAGE_KEY, instrument)
  } catch {
    // 保存できなくても、今のセッション中は state の値で動く
  }
}
