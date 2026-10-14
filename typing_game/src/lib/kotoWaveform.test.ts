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

function amplitudeAt(samples: Float32Array, frequency: number, startSec: number, length: number): number {
  const start = Math.floor(SAMPLE_RATE * startSec)
  let re = 0
  let im = 0
  for (let i = 0; i < length; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / length)
    const phase = (2 * Math.PI * frequency * i) / SAMPLE_RATE
    re += samples[start + i] * w * Math.cos(phase)
    im -= samples[start + i] * w * Math.sin(phase)
  }
  return Math.hypot(re, im)
}

// 非調和性で k·f0 からわずかにずれるので、近傍の最大値を取る
function harmonicAmplitude(samples: Float32Array, f0: number, k: number, startSec: number, length: number): number {
  let best = 0
  for (let cents = -15; cents <= 15; cents += 3) {
    const f = k * f0 * Math.pow(2, cents / 1200)
    best = Math.max(best, amplitudeAt(samples, f, startSec, length))
  }
  return best
}

function harmonicDb(samples: Float32Array, f0: number, k: number, startSec: number, length: number): number {
  return 20 * Math.log10(harmonicAmplitude(samples, f0, k, startSec, length) / harmonicAmplitude(samples, f0, 1, startSec, length))
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
  it.each([48, 69, 84, 96])('MIDI %i の音高が指定周波数の ±2 cent 以内に収まる', note => {
    const expected = midiToHz(note)
    const wave = renderKotoWaveform(expected, SAMPLE_RATE)
    const actual = estimateFrequency(wave, expected)
    const cents = 1200 * Math.log2(actual / expected)
    expect(Math.abs(cents)).toBeLessThanOrEqual(2)
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

  it.each([[84, 1.62], [96, 1.2]])('MIDI %i の基本波の実効 T60 が設計値 %f 秒の ±40% に収まる', (note, designed) => {
    const f0 = midiToHz(note)
    const wave = renderKotoWaveform(f0, SAMPLE_RATE)
    // うなりで振幅が最大 ±30% 揺れるので、窓ごとの基本波振幅 (dB) を最小二乗直線で回帰する。揺れの分だけ傾きがずれるため許容幅は ±40%
    const length = 2048
    const times = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
    const dbs = times.map(t => 20 * Math.log10(harmonicAmplitude(wave, f0, 1, t, length)))
    const meanT = times.reduce((a, b) => a + b) / times.length
    const meanDb = dbs.reduce((a, b) => a + b) / dbs.length
    let num = 0
    let den = 0
    times.forEach((t, i) => {
      num += (t - meanT) * (dbs[i] - meanDb)
      den += (t - meanT) ** 2
    })
    const effectiveT60 = -60 / (num / den)
    expect(effectiveT60).toBeGreaterThan(designed * 0.6)
    expect(effectiveT60).toBeLessThan(designed * 1.4)
  })

  it('MIDI 55 の 0.5 秒付近で第 8 倍音以上が基本波より 30dB 以上小さい', () => {
    const f0 = midiToHz(55)
    const wave = renderKotoWaveform(f0, SAMPLE_RATE)
    for (let k = 8; k <= 12; k++) {
      expect(harmonicDb(wave, f0, k, 0.5, 4800)).toBeLessThan(-30)
    }
  })

  it('MIDI 55 の立ち上がりは第 5〜8 倍音のどれかが基本波から -25dB 以内にある', () => {
    const f0 = midiToHz(55)
    const wave = renderKotoWaveform(f0, SAMPLE_RATE)
    const dbs = [5, 6, 7, 8].map(k => harmonicDb(wave, f0, k, 0.02, 1024))
    expect(Math.max(...dbs)).toBeGreaterThan(-25)
  })

  it.each([96, 108])('MIDI %i の後半に直流成分が残らない', note => {
    const wave = renderKotoWaveform(midiToHz(note), SAMPLE_RATE)
    const from = Math.floor(SAMPLE_RATE * 0.3)
    const to = Math.floor(SAMPLE_RATE * 0.5)
    let sum = 0
    for (let i = from; i < to; i++) sum += wave[i]
    expect(Math.abs(sum / (to - from))).toBeLessThan(1e-4)
  })

  it('同じ入力なら同じ波形を返す', () => {
    const a = renderKotoWaveform(440, SAMPLE_RATE)
    const b = renderKotoWaveform(440, SAMPLE_RATE)
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it.each([36, 55, 96])('MIDI %i の先頭サンプルがフルスケールに跳ばない', note => {
    const wave = renderKotoWaveform(midiToHz(note), SAMPLE_RATE)
    expect(Math.abs(wave[0])).toBeLessThan(0.05)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('周波数が %f のとき RangeError を投げる', frequency => {
    expect(() => renderKotoWaveform(frequency, SAMPLE_RATE)).toThrow(RangeError)
  })
})
