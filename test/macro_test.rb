class MacroTest < Picotest::Test
  SHIFT = 0x80

  def code_for(char)
    Scrimonia::Action::Macro.hid_code_for(char.ord)
  end

  def test_lowercase_letters
    assert_equal 0x04, code_for("a")
    assert_equal 0x0D, code_for("j")
    assert_equal 0x1D, code_for("z")
  end

  def test_uppercase_letters
    assert_equal SHIFT | 0x04, code_for("A")
    assert_equal SHIFT | 0x0D, code_for("J")
    assert_equal SHIFT | 0x1D, code_for("Z")
  end

  def test_digits
    assert_equal 0x1E, code_for("1")
    assert_equal 0x26, code_for("9")
    assert_equal 0x27, code_for("0")
  end

  def test_shifted_digits
    assert_equal SHIFT | 0x1E, code_for("!")
    assert_equal SHIFT | 0x1F, code_for("@")
    assert_equal SHIFT | 0x20, code_for("#")
    assert_equal SHIFT | 0x21, code_for("$")
    assert_equal SHIFT | 0x22, code_for("%")
    assert_equal SHIFT | 0x23, code_for("^")
    assert_equal SHIFT | 0x24, code_for("&")
    assert_equal SHIFT | 0x25, code_for("*")
    assert_equal SHIFT | 0x26, code_for("(")
    assert_equal SHIFT | 0x27, code_for(")")
  end

  def test_symbols
    assert_equal 0x2C, code_for(" ")
    assert_equal 0x2D, code_for("-")
    assert_equal 0x2E, code_for("=")
    assert_equal 0x2F, code_for("[")
    assert_equal 0x30, code_for("]")
    assert_equal 0x31, code_for("\\")
    assert_equal 0x33, code_for(";")
    assert_equal 0x34, code_for("'")
    assert_equal 0x35, code_for("`")
    assert_equal 0x36, code_for(",")
    assert_equal 0x37, code_for(".")
    assert_equal 0x38, code_for("/")
  end

  def test_shifted_symbols
    assert_equal SHIFT | 0x2D, code_for("_")
    assert_equal SHIFT | 0x2E, code_for("+")
    assert_equal SHIFT | 0x2F, code_for("{")
    assert_equal SHIFT | 0x30, code_for("}")
    assert_equal SHIFT | 0x31, code_for("|")
    assert_equal SHIFT | 0x33, code_for(":")
    assert_equal SHIFT | 0x34, code_for("\"")
    assert_equal SHIFT | 0x35, code_for("~")
    assert_equal SHIFT | 0x36, code_for("<")
    assert_equal SHIFT | 0x37, code_for(">")
    assert_equal SHIFT | 0x38, code_for("?")
  end

  def test_control_characters
    assert_equal 0x28, code_for("\n")
    assert_equal 0x2B, code_for("\t")
  end

  def test_unsupported_bytes
    assert_nil code_for("\r")
    assert_nil code_for("\e")
    assert_nil Scrimonia::Action::Macro.hid_code_for(0x00)
    assert_nil Scrimonia::Action::Macro.hid_code_for(0x7F)
    # "あ" の UTF-8 先頭バイト
    assert_nil Scrimonia::Action::Macro.hid_code_for(0xE3)
  end

  # 変換表は KC_* とは独立に生のキーコードを持つため、両者がずれていないことを確かめる
  def test_agrees_with_keycode_constants
    kc = Scrimonia::Keycodes
    assert_equal kc::KC_A.keycode, code_for("a")
    assert_equal kc::KC_Z.keycode, code_for("z")
    assert_equal kc::KC_0.keycode, code_for("0")
    assert_equal kc::KC_9.keycode, code_for("9")
    assert_equal kc::KC_SPC.keycode, code_for(" ")
    assert_equal kc::KC_MINUS.keycode, code_for("-")
    assert_equal kc::KC_EQUAL.keycode, code_for("=")
    assert_equal kc::KC_LBRC.keycode, code_for("[")
    assert_equal kc::KC_RBRC.keycode, code_for("]")
    assert_equal kc::KC_BSLS.keycode, code_for("\\")
    assert_equal kc::KC_SCLN.keycode, code_for(";")
    assert_equal kc::KC_QUOT.keycode, code_for("'")
    assert_equal kc::KC_GRV.keycode, code_for("`")
    assert_equal kc::KC_COMM.keycode, code_for(",")
    assert_equal kc::KC_DOT.keycode, code_for(".")
    assert_equal kc::KC_SLSH.keycode, code_for("/")
    assert_equal kc::KC_ENTER.keycode, code_for("\n")
    assert_equal kc::KC_TAB.keycode, code_for("\t")
    assert_equal SHIFT | kc::KC_1.keycode, code_for("!")
  end

  def test_new_keeps_text
    assert_equal "Hello, world!", Scrimonia::Action::Macro.new("Hello, world!").text
  end

  def test_new_accepts_carriage_return
    assert_equal "a\r\nb", Scrimonia::Action::Macro.new("a\r\nb").text
  end

  def test_new_rejects_unsupported_character
    assert_raise(ArgumentError) { Scrimonia::Action::Macro.new("あ") }
    assert_raise(ArgumentError) { Scrimonia::Action::Macro.new("ok\e[0m") }
  end
end
