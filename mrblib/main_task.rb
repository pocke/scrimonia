require 'midi_pico'

include MidiPico::Notes
include MidiPico::Keycodes

mp = MidiPico.new

mp.add_layer :default, {
  C4 => KC_A,
  D4 => KC_S,
  E4 => KC_D,
  F4 => KC_F,
  G4 => KC_G,
  A4 => KC_H,
  B4 => KC_J,
}

mp.start!
