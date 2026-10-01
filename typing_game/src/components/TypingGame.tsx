import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ChordHighlight, LayerKeymap } from '../types'
import { buildReverseKeymap, type MacroHint } from '../lib/reverseKeymap'
import { entryLabel } from '../lib/hidKeycodes'
import { sampleTexts } from '../lib/sampleTexts'
import { sampleTextsJa, type JapaneseSampleText } from '../lib/sampleTextsJa'
import {
  type RomajiInputState,
  createInitialState,
  processKey,
  getNextExpectedChars,
  getRemainingRomaji,
  canTypeSequence,
} from '../lib/romajiMatcher'
import type { RomajiPreferences } from '../lib/romajiPreferences'

export type GameMode = 'en' | 'ja'

interface Props {
  keymap: LayerKeymap
  onHighlightChange: (noteNumbers: number[] | undefined) => void
  /** 次に押すと文字が打てるマクロ和音の一覧。ピアノに点線で表示するための通知。 */
  onChordHighlightChange?: (chords: ChordHighlight[] | undefined) => void
  /** 期待文字と一致するキー入力があったときに呼ばれる。鍵盤を緑にするための通知。 */
  onRightInput?: () => void
  /** 期待文字と一致しないキー入力があったときに呼ばれる。鍵盤を赤くするための通知。 */
  onWrongInput?: () => void
  mode: GameMode
  romajiPreferences: RomajiPreferences
}

function macroHintToChordHighlight(macro: MacroHint): ChordHighlight {
  return { noteNumbers: macro.noteNumbers, label: entryLabel({ ...macro, type: 'macro' }) }
}

interface GameState {
  status: 'idle' | 'playing' | 'finished'
  mode: GameMode
  targetText: string
  displayText: string | null  // Kanji display for ja mode
  currentIndex: number
  errors: number
  startTime: number | null
  romajiState: RomajiInputState | null
}

function pickJaText(): JapaneseSampleText {
  return sampleTextsJa[Math.floor(Math.random() * sampleTextsJa.length)]
}

function pickEnText(): string {
  return sampleTexts[Math.floor(Math.random() * sampleTexts.length)]
}

function createGameState(mode: GameMode, retryText?: { targetText: string; displayText: string | null }): GameState {
  if (mode === 'ja') {
    const kana = retryText?.targetText ?? pickJaText().kana
    const display = retryText?.displayText ?? sampleTextsJa.find(t => t.kana === kana)?.display ?? kana
    return {
      status: 'idle',
      mode,
      targetText: kana,
      displayText: display,
      currentIndex: 0,
      errors: 0,
      startTime: null,
      romajiState: createInitialState(kana),
    }
  }
  const text = retryText?.targetText ?? pickEnText()
  return {
    status: 'idle',
    mode,
    targetText: text,
    displayText: null,
    currentIndex: 0,
    errors: 0,
    startTime: null,
    romajiState: null,
  }
}

function createNewGameState(mode: GameMode): GameState {
  if (mode === 'ja') {
    const sample = pickJaText()
    return {
      status: 'idle',
      mode,
      targetText: sample.kana,
      displayText: sample.display,
      currentIndex: 0,
      errors: 0,
      startTime: null,
      romajiState: createInitialState(sample.kana),
    }
  }
  return {
    status: 'idle',
    mode,
    targetText: pickEnText(),
    displayText: null,
    currentIndex: 0,
    errors: 0,
    startTime: null,
    romajiState: null,
  }
}

export function TypingGame({ keymap, onHighlightChange, onChordHighlightChange, onRightInput, onWrongInput, mode, romajiPreferences }: Props) {
  const [game, setGame] = useState<GameState>(() => createNewGameState(mode))
  const [elapsedMs, setElapsedMs] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const reverseKeymap = useMemo(() => buildReverseKeymap(keymap), [keymap])

  // Highlight notes for the next expected key
  useEffect(() => {
    if (game.status === 'finished') {
      onHighlightChange(undefined)
      onChordHighlightChange?.(undefined)
      return
    }

    if (game.mode === 'en') {
      const remaining = game.targetText.slice(game.currentIndex)
      const matchedMacros = reverseKeymap.macros.filter(macro => remaining.startsWith(macro.text))

      const char = game.targetText[game.currentIndex]
      const hints = char ? reverseKeymap.byChar.get(char) : undefined
      const singleNotes = hints ? hints.flatMap(h => h.noteNumbers) : []
      const allNotes = [...singleNotes, ...matchedMacros.flatMap(m => m.noteNumbers)]
      onHighlightChange(allNotes.length > 0 ? allNotes : undefined)
      onChordHighlightChange?.(matchedMacros.length > 0 ? matchedMacros.map(macroHintToChordHighlight) : undefined)
    } else if (game.romajiState) {
      const matchedMacros = reverseKeymap.macros.filter(macro => canTypeSequence(game.romajiState!, macro.text))

      const nextChars = getNextExpectedChars(game.romajiState, romajiPreferences)
      const singleNotes = nextChars.flatMap(ch => {
        const hints = reverseKeymap.byChar.get(ch)
        return hints ? hints.flatMap(h => h.noteNumbers) : []
      })
      const allNotes = [...singleNotes, ...matchedMacros.flatMap(m => m.noteNumbers)]
      onHighlightChange(allNotes.length > 0 ? allNotes : undefined)
      onChordHighlightChange?.(matchedMacros.length > 0 ? matchedMacros.map(macroHintToChordHighlight) : undefined)
    }
  }, [game.currentIndex, game.targetText, game.status, game.mode, game.romajiState, reverseKeymap, onHighlightChange, onChordHighlightChange, romajiPreferences])

  // Elapsed time timer
  useEffect(() => {
    if (game.status !== 'playing' || !game.startTime) return
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - game.startTime!)
    }, 100)
    return () => clearInterval(interval)
  }, [game.status, game.startTime])

  const triggerShake = useCallback(() => {
    setShakeKey(k => k + 1)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (game.status === 'finished') {
      if (e.key === 'Enter') {
        e.preventDefault()
        setGame(createNewGameState(game.mode))
        setElapsedMs(0)
      }
      return
    }

    const key = e.key
    if (key.length !== 1) return

    e.preventDefault()

    if (game.mode === 'en') {
      // English mode: existing logic
      setGame(prev => {
        const target = prev.targetText[prev.currentIndex]
        if (!target) return prev

        if (prev.status === 'idle') {
          if (key === target) {
            const next = prev.currentIndex + 1
            onRightInput?.()
            return {
              ...prev,
              status: next >= prev.targetText.length ? 'finished' : 'playing',
              currentIndex: next,
              startTime: Date.now(),
            }
          }
          triggerShake()
          onWrongInput?.()
          return { ...prev, status: 'playing', startTime: Date.now(), errors: prev.errors + 1 }
        }

        if (key === target) {
          const next = prev.currentIndex + 1
          onRightInput?.()
          return {
            ...prev,
            status: next >= prev.targetText.length ? 'finished' : prev.status,
            currentIndex: next,
          }
        }
        triggerShake()
        onWrongInput?.()
        return { ...prev, errors: prev.errors + 1 }
      })
    } else {
      // Romaji mode
      setGame(prev => {
        if (!prev.romajiState) return prev

        const result = processKey(prev.romajiState, key)

        switch (result.type) {
          case 'pending':
            onRightInput?.()
            return {
              ...prev,
              status: prev.status === 'idle' ? 'playing' : prev.status,
              startTime: prev.startTime ?? Date.now(),
              romajiState: result.nextState,
            }
          case 'advance':
            onRightInput?.()
            return {
              ...prev,
              status: prev.status === 'idle' ? 'playing' : prev.status,
              startTime: prev.startTime ?? Date.now(),
              currentIndex: result.nextState.currentChunkIndex,
              romajiState: result.nextState,
            }
          case 'complete':
            onRightInput?.()
            return {
              ...prev,
              status: 'finished',
              currentIndex: result.nextState.currentChunkIndex,
              romajiState: result.nextState,
            }
          case 'error':
            triggerShake()
            onWrongInput?.()
            return {
              ...prev,
              status: prev.status === 'idle' ? 'playing' : prev.status,
              startTime: prev.startTime ?? Date.now(),
              errors: prev.errors + 1,
            }
        }
      })
    }
  }, [game.status, game.mode, triggerShake, onRightInput, onWrongInput])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Focus on mount
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const handleRetry = () => {
    setGame(createGameState(game.mode, { targetText: game.targetText, displayText: game.displayText }))
    setElapsedMs(0)
  }

  const handleNext = () => {
    setGame(createNewGameState(game.mode))
    setElapsedMs(0)
  }

  const elapsedSec = elapsedMs / 1000
  // For romaji mode, count typed romaji characters for WPM
  const typedChars = game.mode === 'ja' && game.romajiState
    ? game.romajiState.confirmedRomaji.length
    : game.currentIndex
  const wpm = elapsedSec > 0 ? Math.round((typedChars / 5) / (elapsedSec / 60)) : 0
  const accuracy = typedChars + game.errors > 0
    ? Math.round((typedChars / (typedChars + game.errors)) * 100)
    : 100

  return (
    <div ref={containerRef} tabIndex={-1} className="outline-none space-y-6">
      {/* お題テキスト */}
      <div
        key={shakeKey}
        className={`bg-gray-800 rounded-lg p-6 font-mono select-none ${shakeKey > 0 ? 'animate-shake' : ''}`}
      >
        {game.mode === 'en' ? (
          // English mode: character-by-character display
          <div className="text-2xl leading-relaxed tracking-wide">
            {game.targetText.split('').map((char, i) => {
              let className = 'text-gray-500'
              if (i < game.currentIndex) {
                className = 'text-green-400'
              } else if (i === game.currentIndex) {
                className = shakeKey > 0
                  ? 'text-red-400 underline underline-offset-4 decoration-red-400'
                  : 'text-white underline underline-offset-4 decoration-blue-400'
              }
              return (
                <span key={i} className={className}>
                  {char}
                </span>
              )
            })}
          </div>
        ) : game.romajiState ? (
          // Romaji mode: three-line display (kanji + kana + romaji guide)
          <div className="space-y-3">
            {/* Kanji display line */}
            {game.displayText && (
              <div className="text-xl leading-relaxed tracking-wide text-gray-300">
                {game.displayText}
              </div>
            )}
            {/* Kana line */}
            <div className="text-2xl leading-relaxed tracking-wide">
              {game.romajiState.chunks.map((chunk, i) => {
                let className = 'text-gray-500'
                if (i < game.romajiState!.currentChunkIndex) {
                  className = 'text-green-400'
                } else if (i === game.romajiState!.currentChunkIndex) {
                  className = shakeKey > 0
                    ? 'text-red-400 underline underline-offset-4 decoration-red-400'
                    : 'text-white underline underline-offset-4 decoration-blue-400'
                }
                return (
                  <Fragment key={i}>
                    {chunk.spaceBefore && ' '}
                    <span className={className}>
                      {chunk.kana}
                    </span>
                  </Fragment>
                )
              })}
            </div>
            {/* Romaji guide line */}
            <div className="text-lg">
              <span className="text-green-400">{game.romajiState.confirmedRomaji}</span>
              <span className="text-white">{game.romajiState.currentInput}</span>
              <span className="text-gray-600">{getRemainingRomaji(game.romajiState, 10, romajiPreferences)}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* ステータス */}
      <div className="flex items-center gap-6 text-sm text-gray-400">
        {game.status === 'idle' && (
          <p>タイプを始めるとゲームが開始されます</p>
        )}
        {game.status === 'playing' && (
          <>
            <span>時間: {elapsedSec.toFixed(1)}s</span>
            <span>WPM: {wpm}</span>
            <span>正確さ: {accuracy}%</span>
            <span>ミス: {game.errors}</span>
          </>
        )}
        {game.status === 'finished' && (
          <div className="w-full space-y-4">
            <div className="flex gap-6">
              <span>時間: {elapsedSec.toFixed(1)}s</span>
              <span>WPM: {wpm}</span>
              <span>正確さ: {accuracy}%</span>
              <span>ミス: {game.errors}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 text-white text-sm"
              >
                もう一度
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-white text-sm"
              >
                次のお題 (Enter)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
