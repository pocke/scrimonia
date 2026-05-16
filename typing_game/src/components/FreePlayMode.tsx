import { useEffect, useRef, useState } from 'react'

interface Props {
  onActiveNotesChange: (notes: number[]) => void
}

type ConnectionStatus =
  | { kind: 'unsupported' }
  | { kind: 'requesting' }
  | { kind: 'denied'; message: string }
  | { kind: 'no-device' }
  | { kind: 'connected'; deviceNames: string[] }

export function FreePlayMode({ onActiveNotesChange }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    typeof navigator.requestMIDIAccess === 'function'
      ? { kind: 'requesting' }
      : { kind: 'unsupported' },
  )

  const onActiveNotesChangeRef = useRef(onActiveNotesChange)
  useEffect(() => {
    onActiveNotesChangeRef.current = onActiveNotesChange
  }, [onActiveNotesChange])

  useEffect(() => {
    if (typeof navigator.requestMIDIAccess !== 'function') return

    const activeNotes = new Set<number>()
    const attached = new Set<MIDIInput>()

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data || data.length < 3) return
      const command = data[0] & 0xf0
      const note = data[1]
      const velocity = data[2]
      let changed = false
      if (command === 0x90 && velocity > 0) {
        if (!activeNotes.has(note)) {
          activeNotes.add(note)
          changed = true
        }
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        if (activeNotes.delete(note)) changed = true
      }
      if (changed) {
        onActiveNotesChangeRef.current(Array.from(activeNotes))
      }
    }

    const refreshInputs = (midiAccess: MIDIAccess) => {
      const currentInputs = new Set(midiAccess.inputs.values())
      for (const input of attached) {
        if (!currentInputs.has(input)) {
          input.removeEventListener('midimessage', handleMidiMessage)
          attached.delete(input)
        }
      }
      for (const input of currentInputs) {
        if (!attached.has(input)) {
          input.addEventListener('midimessage', handleMidiMessage)
          attached.add(input)
        }
      }
      const names = Array.from(currentInputs, i => i.name ?? 'Unknown')
      setStatus(
        names.length === 0
          ? { kind: 'no-device' }
          : { kind: 'connected', deviceNames: names },
      )
    }

    navigator.requestMIDIAccess()
      .then(midiAccess => {
        refreshInputs(midiAccess)
        midiAccess.addEventListener('statechange', () => refreshInputs(midiAccess))
      })
      .catch(err => {
        setStatus({
          kind: 'denied',
          message: err instanceof Error ? err.message : String(err),
        })
      })

    return () => {
      for (const input of attached) {
        input.removeEventListener('midimessage', handleMidiMessage)
      }
      attached.clear()
      onActiveNotesChangeRef.current([])
    }
  }, [])

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-3">
      <p className="text-sm text-gray-400">
        MIDI 入力をそのまま画面に映すモード。MidiPico のパススルー出力や直接接続した MIDI キーボードを弾くと、上のピアノ鍵盤が光ります。
      </p>
      <StatusView status={status} />
    </div>
  )
}

function StatusView({ status }: { status: ConnectionStatus }) {
  switch (status.kind) {
    case 'unsupported':
      return (
        <p className="text-sm text-red-400">
          Web MIDI API は Chrome / Edge / Opera などでのみ利用できます
        </p>
      )
    case 'requesting':
      return <p className="text-sm text-gray-400">MIDI デバイスを検出中...</p>
    case 'denied':
      return (
        <p className="text-sm text-red-400">
          MIDI へのアクセスが拒否されました: {status.message}
        </p>
      )
    case 'no-device':
      return (
        <p className="text-sm text-yellow-400">
          MIDI デバイスが接続されていません
        </p>
      )
    case 'connected':
      return (
        <div className="text-sm">
          <span className="text-green-400">接続中:</span>
          <ul className="list-disc list-inside text-gray-300 mt-1">
            {status.deviceNames.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </div>
      )
  }
}
