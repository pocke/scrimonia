/* PicoRuby runtime: VM init, type definitions, picoruby_init_require() */
#include "picoruby.h"

#include <pico/stdlib.h>
#include <pico/multicore.h>
#include <tusb.h>
#include <hardware/clocks.h>
#include <pico/runtime_init.h>

#include "usb_host.h"
#include "cdc_stdio.h"
#include "main_task.c"

#define HEAP_SIZE (1024 * 178)
static uint8_t heap_pool[HEAP_SIZE];

/*
 * 既定の Core0 のスタックは SCRATCH_Y に収まる 4KB までで、keymap のコンパイル
 * には足りない (#79)。
 */
#define CORE0_STACK_SIZE (1024 * 16)
__attribute__((used, aligned(8)))
static uint32_t core0_stack[CORE0_STACK_SIZE / sizeof(uint32_t)];

/* SCRATCH_Y にコードやデータが置かれていないことを core0_main で確かめる */
extern uint32_t __scratch_x_end__[];
extern uint32_t __scratch_y_start__[];
extern uint32_t __scratch_y_end__[];
extern uint32_t __StackTop[];
#define CORE1_STACK_BOTTOM __scratch_x_end__
#define CORE1_STACK_SIZE ((size_t)((uintptr_t)__StackTop - (uintptr_t)__scratch_x_end__))

static void __attribute__((used, noreturn, noinline)) core0_main(void)
{
  runtime_init_per_core_install_stack_guard(core0_stack);
  if (__scratch_y_start__ != __scratch_y_end__) __breakpoint();

  /*
   * PIO USB は 12MHz の倍数のクロックが必要。
   * デフォルトの 125MHz では USB の bit timing が合わない。
   */
  set_sys_clock_khz(120000, true);
  sleep_ms(10);

  /* Core1 で PIO USB Host を起動 (tuh_init は Core1 で呼ぶ必要がある) */
  multicore_reset_core1();
  multicore_launch_core1_with_stack(core1_main, CORE1_STACK_BOTTOM, CORE1_STACK_SIZE);

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
  printf("[Core0] scrimonia booted (clock=%luHz)\n", clock_get_hz(clk_sys));

  /* mruby/c VM */
  mrbc_init(heap_pool, HEAP_SIZE);
  mrbc_tcb *tcb = mrbc_create_task(main_task, 0);
  if (!tcb) {
    const char *msg = "mrbc_create_task failed\n";
    hal_write(1, msg, strlen(msg));
    for (;;) tight_loop_contents();
  }
  mrbc_set_task_name(tcb, "main_task");
  picoruby_init_require(&tcb->vm);

  mrbc_run();

  for (;;) tight_loop_contents();
}

/*
 * 旧スタック上の main のフレームは Core1 のスタックとして上書きされるので、
 * naked にして sp の切り替えと分岐を 1 つの asm に収め、フレームを作らない。
 */
int __attribute__((naked))
main(void)
{
  __asm volatile (
    "ldr r0, =core0_stack + %c0\n\t"
    "msr msp, r0\n\t"
    "isb\n\t"
    "b core0_main\n\t"
    ".ltorg"
    : : "i" (CORE0_STACK_SIZE));
}
