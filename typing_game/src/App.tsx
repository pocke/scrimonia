import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeymapData } from './types'
import { KeymapUploader } from './components/KeymapUploader'
import { KeymapSender } from './components/KeymapSender'
import { PianoKeyboard } from './components/PianoKeyboard'
import { TypingGame, type GameMode } from './components/TypingGame'
import { SettingsModal } from './components/SettingsModal'
import { DeviceConsole, type DeviceLogLine } from './components/DeviceConsole'
import { ScrimoniaSerial } from './lib/webSerial'
import { parseDeviceMessage } from './lib/deviceMessages'
import { type RomajiPreferences, loadPreferences, savePreferences } from './lib/romajiPreferences'
import { useMidiInput, type MidiConnectionStatus } from './lib/useMidiInput'

const MAX_LOG_LINES = 200

const KEYMAP_STORAGE_KEY = 'scrimonia-keymap-data'
const RAW_KEYMAP_STORAGE_KEY = 'scrimonia-raw-keymap'

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
  const [appMode, setAppMode] = useState<GameMode>('en')
  const [romajiPreferences, setRomajiPreferences] = useState<RomajiPreferences>(loadPreferences)
  const [showSettings, setShowSettings] = useState(false)

  const [serial] = useState(() => new ScrimoniaSerial())
  const [serialConnected, setSerialConnected] = useState(false)
  useEffect(() => () => { void serial.disconnect() }, [serial])
  const [deviceLines, setDeviceLines] = useState<DeviceLogLine[]>([])
  const [activeLayerName, setActiveLayerName] = useState<string>('default')
  // WebSerial 経由でデバイスから届く note 群。色を決めずに「押下中」だけを
  // 追跡する。文字入力モードでは note_on と HID キー入力にミリ秒単位の前後関係が
  // あり、note_on で即座に緑にすると判定後に赤へ転ぶ flicker が出るため、
  // 「判定が来てから初めて色を確定する」設計にしている。
  // - serialRight: TypingGame が「正解」と判定した押下中ノート → 緑
  // - serialWrong: TypingGame が「不正解」と判定した押下中ノート → 赤
  // どちらも note_off まで維持し続ける。
  const [serialRightNotes, setSerialRightNotes] = useState<number[]>([])
  const [serialWrongNotes, setSerialWrongNotes] = useState<number[]>([])
  const lineIdRef = useRef(0)
  const serialActiveSetRef = useRef<Set<number>>(new Set())
  const serialRightSetRef = useRef<Set<number>>(new Set())
  const serialWrongSetRef = useRef<Set<number>>(new Set())

  // MIDI 入力をどのモードでも常時購読し、ピアノ風の音を鳴らす。
  // activeNotes は Web MIDI 経由で押下中のノート (passthrough 中など)。
  const { status: midiStatus, activeNotes: midiActiveNotes } = useMidiInput()

  // 接続状態の変更点で WebSerial 経由の押下中ノートと判定結果を掃除する。
  // 切断後は note_off が届かないので、放置すると鍵盤が光ったままになる。
  const handleSerialConnectedChange = useCallback((connected: boolean) => {
    setSerialConnected(connected)
    if (!connected) {
      serialActiveSetRef.current.clear()
      serialRightSetRef.current.clear()
      serialWrongSetRef.current.clear()
      setSerialRightNotes([])
      setSerialWrongNotes([])
    }
  }, [])

  // タイピング側の正誤判定を受けて、現在押下中の全 serial ノートを right か
  // wrong のセットに昇格させる。文字とノートの厳密な対応 (velocity 条件で
  // 弱打/強打を区別するキーマップ等) を知らなくても、単音演奏なら正しいノートに
  // 色が付く。同じノートで二重に昇格させない (right にいるなら wrong には
  // 入れない) ことで、押下中の色を安定させる。
  const handleRightTypingInput = useCallback(() => {
    let changed = false
    for (const note of serialActiveSetRef.current) {
      if (serialWrongSetRef.current.has(note)) continue
      if (!serialRightSetRef.current.has(note)) {
        serialRightSetRef.current.add(note)
        changed = true
      }
    }
    if (changed) {
      setSerialRightNotes(Array.from(serialRightSetRef.current))
    }
  }, [])

  const handleWrongTypingInput = useCallback(() => {
    let changed = false
    for (const note of serialActiveSetRef.current) {
      if (serialRightSetRef.current.has(note)) continue
      if (!serialWrongSetRef.current.has(note)) {
        serialWrongSetRef.current.add(note)
        changed = true
      }
    }
    if (changed) {
      setSerialWrongNotes(Array.from(serialWrongSetRef.current))
    }
  }, [])

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
    } else if (msg?.type === 'note_on') {
      // 描画はしないので state 更新不要。判定が来た時の検索用に Set だけ追跡する。
      serialActiveSetRef.current.add(msg.note)
    } else if (msg?.type === 'note_off') {
      serialActiveSetRef.current.delete(msg.note)
      if (serialRightSetRef.current.delete(msg.note)) {
        setSerialRightNotes(Array.from(serialRightSetRef.current))
      }
      if (serialWrongSetRef.current.delete(msg.note)) {
        setSerialWrongNotes(Array.from(serialWrongSetRef.current))
      }
    }
  }, [])

  // 緑で塗るノート: Web MIDI 経由で直接届いている押下 (passthrough や直接接続)
  // と、WebSerial 経由で文字判定が「正解」と確定したもの。「弾いただけ・判定
  // 待ち」の serial ノートは未確定の状態として色を付けない。
  const allActiveNotes = midiActiveNotes.length === 0
    ? serialRightNotes
    : serialRightNotes.length === 0
    ? midiActiveNotes
    : Array.from(new Set([...midiActiveNotes, ...serialRightNotes]))

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
        <h1 className="text-2xl font-bold">Scrimonia Typing Game</h1>
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
                  setConnected={handleSerialConnectedChange}
                  onLine={handleDeviceLine}
                />
              </div>
            </div>
            <PianoKeyboard keymap={activeLayer} highlightNotes={typingHighlightNotes} activeNotes={allActiveNotes} wrongNotes={serialWrongNotes} />
            <MidiStatusView status={midiStatus} />
            <TypingGame key={`${appMode}-${activeLayerName}`} keymap={activeLayer} onHighlightChange={setTypingHighlightNotes} onRightInput={handleRightTypingInput} onWrongInput={handleWrongTypingInput} mode={appMode} romajiPreferences={romajiPreferences} />
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

function MidiStatusView({ status }: { status: MidiConnectionStatus }) {
  switch (status.kind) {
    case 'unsupported':
      return (
        <p className="text-xs text-red-400">
          MIDI 入力は Chrome / Edge / Opera などの Web MIDI API 対応ブラウザでのみ動作します
        </p>
      )
    case 'requesting':
      return null
    case 'denied':
      return (
        <p className="text-xs text-red-400">
          MIDI へのアクセスが拒否されました: {status.message}
        </p>
      )
    case 'no-device':
      return (
        <p className="text-xs text-yellow-400">
          MIDI デバイスが接続されていません
        </p>
      )
    case 'connected':
      return (
        <p className="text-xs text-gray-400">
          MIDI 接続中: <span className="text-gray-200">{status.deviceNames.join(', ')}</span>
        </p>
      )
  }
}

export default App
