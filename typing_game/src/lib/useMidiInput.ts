import { useEffect, useState } from 'react'
import { PianoSynth } from './pianoSynth'

export type MidiConnectionStatus =
  | { kind: 'unsupported' }
  | { kind: 'requesting' }
  | { kind: 'denied'; message: string }
  | { kind: 'no-device' }
  | { kind: 'connected'; deviceNames: string[] }

/**
 * Web MIDI API から MIDI 入力を購読し、PianoSynth で音を鳴らす React フック。
 * 戻り値は MIDI 接続状態 (UI 表示用)。アプリ全体で一度だけ呼ぶことを想定する。
 */
export function useMidiInput(): MidiConnectionStatus {
  const [status, setStatus] = useState<MidiConnectionStatus>(() =>
    typeof navigator.requestMIDIAccess === 'function'
      ? { kind: 'requesting' }
      : { kind: 'unsupported' },
  )

  useEffect(() => {
    if (typeof navigator.requestMIDIAccess !== 'function') return

    const synth = new PianoSynth()
    const attached = new Set<MIDIInput>()
    let cancelled = false
    let access: MIDIAccess | null = null

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data || data.length < 3) return
      const command = data[0] & 0xf0
      const note = data[1]
      const velocity = data[2]
      if (command === 0x90 && velocity > 0) {
        synth.noteOn(note, velocity)
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        synth.noteOff(note)
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

    const handleStateChange = () => {
      if (access) refreshInputs(access)
    }

    navigator.requestMIDIAccess()
      .then(midiAccess => {
        if (cancelled) return
        access = midiAccess
        refreshInputs(midiAccess)
        midiAccess.addEventListener('statechange', handleStateChange)
      })
      .catch(err => {
        if (cancelled) return
        setStatus({
          kind: 'denied',
          message: err instanceof Error ? err.message : String(err),
        })
      })

    return () => {
      cancelled = true
      access?.removeEventListener('statechange', handleStateChange)
      for (const input of attached) {
        input.removeEventListener('midimessage', handleMidiMessage)
      }
      attached.clear()
      synth.destroy()
    }
  }, [])

  return status
}
