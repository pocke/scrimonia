/*
 * Flash disk driver with multicore lockout support.
 *
 * Based on picoruby-filesystem-fat/ports/rp2040/flash_disk.c but adds
 * multicore_lockout_start/end_blocking() around flash erase/program
 * operations. Without this, Core1 (running PIO USB Host from flash via
 * XIP) would hang when Core0 erases or programs flash sectors.
 */

#include <stdlib.h>
#include <string.h>

#include "ff.h"
#include "diskio.h"

#include <hardware/sync.h>
#include <hardware/flash.h>
#include <pico/multicore.h>

#include "../../lib/picoruby/mrbgems/picoruby-filesystem-fat/ports/rp2040/disk.h"

static int
is_rp2040js() {
  const uint32_t* p = (const uint32_t*)(0x40000000 + 0x4);
  return (*p & 0x01000000) != 0;
}

static void
break_flash_range_program(uint32_t flash_offs, const uint8_t *data, size_t count) {
  asm("bkpt 27");
  return;
}

static void
custom_flash_range_program(uint32_t flash_offs, const uint8_t *data, size_t count) {
  if (is_rp2040js()) {
    break_flash_range_program(flash_offs, data, count);
  } else {
    flash_range_program(flash_offs, data, count);
  }
}

int
FLASH_disk_erase(void)
{
  multicore_lockout_start_blocking();
  uint32_t ints = save_and_disable_interrupts();
  flash_range_erase(
    (uint32_t)(FLASH_TARGET_OFFSET),
    (size_t)(FLASH_SECTOR_SIZE * FLASH_SECTOR_COUNT)
  );
  restore_interrupts(ints);
  multicore_lockout_end_blocking();
  return 0;
}

int
FLASH_disk_initialize(void)
{
  return 0;
}

int
FLASH_disk_status(void)
{
  return 0;
}

int
FLASH_disk_read(BYTE *buff, LBA_t sector, UINT count)
{
  memcpy(
    buff,
    (uint8_t*)(FLASH_MMAP_ADDR + sector * FLASH_SECTOR_SIZE),
    count * FLASH_SECTOR_SIZE
  );
  return 0;
}

int
FLASH_disk_write(const BYTE *buff, LBA_t sector, UINT count)
{
  multicore_lockout_start_blocking();
  uint32_t ints = save_and_disable_interrupts();
  flash_range_erase(
    (uint32_t)(FLASH_TARGET_OFFSET + sector * FLASH_SECTOR_SIZE),
    (size_t)(FLASH_SECTOR_SIZE * count)
  );
  custom_flash_range_program(
    (uint32_t)(FLASH_TARGET_OFFSET + sector * FLASH_SECTOR_SIZE),
    (const uint8_t *)buff,
    (size_t)(FLASH_SECTOR_SIZE * count)
  );
  restore_interrupts(ints);
  multicore_lockout_end_blocking();
  return 0;
}

DRESULT
FLASH_disk_ioctl(BYTE cmd, void *buff)
{
  switch (cmd) {
    case CTRL_SYNC:
      break;
    case GET_BLOCK_SIZE:
      *((DWORD *)buff) = (DWORD)(FLASH_SECTOR_SIZE / FLASH_SECTOR_SIZE);
      break;
    case CTRL_TRIM:
      return RES_ERROR;
    case GET_SECTOR_SIZE:
      *((WORD *)buff) = (WORD)FLASH_SECTOR_SIZE;
      break;
    case GET_SECTOR_COUNT:
      *((LBA_t *)buff) = (LBA_t)FLASH_SECTOR_COUNT;
      break;
    default :
      return RES_PARERR;
  }
  return RES_OK;
}


#if FF_MAX_SS == FF_MIN_SS
#define SS(fs)	((UINT)FF_MAX_SS)
#else
#define SS(fs)	((fs)->ssize)
#endif

static LBA_t clst2sect(FATFS* fs, DWORD clst)
{
	clst -= 2;
	if (clst >= fs->n_fatent - 2) return 0;
	return fs->database + (LBA_t)fs->csize * clst;
}

void
FILE_physical_address(FIL *fp, uint8_t **addr)
{
  FATFS *fs = fp->obj.fs;
  LBA_t sect;
  sect = clst2sect(fs, fp->obj.sclust);
  *addr = (uint8_t*)(FLASH_MMAP_ADDR + sect * FLASH_SECTOR_SIZE);
}

int
FILE_sector_size(void)
{
  return FLASH_SECTOR_SIZE;
}
