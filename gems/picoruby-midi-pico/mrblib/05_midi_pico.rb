require 'machine'
require 'pio_usb_midi'
require 'hid_keyboard'

class MidiPico
  def initialize
    @layer_definitions = []
  end

  def add_layer(name, mapping)
    @layer_definitions << [name, mapping]
  end

  def start!
    Runner.new(@layer_definitions).run
  end
end
