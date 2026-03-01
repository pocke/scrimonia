/* PicoRuby runtime: VM init, type definitions, picoruby_init_require() */
#include "picoruby.h"

#include <pico/stdlib.h>
#include <pico/multicore.h>
#include <tusb.h>
#include <hardware/clocks.h>

#include "usb_host.h"
#include "cdc_stdio.h"
#include "midi_host.h"
#include "hid_keyboard.h"
#include "main_task.c"

#define HEAP_SIZE (1024 * 194)
static uint8_t heap_pool[HEAP_SIZE];

int
main(void)
{
  /*
   * PIO USB は 12MHz の倍数のクロックが必要。
   * デフォルトの 125MHz では USB の bit timing が合わない。
   */
  set_sys_clock_khz(120000, true);
  sleep_ms(10);

  /* Core1 で PIO USB Host を起動 (tuh_init は Core1 で呼ぶ必要がある) */
  multicore_reset_core1();
  multicore_launch_core1(core1_main);

  /*
   * pico_stdio_usb と pico_stdio_uart は CMake で無効化済み。
   * stdio_usb: tusb_init() が Host も初期化し Core1 と競合するため。
   * stdio_uart: デフォルト UART0 (GP0/GP1) が PIO USB のピンと衝突するため。
   */
  stdio_init_all();
  cdc_stdio_init();

  /* CDC が PC 側で認識されるまで待つ (最大2秒) */
  for (int i = 0; i < 20 && !tud_cdc_connected(); i++) {
    sleep_ms(100);
  }
  printf("[Core0] midipico booted (clock=%luHz)\n", clock_get_hz(clk_sys));

  /*
   * MIDI → HID テストループ。
   * Note On を受信したら対応するキーを press、Note Off で release。
   * 動作確認後は Ruby VM 側に移行する。
   */
  printf("[Core0] Entering MIDI->HID loop\n");
  while (true) {
    tud_task();

    midi_event_t ev;
    while (midi_host_read_event(&ev)) {
      if (ev.status == 0x90) {
        uint8_t keycode = HID_KEY_A;
        hid_keyboard_send(0, &keycode, 1);
        printf("[HID] key press (note=%u)\n", ev.note);
      } else if (ev.status == 0x80) {
        hid_keyboard_release_all();
        printf("[HID] key release (note=%u)\n", ev.note);
      }
    }

    sleep_ms(1);
  }

  return 0;
}
