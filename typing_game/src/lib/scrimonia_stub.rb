require 'js'

class Scrimonia
  def initialize
    @layers = {}
  end

  def add_layer(name, mapping)
    entries = []
    mapping.each do |key, value|
      if key.is_a?(Array)
        note_numbers = []
        note_names = []
        vel_min = nil
        vel_max = nil
        key.each do |k|
          if k.is_a?(Note)
            note_numbers << k.number
            note_names << Note.name_for(k.number)
            # 全ノートのベロシティが同じ場合のみ採用
            if k.velocity.is_a?(Range)
              if vel_min.nil?
                vel_min = k.velocity.first
                vel_max = k.velocity.last
              elsif vel_min != k.velocity.first || vel_max != k.velocity.last
                vel_min = nil
                vel_max = nil
              end
            end
          else
            note_numbers << k
            note_names << Note.name_for(k)
          end
        end
        if value.is_a?(Action::Keycode)
          entries << [note_numbers, note_names, vel_min, vel_max, "keycode", value.keycode]
        elsif value.is_a?(Action::Modifier)
          entries << [note_numbers, note_names, vel_min, vel_max, "modifier", value.modifier]
        end
      elsif key.is_a?(Note)
        note_numbers = [key.number]
        note_names = [Note.name_for(key.number)]
        vel_min = nil
        vel_max = nil
        if key.velocity.is_a?(Range)
          vel_min = key.velocity.first
          vel_max = key.velocity.last
        end
        if value.is_a?(Action::Keycode)
          entries << [note_numbers, note_names, vel_min, vel_max, "keycode", value.keycode]
        elsif value.is_a?(Action::Modifier)
          entries << [note_numbers, note_names, vel_min, vel_max, "modifier", value.modifier]
        end
      end
    end
    @layers[name.to_s] = entries
  end

  # JSON を手動で組み立てる（json gem の有無に依存しない）。
  # JS::Object#[]= は npm バイナリ (v0.9.6) で method_missing 経由になり
  # Hash/Array を直接渡せないため、JSON 文字列で受け渡す。
  def start!
    layer_parts = []
    @layers.each do |name, entries|
      entry_strs = []
      entries.each do |e|
        nums = "[" + e[0].map { |n| n.to_s }.join(",") + "]"
        names = "[" + e[1].map { |n| '"' + n + '"' }.join(",") + "]"
        vel = if e[2]
          "[" + e[2].to_s + "," + e[3].to_s + "]"
        else
          "null"
        end
        entry_strs << '{"noteNumbers":' + nums +
          ',"noteNames":' + names +
          ',"velocity":' + vel +
          ',"type":"' + e[4] + '"' +
          ',"hidCode":' + e[5].to_s + '}'
      end
      layer_parts << '"' + name + '":[' + entry_strs.join(",") + ']'
    end
    json = "{" + layer_parts.join(",") + "}"
    JS.global.scrimoniaKeymapDataJson = json
  end
end
