import type { RomajiPreferences } from '../lib/romajiPreferences'
import type { KeymapData } from '../types'
import { MAX_RELEASE_SEC, MIN_RELEASE_SEC } from '../lib/releaseTimePreference'
import type { Instrument } from '../lib/synth'
import { KeymapUploader } from './KeymapUploader'

interface Props {
  preferences: RomajiPreferences
  onPreferencesChange: (prefs: RomajiPreferences) => void
  deviceSoundEnabled: boolean
  onDeviceSoundChange: (enabled: boolean) => void
  instrument: Instrument
  onInstrumentChange: (instrument: Instrument) => void
  releaseSec: number
  onReleaseSecChange: (sec: number) => void
  onKeymapParsed: (data: KeymapData, rawContent: string) => void
  onClose: () => void
}

interface SettingRow {
  label: string
  key: keyof RomajiPreferences
  options: { value: string; label: string }[]
}

const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: 'piano', label: 'ピアノ' },
  { value: 'koto', label: '琴' },
]

const SETTINGS: SettingRow[] = [
  { label: 'し行', key: 'shi', options: [{ value: 'si', label: 'si' }, { value: 'shi', label: 'shi' }] },
  { label: 'ち行', key: 'chi', options: [{ value: 'ti', label: 'ti' }, { value: 'chi', label: 'chi' }] },
  { label: 'つ',   key: 'tsu', options: [{ value: 'tu', label: 'tu' }, { value: 'tsu', label: 'tsu' }] },
  { label: 'ふ',   key: 'fu',  options: [{ value: 'hu', label: 'hu' }, { value: 'fu', label: 'fu' }] },
  { label: 'じ行', key: 'ji',  options: [{ value: 'zi', label: 'zi' }, { value: 'ji', label: 'ji' }] },
]

export function SettingsModal({ preferences, onPreferencesChange, deviceSoundEnabled, onDeviceSoundChange, instrument, onInstrumentChange, releaseSec, onReleaseSecChange, onKeymapParsed, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-lg p-6 w-96 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">設定</h2>

        {/* Romaji style preferences */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">ローマ字スタイル</h3>
          <p className="text-xs text-gray-400">鍵盤ハイライトとガイド表示に使うスタイルを選択</p>
          {SETTINGS.map(({ label, key, options }) => (
            <div key={key} className="flex items-center gap-4">
              <span className="text-gray-300 w-12 text-sm shrink-0">{label}</span>
              <div className="flex gap-3">
                {options.map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={key}
                      value={opt.value}
                      checked={preferences[key] === opt.value}
                      onChange={() => onPreferencesChange({ ...preferences, [key]: opt.value })}
                      className="accent-blue-500"
                    />
                    <span className="text-gray-200">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">サウンド</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={deviceSoundEnabled}
              onChange={e => onDeviceSoundChange(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-gray-200">デバイスで押した鍵盤の音を鳴らす</span>
          </label>
          <div className="flex items-center gap-4">
            <span className="text-gray-200 text-sm shrink-0">音色</span>
            <div className="flex gap-3">
              {INSTRUMENTS.map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="instrument"
                    value={opt.value}
                    checked={instrument === opt.value}
                    onChange={() => onInstrumentChange(opt.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-gray-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <label htmlFor="release-sec" className="text-gray-200 shrink-0">音の余韻</label>
            <input
              id="release-sec"
              type="range"
              min={MIN_RELEASE_SEC}
              max={MAX_RELEASE_SEC}
              step={0.05}
              value={releaseSec}
              onChange={e => onReleaseSecChange(Number(e.target.value))}
              className="accent-blue-500 flex-1"
            />
            <span className="text-gray-300 w-16 text-right tabular-nums">{releaseSec.toFixed(2)} 秒</span>
          </div>
        </div>

        {/* Keymap uploader */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">キーマップ</h3>
          <KeymapUploader onKeymapParsed={onKeymapParsed} />
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-white text-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
