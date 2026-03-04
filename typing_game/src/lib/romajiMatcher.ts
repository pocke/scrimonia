import { type RomajiChunk, textToRomajiChunks } from './romajiTable'
import { type RomajiPreferences, getPreferredCandidate } from './romajiPreferences'

export interface RomajiInputState {
  chunks: RomajiChunk[]
  currentChunkIndex: number
  currentInput: string
  confirmedRomaji: string
}

export type InputResult =
  | { type: 'pending'; nextState: RomajiInputState }
  | { type: 'advance'; nextState: RomajiInputState }
  | { type: 'complete'; nextState: RomajiInputState }
  | { type: 'error' }

export function createInitialState(kanaText: string): RomajiInputState {
  return {
    chunks: textToRomajiChunks(kanaText),
    currentChunkIndex: 0,
    currentInput: '',
    confirmedRomaji: '',
  }
}

export function processKey(state: RomajiInputState, key: string): InputResult {
  const { chunks, currentChunkIndex, currentInput, confirmedRomaji } = state
  const chunk = chunks[currentChunkIndex]
  if (!chunk) return { type: 'error' }

  const tentative = currentInput + key

  // Check for exact match (chunk complete)
  const exactMatch = chunk.candidates.find(c => c === tentative)
  if (exactMatch) {
    const nextIndex = currentChunkIndex + 1
    const nextState: RomajiInputState = {
      chunks,
      currentChunkIndex: nextIndex,
      currentInput: '',
      confirmedRomaji: confirmedRomaji + exactMatch,
    }
    if (nextIndex >= chunks.length) {
      return { type: 'complete', nextState }
    }
    return { type: 'advance', nextState }
  }

  // Check for prefix match (input continues)
  const hasPrefix = chunk.candidates.some(c => c.startsWith(tentative))
  if (hasPrefix) {
    return {
      type: 'pending',
      nextState: {
        chunks,
        currentChunkIndex,
        currentInput: tentative,
        confirmedRomaji,
      },
    }
  }

  return { type: 'error' }
}

/**
 * Returns the set of valid next characters the user can type.
 * Used for piano keyboard highlighting.
 * When preferences are provided, only the preferred candidate is used
 * so that only one style's keys are highlighted.
 */
export function getNextExpectedChars(state: RomajiInputState, preferences?: RomajiPreferences): string[] {
  const chunk = state.chunks[state.currentChunkIndex]
  if (!chunk) return []

  const { currentInput } = state
  const nextChars = new Set<string>()

  if (preferences) {
    const preferred = getPreferredCandidate(chunk, preferences)
    if (preferred.startsWith(currentInput) && preferred.length > currentInput.length) {
      nextChars.add(preferred[currentInput.length])
    }
    // If user is already typing a non-preferred path, fall back to all matching candidates
    if (nextChars.size === 0) {
      for (const candidate of chunk.candidates) {
        if (candidate.startsWith(currentInput) && candidate.length > currentInput.length) {
          nextChars.add(candidate[currentInput.length])
        }
      }
    }
  } else {
    for (const candidate of chunk.candidates) {
      if (candidate.startsWith(currentInput) && candidate.length > currentInput.length) {
        nextChars.add(candidate[currentInput.length])
      }
    }
  }

  return [...nextChars]
}

/**
 * Returns the remaining romaji hint for display.
 * When preferences are provided, uses the preferred candidate for each chunk.
 * Otherwise falls back to the shortest matching candidate.
 */
export function getRemainingRomaji(state: RomajiInputState, maxChunks: number = 10, preferences?: RomajiPreferences): string {
  const { chunks, currentChunkIndex, currentInput } = state

  let result = ''

  // Current chunk: show remaining portion of the preferred or shortest matching candidate
  const chunk = chunks[currentChunkIndex]
  if (chunk) {
    if (preferences) {
      const preferred = getPreferredCandidate(chunk, preferences)
      if (preferred.startsWith(currentInput)) {
        result += preferred.slice(currentInput.length)
      } else {
        // User is typing a non-preferred path; fall back to shortest matching
        const matching = chunk.candidates
          .filter(c => c.startsWith(currentInput))
          .sort((a, b) => a.length - b.length)
        if (matching.length > 0) {
          result += matching[0].slice(currentInput.length)
        }
      }
    } else {
      const matching = chunk.candidates
        .filter(c => c.startsWith(currentInput))
        .sort((a, b) => a.length - b.length)
      if (matching.length > 0) {
        result += matching[0].slice(currentInput.length)
      }
    }
  }

  // Subsequent chunks: show preferred candidate of each
  const end = Math.min(chunks.length, currentChunkIndex + 1 + maxChunks)
  for (let i = currentChunkIndex + 1; i < end; i++) {
    const c = chunks[i]
    if (c.candidates.length > 0) {
      result += preferences ? getPreferredCandidate(c, preferences) : c.candidates[0]
    }
  }

  return result
}
