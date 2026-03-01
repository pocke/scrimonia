require 'machine'
require 'pio_usb_midi'
require 'hid_keyboard'

class MidiPico
  def initialize
    @layers = {}
  end

  # mruby/c の Hash はカスタムオブジェクトのキー比較にポインタ同一性を使うため、
  # Note オブジェクトをキーのまま保持すると実行時の lookup が機能しない。
  # ここで Note#number (Integer) をキーに変換して内部保持する。
  # 同一ノートに複数のベロシティ条件を持てるよう、各ノートは
  # [[velocity_range_or_nil, action], ...] の配列で管理する。
  def add_layer(name, mapping)
    converted = {}
    mapping.each do |key, value|
      if key.is_a?(Note)
        note_number = key.number
        vel = key.velocity
      else
        note_number = key
        vel = nil
      end
      converted[note_number] ||= []
      converted[note_number] << [vel, value]
    end
    @layers[name] = converted
  end

  def start!
    layer = @layers[:default]
    raise "No :default layer defined" unless layer

    loop do
      ev = PioUsbMidi.receive
      if ev
        status, note, velocity = ev
        if status == PioUsbMidi::NOTE_ON && velocity > 0
          puts "NOTE_ON  #{Note.name_for(note)} velocity=#{velocity}"
          action = find_action(layer[note], velocity)
          if action.is_a?(Action::Keycode)
            HidKeyboard.press(action.keycode)
          end
        elsif status == PioUsbMidi::NOTE_OFF || (status == PioUsbMidi::NOTE_ON && velocity == 0)
          puts "NOTE_OFF #{Note.name_for(note)}"
          HidKeyboard.release_all
        end
      end
      Machine.delay_ms 1
    end
  end

  # ベロシティ条件付きエントリを優先し、マッチしなければ条件なしにフォールバック
  def find_action(entries, velocity)
    return nil unless entries
    default_action = nil
    entries.each do |entry|
      if entry[0]
        return entry[1] if entry[0] === velocity
      else
        default_action = entry[1]
      end
    end
    default_action
  end
end
