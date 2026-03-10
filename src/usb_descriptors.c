/*
 * TinyUSB device descriptors: CDC + HID + MIDI + MSC composite device.
 *
 * CDC provides hal_write/hal_getchar console I/O for picoruby-machine.
 * HID Keyboard sends keystrokes to the host PC.
 * MIDI streams note data to the host PC as a USB MIDI device.
 * MSC exposes flash FAT partition for keymap.rb file transfer.
 */

#include "tusb.h"

enum {
  ITF_NUM_CDC = 0,
  ITF_NUM_CDC_DATA,
  ITF_NUM_HID,
  ITF_NUM_MIDI,
  ITF_NUM_MIDI_STREAMING,
  ITF_NUM_MSC,
  ITF_NUM_TOTAL
};

/*
 * Device Descriptor.
 * class=MISC + IAD protocol は CDC を含む複合デバイスに必要。
 */
static tusb_desc_device_t const desc_device = {
  .bLength            = sizeof(tusb_desc_device_t),
  .bDescriptorType    = TUSB_DESC_DEVICE,
  .bcdUSB             = 0x0200,
  .bDeviceClass       = TUSB_CLASS_MISC,
  .bDeviceSubClass    = MISC_SUBCLASS_COMMON,
  .bDeviceProtocol    = MISC_PROTOCOL_IAD,
  .bMaxPacketSize0    = CFG_TUD_ENDPOINT0_SIZE,
  .idVendor           = 0xCafe,
  .idProduct          = 0x4005,
  .bcdDevice          = 0x0100,
  .iManufacturer      = 0x01,
  .iProduct           = 0x02,
  .iSerialNumber      = 0x03,
  .bNumConfigurations = 0x01
};

uint8_t const *tud_descriptor_device_cb(void) {
  return (uint8_t const *)&desc_device;
}

/* HID Report Descriptor: standard 6KRO keyboard */
static uint8_t const desc_hid_report[] = {
  TUD_HID_REPORT_DESC_KEYBOARD()
};

/* Configuration Descriptor: CDC + HID + MIDI + MSC */
#define CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_CDC_DESC_LEN + TUD_HID_DESC_LEN + TUD_MIDI_DESC_LEN + TUD_MSC_DESC_LEN)

#define EPNUM_CDC_NOTIF   0x81
#define EPNUM_CDC_OUT     0x02
#define EPNUM_CDC_IN      0x82
#define EPNUM_HID_IN      0x83
#define EPNUM_MIDI_OUT    0x04
#define EPNUM_MIDI_IN     0x84
#define EPNUM_MSC_OUT     0x05
#define EPNUM_MSC_IN      0x85

static uint8_t const desc_configuration[] = {
  TUD_CONFIG_DESCRIPTOR(1, ITF_NUM_TOTAL, 0, CONFIG_TOTAL_LEN, 0x00, 100),
  TUD_CDC_DESCRIPTOR(ITF_NUM_CDC, 4, EPNUM_CDC_NOTIF, 8, EPNUM_CDC_OUT, EPNUM_CDC_IN, 64),
  TUD_HID_DESCRIPTOR(ITF_NUM_HID, 5, HID_ITF_PROTOCOL_KEYBOARD,
                     sizeof(desc_hid_report), EPNUM_HID_IN,
                     CFG_TUD_HID_EP_BUFSIZE, 10),
  TUD_MIDI_DESCRIPTOR(ITF_NUM_MIDI, 6, EPNUM_MIDI_OUT, EPNUM_MIDI_IN, 64),
  TUD_MSC_DESCRIPTOR(ITF_NUM_MSC, 7, EPNUM_MSC_OUT, EPNUM_MSC_IN, 64),
};

uint8_t const *tud_descriptor_configuration_cb(uint8_t index) {
  (void)index;
  return desc_configuration;
}

/* String Descriptors */
static char const *string_desc_arr[] = {
  (const char[]){0x09, 0x04},  /* English */
  "midipico",                   /* Manufacturer */
  "midipico",                   /* Product */
  "000001",                     /* Serial */
  "midipico CDC",               /* CDC Interface */
  "midipico Keyboard",          /* HID Keyboard Interface */
  "midipico MIDI",              /* MIDI Interface */
  "midipico Storage",           /* MSC Interface */
};

static uint16_t _desc_str[32];

uint16_t const *tud_descriptor_string_cb(uint8_t index, uint16_t langid) {
  (void)langid;
  uint8_t chr_count;

  if (index == 0) {
    memcpy(&_desc_str[1], string_desc_arr[0], 2);
    chr_count = 1;
  } else {
    if (index >= sizeof(string_desc_arr) / sizeof(string_desc_arr[0])) return NULL;
    const char *str = string_desc_arr[index];
    chr_count = (uint8_t)strlen(str);
    if (chr_count > 31) chr_count = 31;
    for (uint8_t i = 0; i < chr_count; i++) {
      _desc_str[1 + i] = str[i];
    }
  }

  _desc_str[0] = (uint16_t)((TUSB_DESC_STRING << 8) | (2 * chr_count + 2));
  return _desc_str;
}

/*--------------------------------------------------------------------
 * HID Callbacks (required by TinyUSB when CFG_TUD_HID is enabled)
 *--------------------------------------------------------------------*/

uint8_t const *tud_hid_descriptor_report_cb(uint8_t instance) {
  (void)instance;
  return desc_hid_report;
}

uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id,
                               hid_report_type_t report_type,
                               uint8_t *buffer, uint16_t reqlen) {
  (void)instance; (void)report_id; (void)report_type;
  (void)buffer; (void)reqlen;
  return 0;
}

void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id,
                           hid_report_type_t report_type,
                           uint8_t const *buffer, uint16_t bufsize) {
  (void)instance; (void)report_id; (void)report_type;
  (void)buffer; (void)bufsize;
}
