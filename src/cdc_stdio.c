/*
 * USB CDC stdio driver — Device stack only.
 *
 * pico-sdk's pico_stdio_usb calls tusb_init() which initializes both
 * Device and Host stacks on the calling core. This project runs
 * PIO USB Host on Core1, so the Host stack must NOT be initialized
 * on Core0. This module replaces pico_stdio_usb by calling only
 * tud_init(0) and registering a stdio driver for CDC output.
 */

#include "pico/stdio/driver.h"
#include "pico/time.h"
#include "tusb.h"

#include "cdc_stdio.h"

static void cdc_out_chars(const char *buf, int length)
{
  if (!tud_cdc_connected()) return;

  int pos = 0;
  while (pos < length) {
    int n = (int)tud_cdc_write(buf + pos, (uint32_t)(length - pos));
    if (n == 0) break;   /* buffer full — drop remaining to avoid blocking */
    pos += n;
  }
  tud_cdc_write_flush();
}

static int cdc_in_chars(char *buf, int length)
{
  if (!tud_cdc_connected() || !tud_cdc_available())
    return PICO_ERROR_NO_DATA;
  return (int)tud_cdc_read(buf, (uint32_t)length);
}

static stdio_driver_t cdc_driver = {
  .out_chars = cdc_out_chars,
  .in_chars  = cdc_in_chars,
#if PICO_STDIO_ENABLE_CRLF_SUPPORT
  .crlf_enabled = PICO_STDIO_DEFAULT_CRLF,
#endif
};

static bool tud_task_timer_cb(struct repeating_timer *t)
{
  (void)t;
  tud_task();
  return true;
}

void cdc_stdio_init(void)
{
  /* Device stack only (NOT tusb_init which also initializes Host) */
  tud_init(0);

  /* 1 ms periodic timer for USB device processing, same as pico_stdio_usb */
  static struct repeating_timer timer;
  add_repeating_timer_ms(-1, tud_task_timer_cb, NULL, &timer);

  stdio_set_driver_enabled(&cdc_driver, true);
}
