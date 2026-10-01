export interface RomajiChunk {
  kana: string
  candidates: string[]
  /** 元のテキストでこのチャンクの直前にスペースがあった */
  spaceBefore?: boolean
}

interface RomajiEntry {
  kana: string
  romaji: string[]
}

// Longer kana patterns first for greedy matching
const ROMAJI_TABLE: RomajiEntry[] = [
  // 拗音（2文字） — must come before single-char entries
  { kana: 'きゃ', romaji: ['kya'] },
  { kana: 'きゅ', romaji: ['kyu'] },
  { kana: 'きょ', romaji: ['kyo'] },
  { kana: 'しゃ', romaji: ['sha', 'sya'] },
  { kana: 'しゅ', romaji: ['shu', 'syu'] },
  { kana: 'しょ', romaji: ['sho', 'syo'] },
  { kana: 'ちゃ', romaji: ['cha', 'tya', 'cya'] },
  { kana: 'ちゅ', romaji: ['chu', 'tyu', 'cyu'] },
  { kana: 'ちょ', romaji: ['cho', 'tyo', 'cyo'] },
  { kana: 'にゃ', romaji: ['nya'] },
  { kana: 'にゅ', romaji: ['nyu'] },
  { kana: 'にょ', romaji: ['nyo'] },
  { kana: 'ひゃ', romaji: ['hya'] },
  { kana: 'ひゅ', romaji: ['hyu'] },
  { kana: 'ひょ', romaji: ['hyo'] },
  { kana: 'みゃ', romaji: ['mya'] },
  { kana: 'みゅ', romaji: ['myu'] },
  { kana: 'みょ', romaji: ['myo'] },
  { kana: 'りゃ', romaji: ['rya'] },
  { kana: 'りゅ', romaji: ['ryu'] },
  { kana: 'りょ', romaji: ['ryo'] },
  { kana: 'ぎゃ', romaji: ['gya'] },
  { kana: 'ぎゅ', romaji: ['gyu'] },
  { kana: 'ぎょ', romaji: ['gyo'] },
  { kana: 'じゃ', romaji: ['ja', 'zya', 'jya'] },
  { kana: 'じゅ', romaji: ['ju', 'zyu', 'jyu'] },
  { kana: 'じょ', romaji: ['jo', 'zyo', 'jyo'] },
  { kana: 'びゃ', romaji: ['bya'] },
  { kana: 'びゅ', romaji: ['byu'] },
  { kana: 'びょ', romaji: ['byo'] },
  { kana: 'ぴゃ', romaji: ['pya'] },
  { kana: 'ぴゅ', romaji: ['pyu'] },
  { kana: 'ぴょ', romaji: ['pyo'] },

  // 基本母音
  { kana: 'あ', romaji: ['a'] },
  { kana: 'い', romaji: ['i'] },
  { kana: 'う', romaji: ['u'] },
  { kana: 'え', romaji: ['e'] },
  { kana: 'お', romaji: ['o'] },

  // か行
  { kana: 'か', romaji: ['ka', 'ca'] },
  { kana: 'き', romaji: ['ki'] },
  { kana: 'く', romaji: ['ku', 'cu'] },
  { kana: 'け', romaji: ['ke'] },
  { kana: 'こ', romaji: ['ko', 'co'] },

  // さ行
  { kana: 'さ', romaji: ['sa'] },
  { kana: 'し', romaji: ['si', 'shi', 'ci'] },
  { kana: 'す', romaji: ['su'] },
  { kana: 'せ', romaji: ['se', 'ce'] },
  { kana: 'そ', romaji: ['so'] },

  // た行
  { kana: 'た', romaji: ['ta'] },
  { kana: 'ち', romaji: ['ti', 'chi'] },
  { kana: 'つ', romaji: ['tu', 'tsu'] },
  { kana: 'て', romaji: ['te'] },
  { kana: 'と', romaji: ['to'] },

  // な行
  { kana: 'な', romaji: ['na'] },
  { kana: 'に', romaji: ['ni'] },
  { kana: 'ぬ', romaji: ['nu'] },
  { kana: 'ね', romaji: ['ne'] },
  { kana: 'の', romaji: ['no'] },

  // は行
  { kana: 'は', romaji: ['ha'] },
  { kana: 'ひ', romaji: ['hi'] },
  { kana: 'ふ', romaji: ['hu', 'fu'] },
  { kana: 'へ', romaji: ['he'] },
  { kana: 'ほ', romaji: ['ho'] },

  // ま行
  { kana: 'ま', romaji: ['ma'] },
  { kana: 'み', romaji: ['mi'] },
  { kana: 'む', romaji: ['mu'] },
  { kana: 'め', romaji: ['me'] },
  { kana: 'も', romaji: ['mo'] },

  // や行
  { kana: 'や', romaji: ['ya'] },
  { kana: 'ゆ', romaji: ['yu'] },
  { kana: 'よ', romaji: ['yo'] },

  // ら行
  { kana: 'ら', romaji: ['ra'] },
  { kana: 'り', romaji: ['ri'] },
  { kana: 'る', romaji: ['ru'] },
  { kana: 'れ', romaji: ['re'] },
  { kana: 'ろ', romaji: ['ro'] },

  // わ行
  { kana: 'わ', romaji: ['wa'] },
  { kana: 'を', romaji: ['wo'] },

  // 濁音
  { kana: 'が', romaji: ['ga'] },
  { kana: 'ぎ', romaji: ['gi'] },
  { kana: 'ぐ', romaji: ['gu'] },
  { kana: 'げ', romaji: ['ge'] },
  { kana: 'ご', romaji: ['go'] },
  { kana: 'ざ', romaji: ['za'] },
  { kana: 'じ', romaji: ['zi', 'ji'] },
  { kana: 'ず', romaji: ['zu'] },
  { kana: 'ぜ', romaji: ['ze'] },
  { kana: 'ぞ', romaji: ['zo'] },
  { kana: 'だ', romaji: ['da'] },
  { kana: 'ぢ', romaji: ['di'] },
  { kana: 'づ', romaji: ['du', 'dzu'] },
  { kana: 'で', romaji: ['de'] },
  { kana: 'ど', romaji: ['do'] },
  { kana: 'ば', romaji: ['ba'] },
  { kana: 'び', romaji: ['bi'] },
  { kana: 'ぶ', romaji: ['bu'] },
  { kana: 'べ', romaji: ['be'] },
  { kana: 'ぼ', romaji: ['bo'] },

  // 半濁音
  { kana: 'ぱ', romaji: ['pa'] },
  { kana: 'ぴ', romaji: ['pi'] },
  { kana: 'ぷ', romaji: ['pu'] },
  { kana: 'ぺ', romaji: ['pe'] },
  { kana: 'ぽ', romaji: ['po'] },

  // 小文字かな
  { kana: 'ぁ', romaji: ['xa', 'la'] },
  { kana: 'ぃ', romaji: ['xi', 'li'] },
  { kana: 'ぅ', romaji: ['xu', 'lu'] },
  { kana: 'ぇ', romaji: ['xe', 'le'] },
  { kana: 'ぉ', romaji: ['xo', 'lo'] },
  { kana: 'ゃ', romaji: ['xya', 'lya'] },
  { kana: 'ゅ', romaji: ['xyu', 'lyu'] },
  { kana: 'ょ', romaji: ['xyo', 'lyo'] },

  // 長音符・句読点
  { kana: 'ー', romaji: ['-'] },
  { kana: '、', romaji: [','] },
  { kana: '。', romaji: ['.'] },
]

// Build a lookup map keyed by first character for fast matching
const TABLE_BY_FIRST_CHAR = new Map<string, RomajiEntry[]>()
for (const entry of ROMAJI_TABLE) {
  const firstChar = entry.kana[0]
  const list = TABLE_BY_FIRST_CHAR.get(firstChar) ?? []
  list.push(entry)
  TABLE_BY_FIRST_CHAR.set(firstChar, list)
}

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o'])

// 「ん」の後に来ると n 単独では確定できない文字（母音、な行、や行）
const N_REQUIRES_DOUBLE = new Set([
  'あ', 'い', 'う', 'え', 'お',
  'な', 'に', 'ぬ', 'ね', 'の',
  'にゃ', 'にゅ', 'にょ',
  'や', 'ゆ', 'よ',
])

function findTableEntry(text: string, pos: number): RomajiEntry | null {
  const firstChar = text[pos]
  const entries = TABLE_BY_FIRST_CHAR.get(firstChar)
  if (!entries) return null

  // Try longer patterns first
  for (const entry of entries) {
    if (entry.kana.length > 1) {
      if (text.startsWith(entry.kana, pos)) {
        return entry
      }
    }
  }
  // Then single-char patterns
  for (const entry of entries) {
    if (entry.kana.length === 1) {
      return entry
    }
  }
  return null
}

/**
 * Get the leading consonant(s) of a romaji string.
 * Returns the part before the first vowel.
 */
function getLeadingConsonant(romaji: string): string {
  for (let i = 0; i < romaji.length; i++) {
    if (VOWELS.has(romaji[i])) {
      return romaji.slice(0, i)
    }
  }
  return romaji
}

/**
 * Check if the next kana (at `pos`) requires 'nn' for ん disambiguation.
 * Looks ahead in the text considering multi-char kana patterns.
 */
function nextKanaRequiresDoubleN(text: string, pos: number): boolean {
  if (pos >= text.length) return false

  // Check 2-char patterns first
  if (pos + 1 < text.length) {
    const twoChar = text.slice(pos, pos + 2)
    if (N_REQUIRES_DOUBLE.has(twoChar)) return true
  }

  const oneChar = text[pos]
  return N_REQUIRES_DOUBLE.has(oneChar)
}

/**
 * スペースは入力対象にせず、直後のチャンクの spaceBefore として残す。
 * 「ん」「っ」の先読みがスペースをまたいで次の句の先頭を見るよう、
 * スペースを除いたテキストからチャンクを作る。
 */
export function textToRomajiChunks(text: string): RomajiChunk[] {
  const segments = text.split(' ')
  const chunks = compactTextToRomajiChunks(segments.join(''))

  const spaceOffsets = new Set<number>()
  let offset = 0
  for (const segment of segments.slice(0, -1)) {
    offset += segment.length
    spaceOffsets.add(offset)
  }

  let kanaOffset = 0
  for (const chunk of chunks) {
    if (kanaOffset > 0 && spaceOffsets.has(kanaOffset)) chunk.spaceBefore = true
    kanaOffset += chunk.kana.length
  }
  return chunks
}

function compactTextToRomajiChunks(text: string): RomajiChunk[] {
  const chunks: RomajiChunk[] = []
  let pos = 0

  while (pos < text.length) {
    const char = text[pos]

    // 「っ」（促音）: double the leading consonant of the next kana
    if (char === 'っ') {
      // Look ahead for the next kana's romaji
      const nextEntry = pos + 1 < text.length ? findTableEntry(text, pos + 1) : null
      if (nextEntry) {
        const consonants = new Set<string>()
        for (const r of nextEntry.romaji) {
          const c = getLeadingConsonant(r)
          if (c.length > 0) {
            consonants.add(c[0])
          }
        }
        if (consonants.size > 0) {
          const candidates = [...consonants].concat(['xtu', 'ltu', 'xtsu', 'ltsu'])
          chunks.push({ kana: 'っ', candidates })
          pos++
          continue
        }
      }
      // Fallback: standalone っ
      chunks.push({ kana: 'っ', candidates: ['xtu', 'ltu', 'xtsu', 'ltsu'] })
      pos++
      continue
    }

    // 「ん」: depends on next character
    if (char === 'ん') {
      const needsDouble = nextKanaRequiresDoubleN(text, pos + 1)
      if (needsDouble) {
        chunks.push({ kana: 'ん', candidates: ['nn', 'xn'] })
      } else {
        chunks.push({ kana: 'ん', candidates: ['n', 'nn', 'xn'] })
      }
      pos++
      continue
    }

    // Normal table lookup
    const entry = findTableEntry(text, pos)
    if (entry) {
      chunks.push({ kana: entry.kana, candidates: [...entry.romaji] })
      pos += entry.kana.length
      continue
    }

    // Non-kana characters (ascii, etc.) — pass through as-is
    chunks.push({ kana: char, candidates: [char] })
    pos++
  }

  return chunks
}
