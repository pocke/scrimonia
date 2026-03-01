/*
 * USB MIDI Host — raw endpoint transfer による MIDI 受信。
 *
 * TinyUSB 0.18.0 には MIDI Host クラスドライバがないため、
 * tuh_edpt_xfer() で Bulk IN エンドポイントから直接読み取る。
 *
 * 受信した USB MIDI パケット (4 bytes) をパースして Note On/Off を
 * リングバッファに格納する。リングバッファは Core1 (USB Host) が
 * 書き込み、Core0 (Ruby VM) が読み出す single-producer/single-consumer。
 */

#include <stdio.h>
#include "tusb.h"

#include "pio_usb_midi.h"

/* USB Audio class, MIDIStreaming subclass */
#define AUDIO_SUBCLASS_MIDI_STREAMING 0x03

/* USB MIDI event packet: cable/CIN (1) + MIDI bytes (3) */
#define USB_MIDI_PACKET_SIZE 4

#define RX_BUF_SIZE 64
static uint8_t rx_buf[RX_BUF_SIZE] __attribute__((aligned(4)));

/* Configuration descriptor parsing buffer */
static uint8_t config_buf[256];

/* Active MIDI device */
static uint8_t midi_daddr;
static uint8_t midi_ep_in;
static uint8_t midi_itf_num;

/* Ring buffer */
static midi_event_t event_buf[MIDI_EVENT_BUF_SIZE];
static volatile uint8_t ev_head;  /* Core1 writes */
static volatile uint8_t ev_tail;  /* Core0 writes */

static void parse_config_descriptor(tuh_xfer_t *xfer);
static void set_interface_cb(tuh_xfer_t *xfer);
static void midi_rx_cb(tuh_xfer_t *xfer);

void pio_usb_midi_mount(uint8_t daddr)
{
  midi_daddr = daddr;
  tuh_descriptor_get_configuration(daddr, 0,
      config_buf, sizeof(config_buf),
      parse_config_descriptor, 0);
}

void pio_usb_midi_umount(uint8_t daddr)
{
  if (midi_daddr == daddr) {
    midi_daddr = 0;
    midi_ep_in = 0;
    midi_itf_num = 0;
  }
}

/*
 * Configuration descriptor を走査して MIDIStreaming インターフェースの
 * Bulk IN エンドポイントを探す。
 *
 * エンドポイントが見つかったら SET_INTERFACE を送信してインターフェースを
 * アクティベートする。USB Audio クラスではホストが SET_INTERFACE を発行する
 * までデバイスがデータを送らない場合がある。
 */
static void parse_config_descriptor(tuh_xfer_t *xfer)
{
  if (xfer->result != XFER_RESULT_SUCCESS) return;

  tusb_desc_configuration_t const *cfg =
      (tusb_desc_configuration_t const *)config_buf;
  uint16_t total = cfg->wTotalLength;
  if (total > sizeof(config_buf)) total = sizeof(config_buf);

  bool in_midi = false;
  uint8_t const *p   = config_buf;
  uint8_t const *end = config_buf + total;

  while (p < end) {
    uint8_t len  = p[0];
    if (len == 0 || p + len > end) break;

    uint8_t type = p[1];

    if (type == TUSB_DESC_INTERFACE && len >= sizeof(tusb_desc_interface_t)) {
      tusb_desc_interface_t const *itf = (tusb_desc_interface_t const *)p;
      in_midi = (itf->bInterfaceClass == TUSB_CLASS_AUDIO &&
                 itf->bInterfaceSubClass == AUDIO_SUBCLASS_MIDI_STREAMING);
      if (in_midi) {
        midi_itf_num = itf->bInterfaceNumber;
      }
    }

    if (in_midi &&
        type == TUSB_DESC_ENDPOINT &&
        len >= sizeof(tusb_desc_endpoint_t)) {
      tusb_desc_endpoint_t const *ep = (tusb_desc_endpoint_t const *)p;

      if (tu_edpt_dir(ep->bEndpointAddress) == TUSB_DIR_IN) {
        midi_ep_in = ep->bEndpointAddress;

        if (!tuh_edpt_open(xfer->daddr, ep)) {
          midi_ep_in = 0;
          return;
        }

        /*
         * SET_INTERFACE を送ってインターフェースをアクティベートする。
         * これがないとデバイスが空データを返し続ける場合がある。
         */
        tuh_interface_set(xfer->daddr, midi_itf_num, 0,
                          set_interface_cb, 0);
        return;
      }
    }

    p += len;
  }
}

/*
 * SET_INTERFACE 完了後に受信を開始する。
 */
static void set_interface_cb(tuh_xfer_t *xfer)
{
  if (xfer->result != XFER_RESULT_SUCCESS) return;

  tuh_xfer_t rx = {
    .daddr       = midi_daddr,
    .ep_addr     = midi_ep_in,
    .buffer      = rx_buf,
    .buflen      = sizeof(rx_buf),
    .complete_cb = midi_rx_cb,
  };
  tuh_edpt_xfer(&rx);
}

static void push_event(uint8_t status, uint8_t data1, uint8_t data2)
{
  uint8_t next = (ev_head + 1) % MIDI_EVENT_BUF_SIZE;
  if (next == ev_tail) return;  /* full — drop */

  event_buf[ev_head] = (midi_event_t){
    .status   = status,
    .note     = data1,
    .velocity = data2,
  };
  ev_head = next;
}

/*
 * Bulk IN 転送完了コールバック (Core1)。
 *
 * USB MIDI パケットは常に 4 バイト:
 *   [cable<<4 | CIN] [status] [data1] [data2]
 *
 * Running Status は USB MIDI では発生しない。シリアル MIDI と異なり、
 * 各パケットに完全なステータスバイトが含まれる。
 */
static void midi_rx_cb(tuh_xfer_t *xfer)
{
  if (xfer->result == XFER_RESULT_SUCCESS && xfer->actual_len > 0) {
    for (uint32_t i = 0;
         i + USB_MIDI_PACKET_SIZE <= xfer->actual_len;
         i += USB_MIDI_PACKET_SIZE)
    {
      uint8_t const *pkt = &rx_buf[i];
      uint8_t cin    = pkt[0] & 0x0F;
      uint8_t status = pkt[1];
      uint8_t data1  = pkt[2];
      uint8_t data2  = pkt[3];

      if (cin == 0) continue;  /* empty slot */

      uint8_t msg = status & 0xF0;

      /* Note On with velocity 0 is semantically Note Off */
      if (msg == 0x90 && data2 == 0) msg = 0x80;

      if (msg == 0x90 || msg == 0x80) {
        push_event(msg, data1, data2);
      }
    }
  }

  /*
   * tuh_xfer_t の buffer/buflen はコールバック内では利用不可
   * (TinyUSB が非コントロール転送では保持しない) なので、
   * xfer を再利用せず新規に構築する。
   */
  if (midi_daddr) {
    tuh_xfer_t rx = {
      .daddr       = midi_daddr,
      .ep_addr     = midi_ep_in,
      .buffer      = rx_buf,
      .buflen      = sizeof(rx_buf),
      .complete_cb = midi_rx_cb,
    };
    tuh_edpt_xfer(&rx);
  }
}

bool pio_usb_midi_read_event(midi_event_t *event)
{
  if (ev_head == ev_tail) return false;

  *event = event_buf[ev_tail];
  ev_tail = (ev_tail + 1) % MIDI_EVENT_BUF_SIZE;
  return true;
}
