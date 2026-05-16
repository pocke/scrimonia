export type DeviceMessage =
  | { type: 'layer_change'; layer: string }
  | { type: 'note_on'; note: number; name: string; velocity: number }
  | { type: 'note_off'; note: number; name: string }

export function parseDeviceMessage(line: string): DeviceMessage | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{')) return null
  let obj: unknown
  try {
    obj = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>

  switch (o.type) {
    case 'layer_change':
      return typeof o.layer === 'string'
        ? { type: 'layer_change', layer: o.layer }
        : null
    case 'note_on':
      return typeof o.note === 'number' &&
        typeof o.name === 'string' &&
        typeof o.velocity === 'number'
        ? { type: 'note_on', note: o.note, name: o.name, velocity: o.velocity }
        : null
    case 'note_off':
      return typeof o.note === 'number' && typeof o.name === 'string'
        ? { type: 'note_off', note: o.note, name: o.name }
        : null
    default:
      return null
  }
}
