import { type RomajiChunk, textToRomajiChunks } from './romajiTable'

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
 */
export function getNextExpectedChars(state: RomajiInputState): string[] {
  const chunk = state.chunks[state.currentChunkIndex]
  if (!chunk) return []

  const { currentInput } = state
  const nextChars = new Set<string>()

  for (const candidate of chunk.candidates) {
    if (candidate.startsWith(currentInput) && candidate.length > currentInput.length) {
      nextChars.add(candidate[currentInput.length])
    }
  }

  return [...nextChars]
}

/**
 * Returns the remaining romaji hint for display.
 * Shows the shortest matching candidate's remaining portion, plus subsequent chunks.
 */
export function getRemainingRomaji(state: RomajiInputState, maxChunks: number = 10): string {
  const { chunks, currentChunkIndex, currentInput } = state

  let result = ''

  // Current chunk: show remaining portion of the best (shortest) matching candidate
  const chunk = chunks[currentChunkIndex]
  if (chunk) {
    const matching = chunk.candidates
      .filter(c => c.startsWith(currentInput))
      .sort((a, b) => a.length - b.length)
    if (matching.length > 0) {
      result += matching[0].slice(currentInput.length)
    }
  }

  // Subsequent chunks: show first candidate of each
  const end = Math.min(chunks.length, currentChunkIndex + 1 + maxChunks)
  for (let i = currentChunkIndex + 1; i < end; i++) {
    const c = chunks[i]
    if (c.candidates.length > 0) {
      result += c.candidates[0]
    }
  }

  return result
}
