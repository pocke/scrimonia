import type { KeymapData } from '../types'
import { hidCodeToChar } from '../lib/hidKeycodes'

interface Props {
  keymap: KeymapData
}

export function KeymapView({ keymap }: Props) {
  return (
    <div className="space-y-6">
      {Object.entries(keymap).map(([layerName, entries]) => (
        <div key={layerName}>
          <h3 className="text-lg font-semibold mb-3">Layer: {layerName}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                <tr>
                  <th className="px-4 py-2">Note</th>
                  <th className="px-4 py-2">Velocity</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Output</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-700">
                    <td className="px-4 py-2 font-mono">{entry.noteName}</td>
                    <td className="px-4 py-2">
                      {entry.velocity
                        ? `${entry.velocity[0]}..${entry.velocity[1]}`
                        : 'any'}
                    </td>
                    <td className="px-4 py-2">{entry.type}</td>
                    <td className="px-4 py-2 font-mono font-bold">
                      {hidCodeToChar(entry.hidCode, entry.type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
