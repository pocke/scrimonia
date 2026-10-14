import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ChordHighlight, LayerKeymap } from '../types'
import { buildReverseKeymap, type MacroHint } from '../lib/reverseKeymap'
import { entryLabel, noteNumberToName } from '../lib/hidKeycodes'
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
import type { Synth } from '../lib/synth'
import { planPreview, textToCharChunks, type PreviewPlan, type PreviewStroke } from '../lib/previewPlanner'
import { playPreview, STROKE_INTERVAL_MS } from '../lib/previewPlayer'
import { PREVIEW_SPEEDS, loadPreviewSpeed, savePreviewSpeed } from '../lib/previewSpeedPreference'

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
  /** プレビュー再生中に鳴らしている打鍵のノート。ピアノで押下中の見た目にするための通知。 */
  onPreviewNotesChange?: (noteNumbers: number[] | undefined) => void
  mode: GameMode
  romajiPreferences: RomajiPreferences
  synth: Synth
}

function macroHintToChordHighlight(macro: MacroHint): ChordHighlight {
  return { noteNumbers: macro.noteNumbers, label: entryLabel({ ...macro, type: 'macro' }) }
}

const PREVIEW_HIGHLIGHT_CLASS = 'text-yellow-300 bg-yellow-500/20 rounded'

function previewStrokeToChordHighlight(stroke: PreviewStroke): ChordHighlight {
  const label = entryLabel({ type: 'macro', text: stroke.text, noteNumbers: stroke.noteNumbers, noteNames: [], velocity: null })
  return { noteNumbers: stroke.noteNumbers, label }
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

function displayChar(kana: string | undefined): string {
  return kana === ' ' ? '␣' : (kana ?? '')
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

function createJaGameState(sample: JapaneseSampleText): GameState {
  return {
    status: 'idle',
    mode: 'ja',
    targetText: sample.kana,
    displayText: sample.display,
    currentIndex: 0,
    errors: 0,
    startTime: null,
    romajiState: createInitialState(sample.kana),
  }
}

function createNewGameState(mode: GameMode): GameState {
  if (mode === 'ja') return createJaGameState(pickJaText())
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

export function TypingGame({ keymap, onHighlightChange, onChordHighlightChange, onRightInput, onWrongInput, onPreviewNotesChange, mode, romajiPreferences, synth }: Props) {
  const [game, setGame] = useState<GameState>(() => createNewGameState(mode))
  const [elapsedMs, setElapsedMs] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const reverseKeymap = useMemo(() => buildReverseKeymap(keymap), [keymap])

  const [playingPlan, setPlayingPlan] = useState<PreviewPlan | null>(null)
  const stopPreviewRef = useRef<(() => void) | null>(null)
  const [playingStroke, setPlayingStroke] = useState<number | null>(null)
  const [previewSpeed, setPreviewSpeed] = useState(loadPreviewSpeed)

  const stopPreview = useCallback(() => {
    stopPreviewRef.current?.()
    stopPreviewRef.current = null
    setPlayingPlan(null)
  }, [])

  const preview = useMemo(() => {
    const chunks = game.mode === 'ja'
      ? createInitialState(game.targetText).chunks
      : textToCharChunks(game.targetText)
    return { chunks, plan: planPreview(keymap, chunks, romajiPreferences) }
  }, [keymap, game.mode, game.targetText, romajiPreferences])

  // playingPlan は plan の同一性で比べるので、plan が変わったときは setState せずタイマーだけ止める。
  useEffect(() => () => {
    stopPreviewRef.current?.()
    stopPreviewRef.current = null
  }, [preview])

  const previewing = playingPlan === preview.plan
  const previewStroke: PreviewStroke | undefined =
    previewing && preview.plan.ok && playingStroke !== null ? preview.plan.strokes[playingStroke] : undefined

  useEffect(() => {
    onPreviewNotesChange?.(previewStroke?.noteNumbers)
    return () => onPreviewNotesChange?.(undefined)
  }, [previewStroke, onPreviewNotesChange])

  // Highlight notes for the next expected key
  useEffect(() => {
    if (game.status === 'finished') {
      onHighlightChange(undefined)
      onChordHighlightChange?.(undefined)
      return
    }

    if (previewStroke) {
      onHighlightChange(undefined)
      onChordHighlightChange?.(previewStroke.noteNumbers.length >= 2 ? [previewStrokeToChordHighlight(previewStroke)] : undefined)
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
  }, [game.currentIndex, game.targetText, game.status, game.mode, game.romajiState, reverseKeymap, onHighlightChange, onChordHighlightChange, romajiPreferences, previewStroke])

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
    stopPreview()

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
  }, [game.status, game.mode, triggerShake, onRightInput, onWrongInput, stopPreview])

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

  const startPlayback = (plan: PreviewPlan & { ok: true }, startIndex: number, speed: number) => {
    stopPreviewRef.current?.()
    setPlayingPlan(plan)
    stopPreviewRef.current = playPreview(synth, plan.strokes, () => {
      stopPreviewRef.current = null
      setPlayingPlan(null)
    }, {
      intervalMs: STROKE_INTERVAL_MS / speed,
      startIndex,
      onStroke: setPlayingStroke,
    })
    setPlayingStroke(startIndex)
  }

  const handleTogglePreview = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    if (previewing) {
      stopPreview()
      return
    }
    if (!preview.plan.ok) return
    startPlayback(preview.plan, 0, previewSpeed)
  }

  const handleChangeSpeed = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const speed = Number(e.target.value)
    e.currentTarget.blur()
    setPreviewSpeed(speed)
    savePreviewSpeed(speed)
    if (previewing && preview.plan.ok) startPlayback(preview.plan, playingStroke ?? 0, speed)
  }

  const handleSelectPoem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sample = sampleTextsJa[Number(e.target.value)]
    e.currentTarget.blur()
    if (!sample) return
    setGame(createJaGameState(sample))
    setElapsedMs(0)
  }

  const selectedPoemIndex = game.mode === 'ja'
    ? sampleTextsJa.findIndex(t => t.kana === game.targetText)
    : -1

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
      <div className="flex items-center gap-3">
        {game.mode === 'ja' && (
          <select
            value={selectedPoemIndex}
            onChange={handleSelectPoem}
            className="min-w-0 flex-1 bg-gray-800 text-gray-200 text-sm rounded px-3 py-2 border border-gray-700"
          >
            {sampleTextsJa.map((t, i) => (
              <option key={i} value={i}>{`${i + 1}. ${t.display}`}</option>
            ))}
          </select>
        )}
        <button
          onClick={handleTogglePreview}
          disabled={!previewing && !preview.plan.ok}
          className="shrink-0 px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 text-white text-sm disabled:opacity-40 disabled:hover:bg-gray-700"
        >
          {previewing ? '■ 停止' : '▶ 音をプレビュー'}
        </button>
        <select
          value={previewSpeed}
          onChange={handleChangeSpeed}
          aria-label="プレビューの再生速度"
          className="shrink-0 bg-gray-800 text-gray-200 text-sm rounded px-2 py-2 border border-gray-700"
        >
          {PREVIEW_SPEEDS.map(speed => (
            <option key={speed} value={speed}>{`${speed}×`}</option>
          ))}
        </select>
      </div>
      {previewStroke && (
        <p className="text-sm text-yellow-300">
          {`♪ ${previewStroke.text} (${previewStroke.noteNumbers.map(noteNumberToName).join('+')})`}
        </p>
      )}
      {!preview.plan.ok && (
        <p className="text-sm text-red-400">
          このレイヤーでは「{displayChar(preview.chunks[preview.plan.chunkIndex]?.kana)}」を入力できない
        </p>
      )}
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
              if (previewStroke && i >= previewStroke.chunkStart && i <= previewStroke.chunkEnd) {
                className = PREVIEW_HIGHLIGHT_CLASS
              } else if (i < game.currentIndex) {
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
                if (previewStroke && i >= previewStroke.chunkStart && i <= previewStroke.chunkEnd) {
                  className = PREVIEW_HIGHLIGHT_CLASS
                } else if (i < game.romajiState!.currentChunkIndex) {
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
