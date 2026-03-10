#include "tusb.h"
#include "midi_output.h"

bool midi_output_note_on(uint8_t note, uint8_t velocity)
{
  if (!tud_midi_mounted()) return false;

  uint8_t msg[3] = { 0x90, note & 0x7F, velocity & 0x7F };
  return tud_midi_stream_write(0, msg, 3);
}

bool midi_output_note_off(uint8_t note, uint8_t velocity)
{
  if (!tud_midi_mounted()) return false;

  uint8_t msg[3] = { 0x80, note & 0x7F, velocity & 0x7F };
  return tud_midi_stream_write(0, msg, 3);
}
