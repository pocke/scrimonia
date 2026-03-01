#ifndef HID_KEYBOARD_H_
#define HID_KEYBOARD_H_

#include <stdint.h>
#include <stdbool.h>

/*
 * Send a keyboard report via USB HID.
 * modifier: bitmask of KEYBOARD_MODIFIER_* (Shift, Ctrl, Alt, etc.)
 * keycodes: array of HID usage codes (max 6)
 * count:    number of entries in keycodes (0-6)
 *
 * Returns true if the report was queued.
 */
bool hid_keyboard_send(uint8_t modifier, const uint8_t *keycodes, uint8_t count);

/* Release all keys (send an empty report). */
bool hid_keyboard_release_all(void);

#endif /* HID_KEYBOARD_H_ */
