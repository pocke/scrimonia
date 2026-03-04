import { useState } from 'react'
import type { KeymapData } from './types'
import { KeymapUploader } from './components/KeymapUploader'
import { PianoKeyboard } from './components/PianoKeyboard'
import { TypingGame, type GameMode } from './components/TypingGame'

function App() {
  const [keymap, setKeymap] = useState<KeymapData | null>(null)
  const [highlightNotes, setHighlightNotes] = useState<number[] | undefined>()
  const [gameMode, setGameMode] = useState<GameMode>('en')

  const defaultLayer = keymap ? (keymap['default'] ?? Object.values(keymap)[0]) : null

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold">MidiPico Typing Game</h1>
      </header>
      <main className="max-w-5xl mx-auto p-8 space-y-8">
        <KeymapUploader onKeymapParsed={setKeymap} />
        {defaultLayer && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => setGameMode('en')}
                className={`px-4 py-2 rounded text-sm ${
                  gameMode === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                英字モード
              </button>
              <button
                onClick={() => setGameMode('ja')}
                className={`px-4 py-2 rounded text-sm ${
                  gameMode === 'ja'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ローマ字モード
              </button>
            </div>
            <PianoKeyboard keymap={defaultLayer} highlightNotes={highlightNotes} />
            <TypingGame keymap={defaultLayer} onHighlightChange={setHighlightNotes} mode={gameMode} />
          </>
        )}
      </main>
    </div>
  )
}

export default App
