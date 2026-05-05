import { useState, useCallback } from 'react'
import type { KeymapData } from '../types'
import { parseKeymap } from '../lib/keymapParser'

interface Props {
  onKeymapParsed: (data: KeymapData, rawContent: string) => void
}

export function KeymapUploader({ onKeymapParsed }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [fileName, setFileName] = useState('')

  const handleFile = useCallback(async (file: File) => {
    setStatus('loading')
    setErrorMessage('')
    setFileName(file.name)

    try {
      const content = await file.text()
      const data = await parseKeymap(content)
      onKeymapParsed(data, content)
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setErrorMessage(e instanceof Error ? e.message : String(e))
    }
  }, [onKeymapParsed])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
    >
      {status === 'loading' ? (
        <p className="text-gray-400">パース中...</p>
      ) : (
        <>
          <p className="text-gray-400 mb-4">
            keymap.rb をドラッグ&ドロップ、またはクリックして選択
          </p>
          <input
            type="file"
            accept=".rb"
            onChange={handleChange}
            className="block mx-auto text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-500"
          />
          {fileName && status !== 'error' && (
            <p className="mt-2 text-sm text-green-400">{fileName} を読み込みました</p>
          )}
        </>
      )}
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
      )}
    </div>
  )
}
