require 'machine'
require 'pio_usb_midi'
require 'hid_keyboard'
require 'midi_output'

class MidiPico
  def initialize
    @layer_definitions = []
  end

  def add_layer(name, mapping)
    @layer_definitions << [name, normalize_mapping(mapping)]
  end

  def start!
    Runner.new(@layer_definitions).run
  end

  private

  # Note をアクション値として使った場合に Action::MidiNote に変換する。
  # `C2 => C2` のような記述で MIDI パススルーを実現する。
  def normalize_mapping(mapping)
    normalized = {}
    mapping.each do |key, value|
      if value.is_a?(Note)
        normalized[key] = Action::MidiNote.new(value.number)
      else
        normalized[key] = value
      end
    end
    normalized
  end
end
