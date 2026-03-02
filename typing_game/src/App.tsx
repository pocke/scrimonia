import { useState } from 'react'
import type { KeymapData } from './types'
import { KeymapUploader } from './components/KeymapUploader'
import { KeymapView } from './components/KeymapView'

function App() {
  const [keymap, setKeymap] = useState<KeymapData | null>(null)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold">MidiPico Typing Game</h1>
      </header>
      <main className="max-w-4xl mx-auto p-8 space-y-8">
        <KeymapUploader onKeymapParsed={setKeymap} />
        {keymap && <KeymapView keymap={keymap} />}
      </main>
    </div>
  )
}

export default App
