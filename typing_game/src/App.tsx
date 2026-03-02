import { useState } from 'react'
import type { KeymapData } from './types'
import { KeymapUploader } from './components/KeymapUploader'
import { PianoKeyboard } from './components/PianoKeyboard'
import { TypingGame } from './components/TypingGame'

function App() {
  const [keymap, setKeymap] = useState<KeymapData | null>(null)
  const [highlightNotes, setHighlightNotes] = useState<number[] | undefined>()

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
            <PianoKeyboard keymap={defaultLayer} highlightNotes={highlightNotes} />
            <TypingGame keymap={defaultLayer} onHighlightChange={setHighlightNotes} />
          </>
        )}
      </main>
    </div>
  )
}

export default App
