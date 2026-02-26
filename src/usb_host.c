/*
 * PIO USB Host の初期化とコールバック。
 * Core1 上で動作し、GP0 (D+) / GP1 (D-) に接続された
 * USB デバイスの列挙・mount/unmount を処理する。
 */

#include "tusb.h"
#include "pio_usb.h"
#include "pico/multicore.h"

#include "usb_host.h"

/*
 * Core1 のエントリポイント。
 * PIO USB Host の SOF (Start of Frame) 割り込みは初期化したコアで処理されるため、
 * tuh_configure() / tuh_init() を Core1 で呼ぶ必要がある。
 */
void core1_main(void)
{
  sleep_ms(10);

  /* GP0 = D+, GP1 = D- (PIO_USB_DEFAULT_CONFIG の pin_dp デフォルトは 0) */
  pio_usb_configuration_t pio_cfg = PIO_USB_DEFAULT_CONFIG;
  tuh_configure(1, TUH_CFGID_RPI_PIO_USB_CONFIGURATION, &pio_cfg);
  tuh_init(1);

  while (true) {
    tuh_task();
  }
}

/*
 * TinyUSB Host コールバック: デバイスが接続され列挙が完了した時に呼ばれる。
 * daddr はデバイスに割り当てられたアドレス (1〜)。
 */
void tuh_mount_cb(uint8_t daddr)
{
  uint16_t vid, pid;
  tuh_vid_pid_get(daddr, &vid, &pid);
  printf("[USB Host] Device mounted: addr=%u, VID=%04x, PID=%04x\n", daddr, vid, pid);
}

/*
 * TinyUSB Host コールバック: デバイスが切断された時に呼ばれる。
 */
void tuh_umount_cb(uint8_t daddr)
{
  printf("[USB Host] Device unmounted: addr=%u\n", daddr);
}
