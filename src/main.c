#include <picogem_init.c>

#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/clocks.h"

/* picoruby-require */
extern void picoruby_init_require(mrbc_vm *vm);

#include "main_task.c"

#define HEAP_SIZE (1024 * 194)
static uint8_t memory_pool[HEAP_SIZE];

int
main(void)
{
  stdio_init_all();

  mrbc_init(memory_pool, HEAP_SIZE);

  mrbc_vm *vm = mrbc_vm_open(NULL);
  picoruby_init_require(vm);

  mrbc_create_task(main_task, 0);
  mrbc_run();

  return 0;
}
