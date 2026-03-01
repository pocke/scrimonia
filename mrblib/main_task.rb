require 'pio_usb_midi'
require 'hid_keyboard'

loop do
  ev = PioUsbMidi.receive
  if ev
    status, note, velocity = ev
    if status == PioUsbMidi::NOTE_ON && velocity > 0
      HidKeyboard.press(0x04)  # 'a'
    elsif status == PioUsbMidi::NOTE_OFF || (status == PioUsbMidi::NOTE_ON && velocity == 0)
      HidKeyboard.release_all
    end
  end
  Machine.delay_ms 1
end
