import type { RomajiPreferences } from '../lib/romajiPreferences'
import type { KeymapData } from '../types'
import { KeymapUploader } from './KeymapUploader'

interface Props {
  preferences: RomajiPreferences
  onPreferencesChange: (prefs: RomajiPreferences) => void
  onKeymapParsed: (data: KeymapData) => void
  onClose: () => void
}

interface SettingRow {
  label: string
  key: keyof RomajiPreferences
  options: { value: string; label: string }[]
}

const SETTINGS: SettingRow[] = [
  { label: 'し行', key: 'shi', options: [{ value: 'si', label: 'si' }, { value: 'shi', label: 'shi' }] },
  { label: 'ち行', key: 'chi', options: [{ value: 'ti', label: 'ti' }, { value: 'chi', label: 'chi' }] },
  { label: 'つ',   key: 'tsu', options: [{ value: 'tu', label: 'tu' }, { value: 'tsu', label: 'tsu' }] },
  { label: 'ふ',   key: 'fu',  options: [{ value: 'hu', label: 'hu' }, { value: 'fu', label: 'fu' }] },
  { label: 'じ行', key: 'ji',  options: [{ value: 'zi', label: 'zi' }, { value: 'ji', label: 'ji' }] },
]

export function SettingsModal({ preferences, onPreferencesChange, onKeymapParsed, onClose }: Props) {
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
