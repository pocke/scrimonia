#include "tusb.h"
#include "midi_output.h"

bool midi_output_note_on(uint8_t channel, uint8_t note, uint8_t velocity)
{
  if (!tud_midi_mounted()) return false;

  /* USB MIDI packet: cable 0, Note On */
  uint8_t msg[3] = { (uint8_t)(0x90 | (channel & 0x0F)), note & 0x7F, velocity & 0x7F };
  return tud_midi_stream_write(0, msg, 3);
}

bool midi_output_note_off(uint8_t channel, uint8_t note, uint8_t velocity)
{
  if (!tud_midi_mounted()) return false;

  /* USB MIDI packet: cable 0, Note Off */
  uint8_t msg[3] = { (uint8_t)(0x80 | (channel & 0x0F)), note & 0x7F, velocity & 0x7F };
  return tud_midi_stream_write(0, msg, 3);
}
