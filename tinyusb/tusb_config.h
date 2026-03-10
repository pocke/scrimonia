#ifndef _TUSB_CONFIG_H_
#define _TUSB_CONFIG_H_

#ifdef __cplusplus
 extern "C" {
#endif

/*--------------------------------------------------------------------
 * COMMON CONFIGURATION
 *
 * RHPort 0 (ネイティブ USB) = Device (CDC コンソール)
 * RHPort 1 (PIO USB)       = Host  (MIDI キーボード受信)
 *--------------------------------------------------------------------*/

#define CFG_TUSB_OS               OPT_OS_PICO

/*
 * RHPort モード定義。TinyUSB の tusb_option.h がこれを見て
 * TUD_OPT_RHPORT (=0) を自動定義する。
 * picoruby-machine の hal_init() が tud_init(TUD_OPT_RHPORT) で参照する。
 */
#define CFG_TUSB_RHPORT0_MODE     (OPT_MODE_DEVICE | OPT_MODE_FULL_SPEED)
#define CFG_TUSB_RHPORT1_MODE     (OPT_MODE_HOST | OPT_MODE_FULL_SPEED)

/* Device stack */
#define CFG_TUD_ENABLED           1

/* Host stack: PIO USB */
#define CFG_TUH_ENABLED           1
#define CFG_TUH_RPI_PIO_USB      1

#ifndef CFG_TUSB_MEM_SECTION
#define CFG_TUSB_MEM_SECTION
#endif

#ifndef CFG_TUSB_MEM_ALIGN
#define CFG_TUSB_MEM_ALIGN        __attribute__ ((aligned(4)))
#endif

/*--------------------------------------------------------------------
 * DEVICE CONFIGURATION (RHPort 0)
 * picoruby-machine の HAL (hal_write/hal_getchar) が CDC を使う
 *--------------------------------------------------------------------*/

#ifndef CFG_TUD_ENDPOINT0_SIZE
#define CFG_TUD_ENDPOINT0_SIZE    64
#endif

#define CFG_TUD_CDC               1
#define CFG_TUD_MSC               0
#define CFG_TUD_HID               1
#define CFG_TUD_MIDI              1
#define CFG_TUD_VENDOR            0

#define CFG_TUD_CDC_RX_BUFSIZE    256
#define CFG_TUD_CDC_TX_BUFSIZE    256

#define CFG_TUD_HID_EP_BUFSIZE    16

#define CFG_TUD_MIDI_RX_BUFSIZE   64
#define CFG_TUD_MIDI_TX_BUFSIZE   64

/*--------------------------------------------------------------------
 * HOST CONFIGURATION (RHPort 1 = PIO USB)
 * USB デバイスの列挙と MIDI データ受信に使う
 *--------------------------------------------------------------------*/

#define CFG_TUH_ENUMERATION_BUFSIZE 256

/* Hub サポートは不要 (MIDI キーボード直結) */
#define CFG_TUH_HUB                0
#define CFG_TUH_DEVICE_MAX         1
#define CFG_TUH_ENDPOINT_MAX       8

/* tuh_edpt_xfer() API を有効化。MIDI の生エンドポイント転送に必要 */
#define CFG_TUH_API_EDPT_XFER     1

#ifdef __cplusplus
 }
#endif

#endif /* _TUSB_CONFIG_H_ */
