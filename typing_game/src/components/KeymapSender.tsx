import { useState, useRef, useCallback } from 'react'
import { MidiPicoSerial, type UploadProgress } from '../lib/webSerial'

interface Props {
  rawKeymap: string | null
}

export function KeymapSender({ rawKeymap }: Props) {
  const serialRef = useRef(new MidiPicoSerial())
  const [connected, setConnected] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleConnect = useCallback(async () => {
    setError('')
    setMessage('')
    try {
      if (connected) {
        await serialRef.current.disconnect()
        setConnected(false)
        setMessage('切断しました')
      } else {
        await serialRef.current.connect()
        setConnected(true)
        setMessage('接続しました')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConnected(false)
    }
  }, [connected])

  const handleUpload = useCallback(async () => {
    if (!rawKeymap) return
    setError('')
    setMessage('')
    setProgress(null)
    setUploading(true)
    try {
      await serialRef.current.uploadFile(rawKeymap, setProgress)
      setMessage('送信完了! キーマップを再読み込みしました')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }, [rawKeymap])

  if (!MidiPicoSerial.isSupported()) {
    return (
      <div className="text-sm text-gray-500">
        WebSerial API は Chrome または Edge でのみ利用できます
      </div>
    )
  }

  const progressPercent = progress
    ? Math.round((progress.sentBytes / progress.totalBytes) * 100)
    : 0

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleConnect}
        disabled={uploading}
        className={`px-4 py-2 rounded text-sm ${
          connected
            ? 'bg-green-700 text-white hover:bg-green-600'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {connected ? '接続中' : 'デバイスに接続'}
      </button>

      <button
        onClick={handleUpload}
        disabled={!connected || !rawKeymap || uploading}
        className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? `送信中... ${progressPercent}%` : 'デバイスに送信'}
      </button>

      {message && <span className="text-sm text-green-400">{message}</span>}
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  )
}
