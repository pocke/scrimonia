#include <mrubyc.h>

/* PioUsbMidi.receive -> [status, note, velocity] or nil */
static void
c_receive(mrbc_vm *vm, mrbc_value *v, int argc)
{
  midi_event_t ev;
  if (pio_usb_midi_read_event(&ev)) {
    mrbc_value ary = mrbc_array_new(vm, 3);
    mrbc_array_set(&ary, 0, &mrbc_integer_value(ev.status));
    mrbc_array_set(&ary, 1, &mrbc_integer_value(ev.note));
    mrbc_array_set(&ary, 2, &mrbc_integer_value(ev.velocity));
    SET_RETURN(ary);
  } else {
    SET_NIL_RETURN();
  }
}

void
mrbc_pio_usb_midi_init(mrbc_vm *vm)
{
  mrbc_class *cls = mrbc_define_class(vm, "PioUsbMidi", mrbc_class_object);
  mrbc_define_method(vm, cls, "receive", c_receive);

  mrbc_set_class_const(cls, mrbc_str_to_symid("NOTE_ON"),  &mrbc_integer_value(0x90));
  mrbc_set_class_const(cls, mrbc_str_to_symid("NOTE_OFF"), &mrbc_integer_value(0x80));
}
