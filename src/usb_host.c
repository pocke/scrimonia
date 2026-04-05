/*
 * PIO USB Host の初期化とコールバック。
 * Core1 上で動作し、GP0 (D+) / GP1 (D-) に接続された
 * USB デバイスの列挙・mount/unmount を処理する。
 */

#include "tusb.h"
#include "pio_usb.h"
#include "pico/multicore.h"
#include "hardware/gpio.h"

#include "usb_host.h"
#include "pio_usb_midi.h"

#define LED_PIN 25

/* デバッグ用: LED を n 回短く点滅させる */
static void blink_led(int n)
{
  for (int i = 0; i < n; i++) {
    gpio_put(LED_PIN, 1);
    sleep_ms(50);
    gpio_put(LED_PIN, 0);
    sleep_ms(50);
  }
}

/*
 * Core1 のエントリポイント。
 * PIO USB Host の SOF (Start of Frame) 割り込みは初期化したコアで処理されるため、
 * tuh_configure() / tuh_init() を Core1 で呼ぶ必要がある。
 */
void core1_main(void)
{
  sleep_ms(10);

  /*
   * Core0 からのフラッシュ書き込み時に XIP アクセス競合を防ぐ。
   * multicore_lockout_start_blocking() が呼ばれると、このコアは
   * RAM 上のスピンループに入り、フラッシュ操作完了まで待機する。
   */
  multicore_lockout_victim_init();

  gpio_init(LED_PIN);
  gpio_set_dir(LED_PIN, GPIO_OUT);

  /* GP0 = D+, GP1 = D- (PIO_USB_DEFAULT_CONFIG の pin_dp デフォルトは 0) */
  pio_usb_configuration_t pio_cfg = PIO_USB_DEFAULT_CONFIG;
  tuh_configure(1, TUH_CFGID_RPI_PIO_USB_CONFIGURATION, &pio_cfg);
  tuh_init(1);

  /* Core1 + PIO USB Host 初期化完了: 1回点滅 */
  blink_led(1);

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
  blink_led(2);

  uint16_t vid, pid;
  tuh_vid_pid_get(daddr, &vid, &pid);
  printf("[USB Host] Device mounted: addr=%u, VID=%04x, PID=%04x\n", daddr, vid, pid);

  pio_usb_midi_mount(daddr);
}

/*
 * TinyUSB Host コールバック: デバイスが切断された時に呼ばれる。
 */
void tuh_umount_cb(uint8_t daddr)
{
  blink_led(1);

  pio_usb_midi_umount(daddr);

  printf("[USB Host] Device unmounted: addr=%u\n", daddr);
}
