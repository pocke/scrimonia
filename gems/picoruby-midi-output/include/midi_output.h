#ifndef MIDI_OUTPUT_DEFINED_H_
#define MIDI_OUTPUT_DEFINED_H_

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Send a MIDI Note On message via USB MIDI Device.
 * channel: MIDI channel (0-15)
 * note:    MIDI note number (0-127)
 * velocity: velocity (1-127)
 *
 * Returns true if the message was queued.
 */
bool midi_output_note_on(uint8_t channel, uint8_t note, uint8_t velocity);

/*
 * Send a MIDI Note Off message via USB MIDI Device.
 * channel: MIDI channel (0-15)
 * note:    MIDI note number (0-127)
 * velocity: release velocity (typically 0)
 *
 * Returns true if the message was queued.
 */
bool midi_output_note_off(uint8_t channel, uint8_t note, uint8_t velocity);

#ifdef __cplusplus
}
#endif

#endif /* MIDI_OUTPUT_DEFINED_H_ */
