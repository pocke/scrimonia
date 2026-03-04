import type { RomajiChunk } from './romajiTable'

export interface RomajiPreferences {
  shi: 'si' | 'shi'
  chi: 'ti' | 'chi'
  tsu: 'tu' | 'tsu'
  fu: 'hu' | 'fu'
  ji: 'zi' | 'ji'
}

export const DEFAULT_PREFERENCES: RomajiPreferences = {
  shi: 'si',
  chi: 'ti',
  tsu: 'tu',
  fu: 'hu',
  ji: 'zi',
}

const STORAGE_KEY = 'midipico-romaji-preferences'

export function loadPreferences(): RomajiPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    const parsed = JSON.parse(raw)
    return {
      shi: parsed.shi === 'shi' ? 'shi' : 'si',
      chi: parsed.chi === 'chi' ? 'chi' : 'ti',
      tsu: parsed.tsu === 'tsu' ? 'tsu' : 'tu',
      fu: parsed.fu === 'fu' ? 'fu' : 'hu',
      ji: parsed.ji === 'ji' ? 'ji' : 'zi',
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: RomajiPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

type PreferenceGroup = 'shi' | 'chi' | 'tsu' | 'fu' | 'ji'

const KANA_TO_GROUP: Record<string, PreferenceGroup> = {
  'し': 'shi', 'しゃ': 'shi', 'しゅ': 'shi', 'しょ': 'shi',
  'ち': 'chi', 'ちゃ': 'chi', 'ちゅ': 'chi', 'ちょ': 'chi',
  'つ': 'tsu',
  'ふ': 'fu',
  'じ': 'ji', 'じゃ': 'ji', 'じゅ': 'ji', 'じょ': 'ji',
}

// Each preference value maps to candidate prefixes to match
const PREFERENCE_PREFIXES: Record<PreferenceGroup, Record<string, string[]>> = {
  shi: { shi: ['sh'], si: ['si', 'sy'] },
  chi: { chi: ['ch'], ti: ['ti', 'ty'] },
  tsu: { tsu: ['tsu'], tu: ['tu'] },
  fu:  { fu: ['fu'], hu: ['hu'] },
  ji:  { ji: ['j'], zi: ['zy', 'zi'] },
}

/**
 * Pick the preferred candidate from a chunk based on user preferences.
 * Falls back to the first candidate if no preference matches.
 */
export function getPreferredCandidate(chunk: RomajiChunk, prefs: RomajiPreferences): string {
  if (chunk.candidates.length <= 1) return chunk.candidates[0] ?? ''

  const group = KANA_TO_GROUP[chunk.kana]
  if (!group) return chunk.candidates[0]

  const prefValue = prefs[group]
  const prefixes = PREFERENCE_PREFIXES[group][prefValue]
  if (!prefixes) return chunk.candidates[0]

  for (const prefix of prefixes) {
    const match = chunk.candidates.find(c => c.startsWith(prefix))
    if (match) return match
  }

  return chunk.candidates[0]
}
