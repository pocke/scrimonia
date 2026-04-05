/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Ha Thach (tinyusb.org)
 *
 * Modification Copyright (c) 2022 HASUMI Hitoshi
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
 * Based on picoruby-filesystem-fat/ports/rp2040/msc_disk.c but removes
 * the bsp/board.h dependency which is not available in midipico's build.
 */

#include <stdlib.h>
#include <string.h>
#include <tusb.h>

#include "ff.h"
#include "diskio.h"
#include "../../lib/picoruby/mrbgems/picoruby-filesystem-fat/ports/rp2040/disk.h"

#include <hardware/flash.h>
/* 4096 * 192 = 768 KiB */
#define MSC_SECTOR_SIZE     FLASH_SECTOR_SIZE
#define MSC_SECTOR_COUNT    FLASH_SECTOR_COUNT
int FLASH_disk_read(void *buff, int32_t sector, int count);
int FLASH_disk_write(const void *buff, int32_t sector, int count);
#define DISK_READ(buff, sector, count)    FLASH_disk_read(buff, sector, count)
#define DISK_WRITE(buff, sector, count)   FLASH_disk_write(buff, sector, count)

static bool ejected = false;

static bool
check_sector_count(uint32_t lba)
{
  if (lba >= MSC_SECTOR_COUNT) return false;
  return true;
}

void
tud_msc_inquiry_cb(uint8_t lun, uint8_t vendor_id[8], uint8_t product_id[16], uint8_t product_rev[4])
{
  const char vid[] = "midipico";
  const char pid[] = "midipico Drive";
  const char rev[] = "1.0";
  memcpy(vendor_id  , vid, strlen(vid));
  memcpy(product_id , pid, strlen(pid));
  memcpy(product_rev, rev, strlen(rev));
}

bool
tud_msc_test_unit_ready_cb(uint8_t lun)
{
  if (ejected) {
    tud_msc_set_sense(lun, SCSI_SENSE_NOT_READY, 0x3a, 0x00);
    return false;
  }
  return true;
}

void
tud_msc_capacity_cb(uint8_t lun, uint32_t* block_count, uint16_t* block_size)
{
  *block_count = MSC_SECTOR_COUNT;
  *block_size  = MSC_SECTOR_SIZE;
}

bool
tud_msc_start_stop_cb(uint8_t lun, uint8_t power_condition, bool start, bool load_eject)
{
  if (load_eject) {
    if (start) {
      /* load disk storage */
    } else {
      /* unload disk storage */
      ejected = true;
    }
  }
  return true;
}

int32_t
tud_msc_read10_cb(uint8_t lun, uint32_t lba, uint32_t offset, void* buffer, uint32_t bufsize)
{
  if (!check_sector_count(lba)) return -1;
  if (0 < offset || bufsize != MSC_SECTOR_SIZE) {
    printf("Failed in tud_msc_read10_cb()\n");
    printf("offset: %d, bufsize: %d\n", offset, bufsize);
    tud_task();
    abort();
  }
  DISK_READ(buffer, lba, 1);
  return MSC_SECTOR_SIZE;
}

bool
tud_msc_is_writable_cb(uint8_t lun)
{
  return true;
}

int32_t
tud_msc_write10_cb(uint8_t lun, uint32_t lba, uint32_t offset, uint8_t* buffer, uint32_t bufsize)
{
  if (!check_sector_count(lba)) return -1;
  if (0 < offset || bufsize != MSC_SECTOR_SIZE) {
    printf("Failed in tud_msc_write10_cb()\n");
    printf("offset: %d, bufsize: %d\n", offset, bufsize);
    tud_task();
    abort();
  }
  DISK_WRITE(buffer, lba, 1);
  return MSC_SECTOR_SIZE;
}

int32_t
tud_msc_scsi_cb(uint8_t lun, uint8_t const scsi_cmd[16], void* buffer, uint16_t bufsize)
{
  void const* response = NULL;
  int32_t resplen = 0;
  bool in_xfer = true;
  switch (scsi_cmd[0]) {
    case SCSI_CMD_PREVENT_ALLOW_MEDIUM_REMOVAL:
      resplen = 0;
      break;
    default:
      tud_msc_set_sense(lun, SCSI_SENSE_ILLEGAL_REQUEST, 0x20, 0x00);
      resplen = -1;
      break;
  }
  if (resplen > bufsize) resplen = bufsize;
  if (response && (resplen > 0)) {
    if (in_xfer) {
      memcpy(buffer, response, resplen);
    }
  }
  return resplen;
}
