#ifndef CDC_STDIO_H_
#define CDC_STDIO_H_

/*
 * USB CDC stdio driver initialization.
 *
 * pico-sdk's built-in pico_stdio_usb calls tusb_init() internally,
 * which initializes BOTH the Device and Host USB stacks on the calling core.
 * Since PIO USB Host must be initialized on Core1 separately,
 * this custom driver calls tud_init(0) to initialize only the Device stack.
 *
 * Additionally, pico_stdio_uart defaults to GP0/GP1 which conflicts with
 * PIO USB D+/D- on those same pins, so both built-in stdio drivers
 * are disabled in CMakeLists.txt.
 */
void cdc_stdio_init(void);

#endif /* CDC_STDIO_H_ */
