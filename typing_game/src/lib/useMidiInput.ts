import { useEffect, useState } from 'react'
import { PianoSynth } from './pianoSynth'

export type MidiConnectionStatus =
  | { kind: 'unsupported' }
  | { kind: 'requesting' }
  | { kind: 'denied'; message: string }
  | { kind: 'no-device' }
  | { kind: 'connected'; deviceNames: string[] }

export interface MidiInputState {
  status: MidiConnectionStatus
  /** 現在押下中の MIDI ノート番号 (打鍵フィードバック表示用)。 */
  activeNotes: number[]
}

/**
 * Web MIDI API から MIDI 入力を購読し、PianoSynth で音を鳴らす React フック。
 * 接続状態と「現在押下中のノート」を返す。アプリ全体で一度だけ呼ぶことを想定する。
 */
export function useMidiInput(): MidiInputState {
  const [status, setStatus] = useState<MidiConnectionStatus>(() =>
    typeof navigator.requestMIDIAccess === 'function'
      ? { kind: 'requesting' }
      : { kind: 'unsupported' },
  )
  const [activeNotes, setActiveNotes] = useState<number[]>([])

  useEffect(() => {
    if (typeof navigator.requestMIDIAccess !== 'function') return

    const synth = new PianoSynth()
    const activeSet = new Set<number>()
    const attached = new Set<MIDIInput>()
    let cancelled = false
    let access: MIDIAccess | null = null

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data || data.length < 3) return
      const command = data[0] & 0xf0
      const note = data[1]
      const velocity = data[2]
      let changed = false
      if (command === 0x90 && velocity > 0) {
        synth.noteOn(note, velocity)
        if (!activeSet.has(note)) {
          activeSet.add(note)
          changed = true
        }
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        synth.noteOff(note)
        if (activeSet.delete(note)) changed = true
      }
      if (changed) {
        setActiveNotes(Array.from(activeSet))
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

  return { status, activeNotes }
}
