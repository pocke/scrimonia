// モーダル (加算) 合成による撥弦音。弦の振動を倍音ごとの減衰する正弦波の和で表す。
// 非調和性を持つ弦の倍音周波数: Fletcher 1964, "Normal Vibration Frequencies of a Stiff Piano String"

const LOW_NOTE = 48
const HIGH_NOTE = 96
const LOW_NOTE_T60_SEC = 4
const HIGH_NOTE_T60_SEC = 1.2
const MAX_DURATION_SEC = 4
const TAIL_SEC = 0.2

// 弦の非調和性 B。倍音 k の周波数は k·f0·sqrt((1 + B·k²) / (1 + B))
const INHARMONICITY = 0.0001
const MAX_FREQUENCY_RATIO = 0.9
// 弦の長さを 1 としたときの撥弦位置 β。倍音 k の初期振幅は |sin(kπβ)|
const PLUCK_POSITION = 0.08
// 倍音 k の初期振幅を 1/k^p で減らす。爪が硬いほど小さい
const PLUCK_HARDNESS = 1.4
// 周波数依存の減衰。1/T60 = 1/T60_基本波 + DAMPING_PER_KHZ2 · ((f / 1kHz)² - (f0 / 1kHz)²)。
// 基本波の T60 は高音でも decayTimeSec の値のままにする
const DAMPING_PER_KHZ2 = 0.9
const CUTOFF_AMPLITUDE = Math.pow(10, -90 / 20)

// 弦の水平・垂直方向の振動のずれによるうなり。同じ倍音列をもう 1 組足す
const BEAT_DETUNE_CENTS = 0.7
const BEAT_AMPLITUDE_RATIO = 0.3
const BEAT_T60_RATIO = 1.3

// 先頭で振幅が 0 から跳ばないようにする立ち上がり
const ATTACK_SEC = 0.001
const CLICK_SEC = 0.0025
const CLICK_GAIN = 0.1
const CLICK_CENTER_HZ = 4000
const CLICK_Q = 1
const NOISE_SEED = 0x6b6f746f

function midiFromFrequency(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440)
}

// log(T60) を MIDI ノート番号に対して線形に補間する
function decayTimeSec(frequency: number): number {
  const t = (midiFromFrequency(frequency) - LOW_NOTE) / (HIGH_NOTE - LOW_NOTE)
  const clamped = Math.min(1, Math.max(0, t))
  return Math.exp(
    Math.log(LOW_NOTE_T60_SEC) + (Math.log(HIGH_NOTE_T60_SEC) - Math.log(LOW_NOTE_T60_SEC)) * clamped,
  )
}

// mulberry32
function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1
  }
}

function addDecayingSine(
  out: Float32Array,
  amplitude: number,
  frequency: number,
  t60Sec: number,
  sampleRate: number,
): void {
  const omega = 2 * Math.PI * frequency / sampleRate
  // 1 サンプルあたりの振幅の減衰率 d。d^(t60 · sampleRate) = 10^-3
  const decay = Math.pow(10, -3 / (t60Sec * sampleRate))
  const rotCos = decay * Math.cos(omega)
  const rotSin = decay * Math.sin(omega)
  const audibleSamples = Math.log(CUTOFF_AMPLITUDE / amplitude) / Math.log(decay)
  const length = Math.min(out.length, Math.ceil(audibleSamples))

  let re = amplitude
  let im = 0
  for (let n = 0; n < length; n++) {
    out[n] += re
    const nextRe = rotCos * re - rotSin * im
    im = rotSin * re + rotCos * im
    re = nextRe
  }
}

function addModes(
  out: Float32Array,
  frequency: number,
  sampleRate: number,
  amplitudeScale: number,
  t60Scale: number,
): void {
  const fundamentalT60 = decayTimeSec(frequency) * t60Scale
  const maxFrequency = sampleRate / 2 * MAX_FREQUENCY_RATIO
  for (let k = 1; Math.pow(k, -PLUCK_HARDNESS) >= CUTOFF_AMPLITUDE; k++) {
    const modeFrequency = k * frequency * Math.sqrt((1 + INHARMONICITY * k * k) / (1 + INHARMONICITY))
    if (modeFrequency > maxFrequency) break
    const amplitude = Math.abs(Math.sin(k * Math.PI * PLUCK_POSITION)) / Math.pow(k, PLUCK_HARDNESS)
    const khz = modeFrequency / 1000
    const fundamentalKhz = frequency / 1000
    const t60 = 1 / (1 / fundamentalT60 + DAMPING_PER_KHZ2 * (khz * khz - fundamentalKhz * fundamentalKhz))
    addDecayingSine(out, amplitude * amplitudeScale, modeFrequency, t60, sampleRate)
  }
}

// 爪が弦に当たる瞬間の、CLICK_CENTER_HZ 付近の帯域ノイズ (バンドパスは https://www.w3.org/TR/audio-eq-cookbook/ の式)
function addClick(out: Float32Array, sampleRate: number): void {
  const random = createRandom(NOISE_SEED)
  const clickSamples = Math.min(out.length, Math.floor(CLICK_SEC * sampleRate))
  const omega = 2 * Math.PI * CLICK_CENTER_HZ / sampleRate
  const alpha = Math.sin(omega) / (2 * CLICK_Q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = -2 * Math.cos(omega) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < clickSamples; i++) {
    const x = random()
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    out[i] += CLICK_GAIN * y * (1 - i / clickSamples)
  }
}

function normalize(samples: Float32Array): void {
  let peak = 0
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
  if (peak === 0) return
  for (let i = 0; i < samples.length; i++) samples[i] /= peak
}

function applyAttack(samples: Float32Array, sampleRate: number): void {
  const attackSamples = Math.min(samples.length, Math.floor(ATTACK_SEC * sampleRate))
  for (let i = 0; i < attackSamples; i++) samples[i] *= i / attackSamples
}

export function renderKotoWaveform(frequency: number, sampleRate: number): Float32Array<ArrayBuffer> {
  if (!(Number.isFinite(frequency) && frequency > 0 && Number.isFinite(sampleRate) && sampleRate > 0)) {
    throw new RangeError(`invalid frequency or sampleRate: ${frequency}, ${sampleRate}`)
  }
  const totalSamples = Math.floor(Math.min(decayTimeSec(frequency) + TAIL_SEC, MAX_DURATION_SEC) * sampleRate)
  const out = new Float32Array(totalSamples)

  addModes(out, frequency, sampleRate, 1, 1)
  addModes(
    out,
    frequency * Math.pow(2, BEAT_DETUNE_CENTS / 1200),
    sampleRate,
    BEAT_AMPLITUDE_RATIO,
    BEAT_T60_RATIO,
  )
  applyAttack(out, sampleRate)
  normalize(out)
  addClick(out, sampleRate)
  normalize(out)
  return out
}
