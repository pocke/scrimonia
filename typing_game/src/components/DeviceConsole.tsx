import { useEffect, useRef, useState } from 'react'

export interface DeviceLogLine {
  id: number
  text: string
}

interface Props {
  lines: DeviceLogLine[]
}

export function DeviceConsole({ lines }: Props) {
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, open])

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 flex items-center justify-between"
      >
        <span>デバイスログ ({lines.length})</span>
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div
          ref={scrollRef}
          className="p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-0.5"
        >
          {lines.length === 0 ? (
            <p className="text-gray-500">まだログはありません</p>
          ) : (
            lines.map(line => (
              <div key={line.id} className="text-gray-300 whitespace-pre-wrap break-all">
                {line.text}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
