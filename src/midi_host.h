#ifndef MIDI_HOST_H_
#define MIDI_HOST_H_

#include <stdint.h>
#include <stdbool.h>

typedef struct {
  uint8_t status;   /* 0x90 = Note On, 0x80 = Note Off */
  uint8_t note;     /* MIDI note number (0-127) */
  uint8_t velocity; /* Velocity (0-127) */
} midi_event_t;

#define MIDI_EVENT_BUF_SIZE 64

/*
 * Called from tuh_mount_cb after device enumeration.
 * Requests the configuration descriptor and searches for
 * a MIDIStreaming Bulk IN endpoint to start receiving MIDI data.
 */
void midi_host_mount(uint8_t daddr);

/* Called from tuh_umount_cb to stop reception and reset state. */
void midi_host_umount(uint8_t daddr);

/*
 * Pop the next MIDI event from the ring buffer.
 * Thread-safe for single-producer (Core1) / single-consumer (Core0).
 * Returns false if the buffer is empty.
 */
bool midi_host_read_event(midi_event_t *event);

#endif /* MIDI_HOST_H_ */
