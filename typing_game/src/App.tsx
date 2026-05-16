import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeymapData } from './types'
import { KeymapUploader } from './components/KeymapUploader'
import { KeymapSender } from './components/KeymapSender'
import { PianoKeyboard } from './components/PianoKeyboard'
import { TypingGame, type GameMode } from './components/TypingGame'
import { FreePlayMode } from './components/FreePlayMode'
import { SettingsModal } from './components/SettingsModal'
import { DeviceConsole, type DeviceLogLine } from './components/DeviceConsole'
import { MidiPicoSerial } from './lib/webSerial'
import { parseDeviceMessage } from './lib/deviceMessages'
import { type RomajiPreferences, loadPreferences, savePreferences } from './lib/romajiPreferences'

type AppMode = GameMode | 'free'

const MAX_LOG_LINES = 200

const KEYMAP_STORAGE_KEY = 'midipico-keymap-data'
const RAW_KEYMAP_STORAGE_KEY = 'midipico-raw-keymap'

function loadKeymapFromStorage(): KeymapData | null {
  try {
    const raw = localStorage.getItem(KEYMAP_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as KeymapData
  } catch {
    return null
  }
}

function saveKeymapToStorage(data: KeymapData): void {
  localStorage.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(data))
}

function App() {
  const [keymap, setKeymap] = useState<KeymapData | null>(loadKeymapFromStorage)
  const [rawKeymap, setRawKeymap] = useState<string | null>(() => localStorage.getItem(RAW_KEYMAP_STORAGE_KEY))
  const [typingHighlightNotes, setTypingHighlightNotes] = useState<number[] | undefined>()
  const [midiActiveNotes, setMidiActiveNotes] = useState<number[]>([])
  const [appMode, setAppMode] = useState<AppMode>('en')
  const [romajiPreferences, setRomajiPreferences] = useState<RomajiPreferences>(loadPreferences)
  const [showSettings, setShowSettings] = useState(false)

  const [serial] = useState(() => new MidiPicoSerial())
  const [serialConnected, setSerialConnected] = useState(false)
  useEffect(() => () => { void serial.disconnect() }, [serial])
  const [deviceLines, setDeviceLines] = useState<DeviceLogLine[]>([])
  const [activeLayerName, setActiveLayerName] = useState<string>('default')
  const lineIdRef = useRef(0)

  const handleDeviceLine = useCallback((line: string) => {
    setDeviceLines(prev => {
      const id = ++lineIdRef.current
      const next = prev.length >= MAX_LOG_LINES
        ? [...prev.slice(prev.length - MAX_LOG_LINES + 1), { id, text: line }]
        : [...prev, { id, text: line }]
      return next
    })
    const msg = parseDeviceMessage(line)
    if (msg?.type === 'layer_change') {
      setActiveLayerName(msg.layer)
    }
  }, [])

  const highlightNotes = appMode === 'free' ? midiActiveNotes : typingHighlightNotes

  const activeLayer = keymap
    ? (keymap[activeLayerName] ?? keymap['default'] ?? Object.values(keymap)[0])
    : null

  const handleKeymapParsed = (data: KeymapData, rawContent: string) => {
    setKeymap(data)
    saveKeymapToStorage(data)
    setRawKeymap(rawContent)
    localStorage.setItem(RAW_KEYMAP_STORAGE_KEY, rawContent)
  }

  const handlePreferencesChange = (prefs: RomajiPreferences) => {
    setRomajiPreferences(prefs)
    savePreferences(prefs)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold">MidiPico Typing Game</h1>
      </header>
      <main className="max-w-5xl mx-auto p-8 space-y-8">
        {!keymap && <KeymapUploader onKeymapParsed={handleKeymapParsed} />}
        {activeLayer && (
          <>
            <div className="flex gap-2 items-center flex-wrap">
              <button
                onClick={() => setAppMode('en')}
                className={`px-4 py-2 rounded text-sm ${
                  appMode === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                英字モード
              </button>
              <button
                onClick={() => setAppMode('ja')}
                className={`px-4 py-2 rounded text-sm ${
                  appMode === 'ja'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ローマ字モード
              </button>
              <button
                onClick={() => setAppMode('free')}
                className={`px-4 py-2 rounded text-sm ${
                  appMode === 'free'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                自由演奏モード
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded text-gray-400 hover:text-white hover:bg-gray-700"
                title="設定"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="ml-auto flex items-center gap-3">
                {keymap && Object.keys(keymap).length > 1 && (
                  <span className="text-sm text-gray-400">
                    レイヤー: <span className="text-gray-200">{activeLayerName}</span>
                  </span>
                )}
                <KeymapSender
                  rawKeymap={rawKeymap}
                  serial={serial}
                  connected={serialConnected}
                  setConnected={setSerialConnected}
                  onLine={handleDeviceLine}
                />
              </div>
            </div>
            <PianoKeyboard keymap={activeLayer} highlightNotes={highlightNotes} />
            {appMode === 'free' ? (
              <FreePlayMode onActiveNotesChange={setMidiActiveNotes} />
            ) : (
              <TypingGame key={`${appMode}-${activeLayerName}`} keymap={activeLayer} onHighlightChange={setTypingHighlightNotes} mode={appMode} romajiPreferences={romajiPreferences} />
            )}
            <DeviceConsole lines={deviceLines} />
          </>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          preferences={romajiPreferences}
          onPreferencesChange={handlePreferencesChange}
          onKeymapParsed={handleKeymapParsed}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export default App
