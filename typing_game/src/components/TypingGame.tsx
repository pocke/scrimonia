import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { LayerKeymap } from '../types'
import { buildReverseKeymap } from '../lib/reverseKeymap'
import { sampleTexts } from '../lib/sampleTexts'

interface Props {
  keymap: LayerKeymap
  onHighlightChange: (noteNumber: number | undefined) => void
}

interface GameState {
  status: 'idle' | 'playing' | 'finished'
  targetText: string
  currentIndex: number
  errors: number
  startTime: number | null
}

export function TypingGame({ keymap, onHighlightChange }: Props) {
  const [game, setGame] = useState<GameState>(() => ({
    status: 'idle',
    targetText: sampleTexts[Math.floor(Math.random() * sampleTexts.length)],
    currentIndex: 0,
    errors: 0,
    startTime: null,
  }))
  const [elapsedMs, setElapsedMs] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const reverseKeymap = useMemo(() => buildReverseKeymap(keymap), [keymap])

  // 現在の文字に対応するノートをハイライト
  useEffect(() => {
    if (game.status === 'finished') {
      onHighlightChange(undefined)
      return
    }
    const char = game.targetText[game.currentIndex]
    if (char) {
      const hints = reverseKeymap.get(char)
      onHighlightChange(hints?.[0]?.noteNumber)
    } else {
      onHighlightChange(undefined)
    }
  }, [game.currentIndex, game.targetText, game.status, reverseKeymap, onHighlightChange])

  // 経過時間の更新
  useEffect(() => {
    if (game.status !== 'playing' || !game.startTime) return
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - game.startTime!)
    }, 100)
    return () => clearInterval(interval)
  }, [game.status, game.startTime])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (game.status === 'finished') return

    const key = e.key
    if (key.length !== 1) return

    e.preventDefault()

    setGame(prev => {
      const target = prev.targetText[prev.currentIndex]
      if (!target) return prev

      if (prev.status === 'idle') {
        if (key === target) {
          const next = prev.currentIndex + 1
          return {
            ...prev,
            status: next >= prev.targetText.length ? 'finished' : 'playing',
            currentIndex: next,
            startTime: Date.now(),
          }
        }
        return { ...prev, status: 'playing', startTime: Date.now(), errors: prev.errors + 1 }
      }

      if (key === target) {
        const next = prev.currentIndex + 1
        return {
          ...prev,
          status: next >= prev.targetText.length ? 'finished' : prev.status,
          currentIndex: next,
        }
      }
      return { ...prev, errors: prev.errors + 1 }
    })
  }, [game.status])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // コンポーネント表示時にフォーカス
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const handleRetry = () => {
    setGame({
      status: 'idle',
      targetText: game.targetText,
      currentIndex: 0,
      errors: 0,
      startTime: null,
    })
    setElapsedMs(0)
  }

  const handleNext = () => {
    const nextText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)]
    setGame({
      status: 'idle',
      targetText: nextText,
      currentIndex: 0,
      errors: 0,
      startTime: null,
    })
    setElapsedMs(0)
  }

  const elapsedSec = elapsedMs / 1000
  const wpm = elapsedSec > 0 ? Math.round((game.currentIndex / 5) / (elapsedSec / 60)) : 0
  const accuracy = game.currentIndex + game.errors > 0
    ? Math.round((game.currentIndex / (game.currentIndex + game.errors)) * 100)
    : 100

  return (
    <div ref={containerRef} tabIndex={-1} className="outline-none space-y-6">
      {/* お題テキスト */}
      <div className="bg-gray-800 rounded-lg p-6 font-mono text-2xl leading-relaxed tracking-wide select-none">
        {game.targetText.split('').map((char, i) => {
          let className = 'text-gray-500'
          if (i < game.currentIndex) {
            className = 'text-green-400'
          } else if (i === game.currentIndex) {
            className = 'text-white underline underline-offset-4 decoration-blue-400'
          }
          return (
            <span key={i} className={className}>
              {char}
            </span>
          )
        })}
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
                次のお題
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
