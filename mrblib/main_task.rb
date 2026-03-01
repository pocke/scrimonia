require 'pio_usb_midi'
require 'hid_keyboard'

midi = PioUsbMidi.new
kbd  = HidKeyboard.new

loop do
  ev = midi.receive
  if ev
    status, note, velocity = ev
    if status == PioUsbMidi::NOTE_ON && velocity > 0
      kbd.press(0x04)  # 'a'
    elsif status == PioUsbMidi::NOTE_OFF || (status == PioUsbMidi::NOTE_ON && velocity == 0)
      kbd.release_all
    end
  end
  Machine.delay_ms 1
end
