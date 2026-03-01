#include "tusb.h"
#include "hid_keyboard.h"

#include <string.h>

bool hid_keyboard_send(uint8_t modifier, const uint8_t *keycodes, uint8_t count)
{
  if (!tud_hid_ready()) return false;

  uint8_t keys[6] = {0};
  if (count > 6) count = 6;
  if (count > 0) memcpy(keys, keycodes, count);

  return tud_hid_keyboard_report(0, modifier, keys);
}

bool hid_keyboard_release_all(void)
{
  if (!tud_hid_ready()) return false;
  return tud_hid_keyboard_report(0, 0, NULL);
}
