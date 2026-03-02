require 'midi_pico'

include MidiPico::Notes
include MidiPico::Keycodes

mp = MidiPico.new

# ピアノ鍵盤を QWERTY US 配列風にマッピングする。
# ベロシティで打ち分け: 弱打 = ホームロウ/トップロウ、強打 = ボトムロウ/数字ロウ
#
# 鍵盤配置 (E3 ~ G4 + 黒鍵):
#   黒鍵: Cs3 Ds3    Fs3 Gs3 As3  Cs4 Ds4    Fs4 Gs4 As4
#   白鍵:    E3  F3  G3  A3  B3  C4  D4  E4  F4  G4

soft = 1..60
hard = 61..127

mp.add_layer :default, {
  # --- 弱打 (velocity 1..60) ---

  # 白鍵 → ホームロウ (asdfghjkl;)
  E3.with(velocity: soft) => KC_A,
  F3.with(velocity: soft) => KC_S,
  G3.with(velocity: soft) => KC_D,
  A3.with(velocity: soft) => KC_F,
  B3.with(velocity: soft) => KC_G,
  C4.with(velocity: soft) => KC_H,
  D4.with(velocity: soft) => KC_J,
  E4.with(velocity: soft) => KC_K,
  F4.with(velocity: soft) => KC_L,
  G4.with(velocity: soft) => KC_SCLN,

  # 黒鍵 → トップロウ (qwertyuiop)
  Cs3.with(velocity: soft) => KC_Q,
  Ds3.with(velocity: soft) => KC_W,
  Fs3.with(velocity: soft) => KC_E,
  Gs3.with(velocity: soft) => KC_R,
  As3.with(velocity: soft) => KC_T,
  Cs4.with(velocity: soft) => KC_Y,
  Ds4.with(velocity: soft) => KC_U,
  Fs4.with(velocity: soft) => KC_I,
  Gs4.with(velocity: soft) => KC_O,
  As4.with(velocity: soft) => KC_P,

  # --- 強打 (velocity 61..127) ---

  # 白鍵 → ボトムロウ (zxcvbnm,./)
  E3.with(velocity: hard) => KC_Z,
  F3.with(velocity: hard) => KC_X,
  G3.with(velocity: hard) => KC_C,
  A3.with(velocity: hard) => KC_V,
  B3.with(velocity: hard) => KC_B,
  C4.with(velocity: hard) => KC_N,
  D4.with(velocity: hard) => KC_M,
  E4.with(velocity: hard) => KC_COMM,
  F4.with(velocity: hard) => KC_DOT,
  G4.with(velocity: hard) => KC_SLSH,

  # 黒鍵 → 数字ロウ (1234567890)
  Cs3.with(velocity: hard) => KC_1,
  Ds3.with(velocity: hard) => KC_2,
  Fs3.with(velocity: hard) => KC_3,
  Gs3.with(velocity: hard) => KC_4,
  As3.with(velocity: hard) => KC_5,
  Cs4.with(velocity: hard) => KC_6,
  Ds4.with(velocity: hard) => KC_7,
  Fs4.with(velocity: hard) => KC_8,
  Gs4.with(velocity: hard) => KC_9,
  As4.with(velocity: hard) => KC_0,

  # Modifiers
  C3 => KC_LCTL,
  D3 => KC_LALT,
}

mp.start!
