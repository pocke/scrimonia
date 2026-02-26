/* PicoRuby runtime: VM init, type definitions, picoruby_init_require() */
#include "picoruby.h"

#include <pico/stdlib.h>
#include <bsp/board.h>
#include <tusb.h>

#include "main_task.c"

#define HEAP_SIZE (1024 * 194)
static uint8_t heap_pool[HEAP_SIZE];

int
main(void)
{
  stdio_init_all();
  board_init();

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
