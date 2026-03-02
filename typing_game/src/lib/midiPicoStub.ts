// MidiPico gem の Ruby 定義 (01-04) + ブラウザ用スタブ (05) を
// PicoRuby.wasm で実行するための Ruby コードを生成する。
//
// ユーザーの keymap.rb をパースして、MIDI ノート → キーコードの
// マッピングデータを JavaScript 側に渡す。

const MIDI_PICO_NOTE = `
class MidiPico
  class Note
    NOTE_NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"]

    attr_reader :number, :velocity

    def initialize(number, velocity: nil)
      @number = number
      @velocity = velocity
    end

    def with(velocity:)
      Note.new(@number, velocity: velocity)
    end

    def self.name_for(number)
      octave = number / 12 - 1
      name = NOTE_NAMES[number % 12]
      "\#{name}\#{octave}"
    end
  end
end
`

const MIDI_PICO_ACTION = `
class MidiPico
  module Action
    class Keycode
      attr_reader :keycode

      def initialize(keycode)
        @keycode = keycode
      end
    end

    class Modifier
      attr_reader :modifier

      def initialize(modifier)
        @modifier = modifier
      end
    end
  end
end
`

const MIDI_PICO_NOTES = `
class MidiPico
  module Notes
    C2  = Note.new(36);  Cs2 = Note.new(37);  D2  = Note.new(38)
    Ds2 = Note.new(39);  E2  = Note.new(40);  F2  = Note.new(41)
    Fs2 = Note.new(42);  G2  = Note.new(43);  Gs2 = Note.new(44)
    A2  = Note.new(45);  As2 = Note.new(46);  B2  = Note.new(47)

    C3  = Note.new(48);  Cs3 = Note.new(49);  D3  = Note.new(50)
    Ds3 = Note.new(51);  E3  = Note.new(52);  F3  = Note.new(53)
    Fs3 = Note.new(54);  G3  = Note.new(55);  Gs3 = Note.new(56)
    A3  = Note.new(57);  As3 = Note.new(58);  B3  = Note.new(59)

    C4  = Note.new(60);  Cs4 = Note.new(61);  D4  = Note.new(62)
    Ds4 = Note.new(63);  E4  = Note.new(64);  F4  = Note.new(65)
    Fs4 = Note.new(66);  G4  = Note.new(67);  Gs4 = Note.new(68)
    A4  = Note.new(69);  As4 = Note.new(70);  B4  = Note.new(71)

    C5  = Note.new(72);  Cs5 = Note.new(73);  D5  = Note.new(74)
    Ds5 = Note.new(75);  E5  = Note.new(76);  F5  = Note.new(77)
    Fs5 = Note.new(78);  G5  = Note.new(79);  Gs5 = Note.new(80)
    A5  = Note.new(81);  As5 = Note.new(82);  B5  = Note.new(83)

    C6  = Note.new(84);  Cs6 = Note.new(85);  D6  = Note.new(86)
    Ds6 = Note.new(87);  E6  = Note.new(88);  F6  = Note.new(89)
    Fs6 = Note.new(90);  G6  = Note.new(91);  Gs6 = Note.new(92)
    A6  = Note.new(93);  As6 = Note.new(94);  B6  = Note.new(95)
  end
end
`

const MIDI_PICO_KEYCODES = `
class MidiPico
  module Keycodes
    KC_A     = Action::Keycode.new(0x04)
    KC_B     = Action::Keycode.new(0x05)
    KC_C     = Action::Keycode.new(0x06)
    KC_D     = Action::Keycode.new(0x07)
    KC_E     = Action::Keycode.new(0x08)
    KC_F     = Action::Keycode.new(0x09)
    KC_G     = Action::Keycode.new(0x0A)
    KC_H     = Action::Keycode.new(0x0B)
    KC_I     = Action::Keycode.new(0x0C)
    KC_J     = Action::Keycode.new(0x0D)
    KC_K     = Action::Keycode.new(0x0E)
    KC_L     = Action::Keycode.new(0x0F)
    KC_M     = Action::Keycode.new(0x10)
    KC_N     = Action::Keycode.new(0x11)
    KC_O     = Action::Keycode.new(0x12)
    KC_P     = Action::Keycode.new(0x13)
    KC_Q     = Action::Keycode.new(0x14)
    KC_R     = Action::Keycode.new(0x15)
    KC_S     = Action::Keycode.new(0x16)
    KC_T     = Action::Keycode.new(0x17)
    KC_U     = Action::Keycode.new(0x18)
    KC_V     = Action::Keycode.new(0x19)
    KC_W     = Action::Keycode.new(0x1A)
    KC_X     = Action::Keycode.new(0x1B)
    KC_Y     = Action::Keycode.new(0x1C)
    KC_Z     = Action::Keycode.new(0x1D)

    KC_1     = Action::Keycode.new(0x1E)
    KC_2     = Action::Keycode.new(0x1F)
    KC_3     = Action::Keycode.new(0x20)
    KC_4     = Action::Keycode.new(0x21)
    KC_5     = Action::Keycode.new(0x22)
    KC_6     = Action::Keycode.new(0x23)
    KC_7     = Action::Keycode.new(0x24)
    KC_8     = Action::Keycode.new(0x25)
    KC_9     = Action::Keycode.new(0x26)
    KC_0     = Action::Keycode.new(0x27)

    KC_ENTER = Action::Keycode.new(0x28)
    KC_ESC   = Action::Keycode.new(0x29)
    KC_BSPC  = Action::Keycode.new(0x2A)
    KC_TAB   = Action::Keycode.new(0x2B)
    KC_SPC   = Action::Keycode.new(0x2C)
    KC_MINUS = Action::Keycode.new(0x2D)
    KC_EQUAL = Action::Keycode.new(0x2E)
    KC_LBRC  = Action::Keycode.new(0x2F)
    KC_RBRC  = Action::Keycode.new(0x30)
    KC_BSLS  = Action::Keycode.new(0x31)
    KC_SCLN  = Action::Keycode.new(0x33)
    KC_QUOT  = Action::Keycode.new(0x34)
    KC_GRV   = Action::Keycode.new(0x35)
    KC_COMM  = Action::Keycode.new(0x36)
    KC_DOT   = Action::Keycode.new(0x37)
    KC_SLSH  = Action::Keycode.new(0x38)

    KC_F1    = Action::Keycode.new(0x3A)
    KC_F2    = Action::Keycode.new(0x3B)
    KC_F3    = Action::Keycode.new(0x3C)
    KC_F4    = Action::Keycode.new(0x3D)
    KC_F5    = Action::Keycode.new(0x3E)
    KC_F6    = Action::Keycode.new(0x3F)
    KC_F7    = Action::Keycode.new(0x40)
    KC_F8    = Action::Keycode.new(0x41)
    KC_F9    = Action::Keycode.new(0x42)
    KC_F10   = Action::Keycode.new(0x43)
    KC_F11   = Action::Keycode.new(0x44)
    KC_F12   = Action::Keycode.new(0x45)

    KC_RIGHT = Action::Keycode.new(0x4F)
    KC_LEFT  = Action::Keycode.new(0x50)
    KC_DOWN  = Action::Keycode.new(0x51)
    KC_UP    = Action::Keycode.new(0x52)
    KC_DEL   = Action::Keycode.new(0x4C)
    KC_HOME  = Action::Keycode.new(0x4A)
    KC_END   = Action::Keycode.new(0x4D)
    KC_PGUP  = Action::Keycode.new(0x4B)
    KC_PGDN  = Action::Keycode.new(0x4E)

    KC_LCTL  = Action::Modifier.new(0x01)
    KC_LSFT  = Action::Modifier.new(0x02)
    KC_LALT  = Action::Modifier.new(0x04)
    KC_LGUI  = Action::Modifier.new(0x08)
    KC_RCTL  = Action::Modifier.new(0x10)
    KC_RSFT  = Action::Modifier.new(0x20)
    KC_RALT  = Action::Modifier.new(0x40)
    KC_RGUI  = Action::Modifier.new(0x80)
  end
end
`

// ブラウザ用スタブ: add_layer のマッピングデータを収集し JS にエクスポートする
const MIDI_PICO_STUB = `
require 'js'

class MidiPico
  def initialize
    @layers = {}
  end

  def add_layer(name, mapping)
    entries = []
    mapping.each do |key, value|
      if key.is_a?(Array)
        # 和音はタイピングゲームでは使わないのでスキップ
      elsif key.is_a?(Note)
        entry = {
          noteNumber: key.number,
          noteName: Note.name_for(key.number),
        }
        if key.velocity.is_a?(Range)
          entry[:velocity] = [key.velocity.first, key.velocity.last]
        else
          entry[:velocity] = nil
        end
        if value.is_a?(Action::Keycode)
          entry[:type] = "keycode"
          entry[:hidCode] = value.keycode
        elsif value.is_a?(Action::Modifier)
          entry[:type] = "modifier"
          entry[:hidCode] = value.modifier
        end
        entries << entry
      end
    end
    @layers[name.to_s] = entries
  end

  def start!
    JS.global[:midiPicoKeymapData] = @layers
  end
end
`

/**
 * ユーザーの keymap.rb の先頭にスタブコードを追加した実行用 Ruby コードを生成する。
 * keymap.rb 内の `require 'midi_pico'` はスタブで代替されるため除去する。
 */
export function buildRubySource(keymapRb: string): string {
  const cleanedKeymap = keymapRb
    .split('\n')
    .filter(line => !line.match(/^\s*require\s+['"]midi_pico['"]/))
    .join('\n')

  return [
    MIDI_PICO_NOTE,
    MIDI_PICO_ACTION,
    MIDI_PICO_NOTES,
    MIDI_PICO_KEYCODES,
    MIDI_PICO_STUB,
    cleanedKeymap,
  ].join('\n')
}
