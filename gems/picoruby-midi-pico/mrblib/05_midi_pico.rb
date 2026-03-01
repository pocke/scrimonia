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
  def add_layer(name, mapping)
    converted = {}
    mapping.each do |key, value|
      note_number = key.is_a?(Note) ? key.number : key
      converted[note_number] = value
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
          action = layer[note]
          if action.is_a?(Action::Keycode)
            HidKeyboard.press(action.keycode)
          end
        elsif status == PioUsbMidi::NOTE_OFF || (status == PioUsbMidi::NOTE_ON && velocity == 0)
          HidKeyboard.release_all
        end
      end
      Machine.delay_ms 1
    end
  end
end
