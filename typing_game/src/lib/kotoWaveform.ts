// 拡張 Karplus-Strong 法による撥弦音の合成。
// Jaffe & Smith 1983, "Extensions of the Karplus-Strong Plucked-String Algorithm"
// https://ccrma.stanford.edu/~jos/pasp/Karplus_Strong_Algorithm.html

const LOW_NOTE = 48
const HIGH_NOTE = 96
const LOW_NOTE_T60_SEC = 4
const HIGH_NOTE_T60_SEC = 1.2
const MAX_DURATION_SEC = 4
const TAIL_SEC = 0.2

const PLUCK_POSITION = 0.12
const EXCITATION_SMOOTHING = 0.5
const CLICK_SEC = 0.004
const CLICK_GAIN = 0.35
const NOISE_SEED = 0x6b6f746f

// d → 0 で allpass の係数 C → 1 になり極が z = -1 に近づいて過渡応答が長引くので、d を [0.1, 1.1) に収める
const MAX_LOOP_GAIN = 0.99999
const MIN_FRACTIONAL_DELAY = 0.1
const AVERAGING_WEIGHT = 0.5

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

function createExcitation(length: number, random: () => number): Float32Array<ArrayBuffer> {
  const smoothed = new Float32Array(length)
  let prev = 0
  for (let i = 0; i < length; i++) {
    prev = EXCITATION_SMOOTHING * prev + (1 - EXCITATION_SMOOTHING) * random()
    smoothed[i] = prev
  }

  // 弦の端から β の位置を弾くと、基本周波数の 1/β 倍の整数倍の倍音が消える。
  // 遅延線を一周する巡回くし形フィルタ x[n] - x[n - βN] で表す。
  // https://ccrma.stanford.edu/~jos/pasp/Extended_Karplus_Strong_Algorithm.html
  const combLag = Math.max(1, Math.round(PLUCK_POSITION * length))
  const combed = new Float32Array(length)
  let mean = 0
  for (let i = 0; i < length; i++) {
    combed[i] = smoothed[i] - smoothed[(i - combLag + length) % length]
    mean += combed[i]
  }
  mean /= length
  for (let i = 0; i < length; i++) combed[i] -= mean
  return combed
}

export function renderKotoWaveform(frequency: number, sampleRate: number): Float32Array<ArrayBuffer> {
  const t60 = decayTimeSec(frequency)
  const totalSamples = Math.floor(Math.min(t60 + TAIL_SEC, MAX_DURATION_SEC) * sampleRate)

  // 1 周あたりのゲイン g は g^(t60 * frequency) = 10^-3 を満たす
  const targetLoopGain = Math.pow(10, -3 / (t60 * frequency))

  // ローパス y[n] = (1 - S) x[n] + S x[n-1] の基本波での振幅は sqrt(1 - 2S(1 - S)(1 - cos ω))。
  // S = 0.5 (2 点平均) のままだと高音では 1 周の損失が g を下回り、T60 に届かない。
  // そのとき S を下げて損失を g に合わせる。S は低域での遅延サンプル数にもなる。
  // https://ccrma.stanford.edu/~jos/pasp/Extended_Karplus_Strong_Algorithm.html
  const omega = 2 * Math.PI * frequency / sampleRate
  const requiredLoss = (1 - targetLoopGain ** 2) / (1 - Math.cos(omega))
  const lowpassDelay = requiredLoss >= 0.5
    ? AVERAGING_WEIGHT
    : (1 - Math.sqrt(1 - 2 * requiredLoss)) / 2
  const fundamentalLoss = Math.sqrt(1 - 2 * lowpassDelay * (1 - lowpassDelay) * (1 - Math.cos(omega)))
  const loopGain = Math.min(MAX_LOOP_GAIN, targetLoopGain / fundamentalLoss)

  const period = sampleRate / frequency
  const lineLength = Math.floor(period - lowpassDelay - MIN_FRACTIONAL_DELAY)
  const fractionalDelay = period - lowpassDelay - lineLength
  // 1 次 allpass H(z) = (C + z^-1) / (1 + C z^-1) の低域遅延が d サンプルになる係数
  // https://ccrma.stanford.edu/~jos/pasp/First_Order_Allpass_Interpolation.html
  const allpassCoef = (1 - fractionalDelay) / (1 + fractionalDelay)

  const random = createRandom(NOISE_SEED)
  const line = createExcitation(lineLength, random)

  const out = new Float32Array(totalSamples)
  let index = 0
  let lowpassPrev = 0
  let allpassIn = 0
  let allpassOut = 0
  for (let n = 0; n < totalSamples; n++) {
    const delayed = line[index]
    out[n] = delayed
    const lowpassed = loopGain * ((1 - lowpassDelay) * delayed + lowpassDelay * lowpassPrev)
    lowpassPrev = delayed
    const filtered = allpassCoef * lowpassed + allpassIn - allpassCoef * allpassOut
    allpassIn = lowpassed
    allpassOut = filtered
    line[index] = filtered
    index = (index + 1) % lineLength
  }

  let peak = 0
  for (let i = 0; i < totalSamples; i++) peak = Math.max(peak, Math.abs(out[i]))
  const scale = peak > 0 ? 1 / peak : 1
  for (let i = 0; i < totalSamples; i++) out[i] *= scale

  // 爪が弦に当たる瞬間の高域ノイズ
  const clickSamples = Math.min(totalSamples, Math.floor(CLICK_SEC * sampleRate))
  let prevNoise = 0
  for (let i = 0; i < clickSamples; i++) {
    const noise = random()
    const highpassed = noise - prevNoise
    prevNoise = noise
    out[i] += CLICK_GAIN * highpassed * (1 - i / clickSamples)
  }

  let finalPeak = 0
  for (let i = 0; i < totalSamples; i++) finalPeak = Math.max(finalPeak, Math.abs(out[i]))
  if (finalPeak > 0) {
    for (let i = 0; i < totalSamples; i++) out[i] /= finalPeak
  }
  return out
}
