import { describe, expect, it } from 'vitest'
import { renderKotoWaveform } from './kotoWaveform'

const SAMPLE_RATE = 44100

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / (to - from))
}

// 自己相関が最大になるラグから基本周波数を推定する (放物線補間つき)
function estimateFrequency(samples: Float32Array, expected: number): number {
  const start = Math.floor(SAMPLE_RATE * 0.05)
  const length = Math.floor(SAMPLE_RATE * 0.3)
  const minLag = Math.floor(SAMPLE_RATE / (expected * 1.5))
  const maxLag = Math.ceil(SAMPLE_RATE / (expected / 1.5))
  const corr = new Float64Array(maxLag + 2)
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let sum = 0
    for (let i = 0; i < length; i++) sum += samples[start + i] * samples[start + i + lag]
    corr[lag] = sum
  }
  let best = minLag
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corr[lag] > corr[best]) best = lag
  }
  const a = corr[best - 1]
  const b = corr[best]
  const c = corr[best + 1]
  const shift = (a - c) / (2 * (a - 2 * b + c))
  return SAMPLE_RATE / (best + shift)
}

describe('renderKotoWaveform', () => {
  it.each([48, 69, 84])('MIDI %i の音高が指定周波数の ±10 cent 以内に収まる', note => {
    const expected = midiToHz(note)
    const wave = renderKotoWaveform(expected, SAMPLE_RATE)
    const actual = estimateFrequency(wave, expected)
    const cents = 1200 * Math.log2(actual / expected)
    expect(Math.abs(cents)).toBeLessThanOrEqual(10)
  })

  it('NaN と Infinity を含まず、絶対値の最大が 1 以下になる', () => {
    for (const note of [36, 60, 96]) {
      const wave = renderKotoWaveform(midiToHz(note), SAMPLE_RATE)
      let peak = 0
      for (const v of wave) {
        expect(Number.isFinite(v)).toBe(true)
        peak = Math.max(peak, Math.abs(v))
      }
      expect(peak).toBeLessThanOrEqual(1)
      expect(peak).toBeGreaterThan(0.5)
    }
  })

  it('最後の 0.1 秒の RMS が先頭 0.1 秒の RMS より十分小さい', () => {
    const wave = renderKotoWaveform(midiToHz(60), SAMPLE_RATE)
    const n = Math.floor(SAMPLE_RATE * 0.1)
    expect(rms(wave, wave.length - n, wave.length)).toBeLessThan(rms(wave, 0, n) * 0.1)
  })

  it('低音の方が高音より長い波形になる', () => {
    const low = renderKotoWaveform(midiToHz(48), SAMPLE_RATE)
    const high = renderKotoWaveform(midiToHz(96), SAMPLE_RATE)
    expect(low.length).toBeGreaterThan(high.length)
  })

  it('同じ入力なら同じ波形を返す', () => {
    const a = renderKotoWaveform(440, SAMPLE_RATE)
    const b = renderKotoWaveform(440, SAMPLE_RATE)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
