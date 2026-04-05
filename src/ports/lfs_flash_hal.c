/*
 * The MIT License (MIT)
 *
 * Copyright (c) HASUMI Hitoshi
 * Modification Copyright (c) 2026 Masataka Pocke Kuwabara
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Based on picoruby-littlefs/ports/rp2040/flash_hal.c but adds
 * multicore_lockout_start/end_blocking() around flash erase/program
 * operations. Without this, Core1 (running PIO USB Host from flash via
 * XIP) would hang when Core0 erases or programs flash sectors.
 */

#include <string.h>
#include <hardware/sync.h>
#include <hardware/flash.h>
#include <pico/multicore.h>

#include "../../lib/picoruby/mrbgems/picoruby-littlefs/lib/littlefs/lfs.h"
#include "../../lib/picoruby/mrbgems/picoruby-littlefs/include/littlefs.h"

#if !defined(LFS_FLASH_TARGET_OFFSET)
  #if defined(PICO_RP2040)
    #define LFS_FLASH_TARGET_OFFSET  0x00180000
  #elif defined(PICO_RP2350)
    #define LFS_FLASH_TARGET_OFFSET  0x00380000
  #endif
#endif

#define LFS_FLASH_MMAP_ADDR    (XIP_BASE + LFS_FLASH_TARGET_OFFSET)
#define LFS_FLASH_BLOCK_SIZE   4096  /* == FLASH_SECTOR_SIZE */
#define LFS_FLASH_BLOCK_COUNT  128   /* 512 KB */

static int
lfs_flash_read(const struct lfs_config *c, lfs_block_t block,
               lfs_off_t off, void *buffer, lfs_size_t size)
{
  memcpy(buffer,
         (uint8_t *)(LFS_FLASH_MMAP_ADDR + block * c->block_size + off),
         size);
  return LFS_ERR_OK;
}

static int
lfs_flash_prog(const struct lfs_config *c, lfs_block_t block,
               lfs_off_t off, const void *buffer, lfs_size_t size)
{
  uint32_t addr = LFS_FLASH_TARGET_OFFSET + block * c->block_size + off;
  multicore_lockout_start_blocking();
  uint32_t ints = save_and_disable_interrupts();
  flash_range_program(addr, (const uint8_t *)buffer, size);
  restore_interrupts(ints);
  multicore_lockout_end_blocking();
  return LFS_ERR_OK;
}

static int
lfs_flash_erase(const struct lfs_config *c, lfs_block_t block)
{
  uint32_t addr = LFS_FLASH_TARGET_OFFSET + block * c->block_size;
  multicore_lockout_start_blocking();
  uint32_t ints = save_and_disable_interrupts();
  flash_range_erase(addr, c->block_size);
  restore_interrupts(ints);
  multicore_lockout_end_blocking();
  return LFS_ERR_OK;
}

static int
lfs_flash_sync(const struct lfs_config *c)
{
  (void)c;
  return LFS_ERR_OK;
}

void
littlefs_hal_init_config(struct lfs_config *cfg)
{
  memset(cfg, 0, sizeof(struct lfs_config));
  cfg->read  = lfs_flash_read;
  cfg->prog  = lfs_flash_prog;
  cfg->erase = lfs_flash_erase;
  cfg->sync  = lfs_flash_sync;

  cfg->read_size      = FLASH_PAGE_SIZE;   /* 256 */
  cfg->prog_size      = FLASH_PAGE_SIZE;   /* 256 */
  cfg->block_size     = LFS_FLASH_BLOCK_SIZE;
  cfg->block_count    = LFS_FLASH_BLOCK_COUNT;
  cfg->block_cycles   = 500;
  cfg->cache_size     = FLASH_PAGE_SIZE;   /* 256 */
  cfg->lookahead_size = 16;
}

void
littlefs_hal_erase_all(void)
{
  multicore_lockout_start_blocking();
  uint32_t ints = save_and_disable_interrupts();
  flash_range_erase(
    (uint32_t)LFS_FLASH_TARGET_OFFSET,
    (size_t)(LFS_FLASH_BLOCK_SIZE * LFS_FLASH_BLOCK_COUNT)
  );
  restore_interrupts(ints);
  multicore_lockout_end_blocking();
}
