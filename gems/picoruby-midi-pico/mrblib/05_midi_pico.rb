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

    # NOTE_OFF 時にベロシティ条件なしで正しいアクションを逆引きするため、
    # 押下中のノートとそのアクションを記録する
    pressed = {}
    modifier_state = 0

    loop do
      ev = PioUsbMidi.receive
      if ev
        status, note, velocity = ev
        if status == PioUsbMidi::NOTE_ON && velocity > 0
          print "NOTE_ON  #{Note.name_for(note)} velocity=#{velocity}\r\n"
          action = find_action(layer[note], velocity)
          pressed[note] = action
          if action.is_a?(Action::Modifier)
            modifier_state = modifier_state | action.modifier
            HidKeyboard.press(0, modifier_state)
          elsif action.is_a?(Action::Keycode)
            HidKeyboard.press(action.keycode, modifier_state)
          end
        elsif status == PioUsbMidi::NOTE_OFF || (status == PioUsbMidi::NOTE_ON && velocity == 0)
          print "NOTE_OFF #{Note.name_for(note)}\r\n"
          action = pressed.delete(note)
          if action.is_a?(Action::Modifier)
            modifier_state = modifier_state & ~action.modifier
          end
          # 修飾キーが残っていればそれだけ維持、なければ全解除
          if modifier_state > 0
            HidKeyboard.press(0, modifier_state)
          else
            HidKeyboard.release_all
          end
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
