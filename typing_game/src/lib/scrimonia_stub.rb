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
      elsif key.is_a?(Note)
        note_numbers = [key.number]
        note_names = [Note.name_for(key.number)]
        vel_min = nil
        vel_max = nil
        if key.velocity.is_a?(Range)
          vel_min = key.velocity.first
          vel_max = key.velocity.last
        end
      else
        next
      end

      type, extra_json = action_json_fields(value)
      next unless type

      entries << [note_numbers, note_names, vel_min, vel_max, type, extra_json]
    end
    @layers[name.to_s] = entries
  end

  # Action の型ごとに JSON の type と、type 固有フィールドの JSON 断片 (先頭に
  # カンマを含む) を返す。
  def action_json_fields(value)
    if value.is_a?(Action::Keycode)
      ["keycode", ',"hidCode":' + value.keycode.to_s]
    elsif value.is_a?(Action::Modifier)
      ["modifier", ',"hidCode":' + value.modifier.to_s]
    elsif value.is_a?(Note)
      # MIDI パススルー (例: passthrough_mapping[n] = n)。
      # hidCode フィールドに出力 MIDI ノート番号を流用する。
      ["midi", ',"hidCode":' + value.number.to_s]
    elsif value.is_a?(Action::Macro)
      ["macro", ',"text":"' + json_escape(value.text) + '"']
    elsif value.is_a?(Action::LayerChange)
      ["layer", ',"layerName":"' + json_escape(value.layer_name.to_s) + '","layerMode":"' + json_escape(value.mode.to_s) + '"']
    end
  end

  CONTROL_HEX_DIGITS = "0123456789abcdef"

  # " \ LF TAB CR は短縮形、他の C0 制御文字 (0x00-0x1F) は \u00XX でエスケープする。
  # 対象外のバイトは nil を返す。
  def escaped_json_char(byte)
    case byte
    when 0x22 then '\\"'
    when 0x5C then '\\\\'
    when 0x0A then '\\n'
    when 0x09 then '\\t'
    when 0x0D then '\\r'
    when 0x00..0x1F
      '\\u00' + CONTROL_HEX_DIGITS[(byte >> 4) & 0xF] + CONTROL_HEX_DIGITS[byte & 0xF]
    end
  end

  def json_escape(str)
    result = ""
    i = 0
    len = str.bytesize
    while i < len
      byte = str.getbyte(i)
      result += escaped_json_char(byte) || str[i]
      i += 1
    end
    result
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
          e[5] + '}'
      end
      layer_parts << '"' + json_escape(name) + '":[' + entry_strs.join(",") + ']'
    end
    json = "{" + layer_parts.join(",") + "}"
    JS.global.scrimoniaKeymapDataJson = json
  end
end
