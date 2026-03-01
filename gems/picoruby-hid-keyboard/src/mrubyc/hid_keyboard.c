#include <mrubyc.h>

/*
 * HidKeyboard.press(keycode, modifier = 0)
 */
static void
c_press(mrbc_vm *vm, mrbc_value *v, int argc)
{
  uint8_t keycode  = (uint8_t)GET_INT_ARG(1);
  uint8_t modifier = (argc >= 2) ? (uint8_t)GET_INT_ARG(2) : 0;
  bool ok = hid_keyboard_send(modifier, &keycode, 1);
  SET_BOOL_RETURN(ok);
}

/*
 * HidKeyboard.release_all
 */
static void
c_release_all(mrbc_vm *vm, mrbc_value *v, int argc)
{
  bool ok = hid_keyboard_release_all();
  SET_BOOL_RETURN(ok);
}

void
mrbc_hid_keyboard_init(mrbc_vm *vm)
{
  mrbc_class *cls = mrbc_define_class(vm, "HidKeyboard", mrbc_class_object);
  mrbc_define_method(vm, cls, "press", c_press);
  mrbc_define_method(vm, cls, "release_all", c_release_all);
}
