#include <mrubyc.h>

/* MidiOutput.note_on(channel, note, velocity) */
static void
c_note_on(mrbc_vm *vm, mrbc_value *v, int argc)
{
  uint8_t channel  = (uint8_t)GET_INT_ARG(1);
  uint8_t note     = (uint8_t)GET_INT_ARG(2);
  uint8_t velocity = (uint8_t)GET_INT_ARG(3);
  bool ok = midi_output_note_on(channel, note, velocity);
  SET_BOOL_RETURN(ok);
}

/* MidiOutput.note_off(channel, note, velocity = 0) */
static void
c_note_off(mrbc_vm *vm, mrbc_value *v, int argc)
{
  uint8_t channel  = (uint8_t)GET_INT_ARG(1);
  uint8_t note     = (uint8_t)GET_INT_ARG(2);
  uint8_t velocity = (argc >= 3) ? (uint8_t)GET_INT_ARG(3) : 0;
  bool ok = midi_output_note_off(channel, note, velocity);
  SET_BOOL_RETURN(ok);
}

void
mrbc_midi_output_init(mrbc_vm *vm)
{
  mrbc_class *cls = mrbc_define_class(vm, "MidiOutput", mrbc_class_object);
  mrbc_define_method(vm, cls, "note_on", c_note_on);
  mrbc_define_method(vm, cls, "note_off", c_note_off);
}
