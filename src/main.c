/* PicoRuby runtime: VM init, type definitions, picoruby_init_require() */
#include "picoruby.h"

#include <pico/stdlib.h>
#include <pico/multicore.h>
#include <tusb.h>
#include <hardware/clocks.h>

#include "usb_host.h"
#include "cdc_stdio.h"
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

  /* mruby/c VM */
  mrbc_init(heap_pool, HEAP_SIZE);
  mrbc_tcb *tcb = mrbc_create_task(main_task, 0);
  if (!tcb) {
    const char *msg = "mrbc_create_task failed\n";
    hal_write(1, msg, strlen(msg));
    return 1;
  }
  mrbc_set_task_name(tcb, "main_task");
  picoruby_init_require(&tcb->vm);

  mrbc_run();

  return 0;
}
