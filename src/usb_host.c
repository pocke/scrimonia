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

#define LED_PIN 25

/* デバッグ用: LED を n 回素早く点滅させる */
static void blink_led(int n)
{
  for (int i = 0; i < n; i++) {
    gpio_put(LED_PIN, 1);
    sleep_ms(200);
    gpio_put(LED_PIN, 0);
    sleep_ms(200);
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
   * LED を Core1 からも制御してデバッグに使う。
   * Core0 の Ruby タスクも LED を使うが、デバッグ中は
   * この点滅パターンで Core1 動作を確認できる。
   */
  gpio_init(LED_PIN);
  gpio_set_dir(LED_PIN, GPIO_OUT);

  /* Core1 起動確認: 2回点滅 */
  blink_led(2);

  /* GP0 = D+, GP1 = D- (PIO_USB_DEFAULT_CONFIG の pin_dp デフォルトは 0) */
  pio_usb_configuration_t pio_cfg = PIO_USB_DEFAULT_CONFIG;
  tuh_configure(1, TUH_CFGID_RPI_PIO_USB_CONFIGURATION, &pio_cfg);
  tuh_init(1);

  /* tuh_init 成功確認: 3回点滅 */
  blink_led(3);

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
  /* mount 確認: 5回高速点滅 */
  blink_led(7);

  uint16_t vid, pid;
  tuh_vid_pid_get(daddr, &vid, &pid);
  printf("[USB Host] Device mounted: addr=%u, VID=%04x, PID=%04x\n", daddr, vid, pid);
}

/*
 * TinyUSB Host コールバック: デバイスが切断された時に呼ばれる。
 */
void tuh_umount_cb(uint8_t daddr)
{
  /* unmount 確認: 1回長い点灯 */
  gpio_put(LED_PIN, 1);
  sleep_ms(500);
  gpio_put(LED_PIN, 0);

  printf("[USB Host] Device unmounted: addr=%u\n", daddr);
}
