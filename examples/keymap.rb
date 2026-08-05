require 'scrimonia'

include Scrimonia::Notes # steep:ignore NoMethod
include Scrimonia::Keycodes # steep:ignore NoMethod

mp = Scrimonia.new

# ピアノ鍵盤を QWERTY US 配列風にマッピングする。
# ベロシティで打ち分け: 弱打 = ホームロウ/トップロウ、強打 = ボトムロウ/数字ロウ
#
# 鍵盤配置 (E3 ~ G4 + 黒鍵):
#   黒鍵: Cs3 Ds3    Fs3 Gs3 As3  Cs4 Ds4    Fs4 Gs4 As4
#   白鍵:    E3  F3  G3  A3  B3  C4  D4  E4  F4  G4

soft = 1..70
hard = 71..127

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
  C3.with(velocity: soft) => KC_LCTL,
  C3.with(velocity: hard) => KC_LALT,
  D3 => KC_LSFT,

  # Macro
  A4 => Scrimonia::Action::Macro.new("Hello, Scrimonia!"),

  [D4, E4] => KC_ESC,
  [B3, C4] => KC_SPC,
  C5.with(velocity: soft) => KC_BSPC,
  C5.with(velocity: hard) => KC_ENTER,

  # C3+Cs3+D3 同時押しで chord (ダイアトニックコード) レイヤーに切り替え。
  # 3レイヤーは default -> chord -> passthrough -> default のループ。
  [C3, Cs3, D3] => Scrimonia::Action::LayerChange.new(:chord, :switch),
}

# chord レイヤー: Cメジャーのダイアトニックコードでタイピングする。
# - 単音 (ルート) → ホームロウ (asdfghjkl) ※ example の default と同じ位置
# - 3和音 (ルート + 3rd + 5th) → トップロウ (qwertyuio)
# - 2和音 (ルート + 3rd) → ボトムロウ (zxcvbnm,.)
# - 黒鍵 → 数字ロウ (ベロシティ無視)
# - 「; の列」(G4 起点) は鍵盤の上端を超えるため未定義
mp.add_layer :chord, {
  # 単音 (ベース音) → ホームロウ
  E3 => KC_A,
  F3 => KC_S,
  G3 => KC_D,
  A3 => KC_F,
  B3 => KC_G,
  C4 => KC_H,
  D4 => KC_J,
  E4 => KC_K,
  F4 => KC_L,

  # 黒鍵 → 数字ロウ
  Cs3 => KC_1,
  Ds3 => KC_2,
  Fs3 => KC_3,
  Gs3 => KC_4,
  As3 => KC_5,
  Cs4 => KC_6,
  Ds4 => KC_7,
  Fs4 => KC_8,
  Gs4 => KC_9,
  As4 => KC_0,

  # 3和音 → トップロウ
  [E3, G3, B3] => KC_Q,  # Em
  [F3, A3, C4] => KC_W,  # F
  [G3, B3, D4] => KC_E,  # G
  [A3, C4, E4] => KC_R,  # Am
  [B3, D4, F4] => KC_T,  # Bdim
  [C4, E4, G4] => KC_Y,  # C
  [D4, F4, A4] => KC_U,  # Dm
  [E4, G4, B4] => KC_I,  # Em (1オクターブ上)
  [F4, A4, C5] => KC_O,  # F  (1オクターブ上)

  # 2和音 → ボトムロウ (3和音から 5th を抜いたルート+3rd)
  [E3, G3] => KC_Z,
  [F3, A3] => KC_X,
  [G3, B3] => KC_C,
  [A3, C4] => KC_V,
  [B3, D4] => KC_B,
  [C4, E4] => KC_N,
  [D4, F4] => KC_M,
  [E4, G4] => KC_COMM,
  [F4, A4] => KC_DOT,

  # C3+Cs3+D3 で passthrough レイヤーへ
  [C3, Cs3, D3] => Scrimonia::Action::LayerChange.new(:passthrough, :switch),
}

# パススルーレイヤー: 全ノートを MIDI としてそのまま出力する
passthrough_mapping = {} #: Hash[Scrimonia::layer_key, Scrimonia::layer_value]
# C2 (36) ~ B6 (95) の全ノートをパススルー
note_number = 48
while note_number <= 72
  n = Scrimonia::Note.new(note_number)
  passthrough_mapping[n] = n
  note_number += 1
end
# C3+Cs3+D3 同時押しで default レイヤーに戻る
passthrough_mapping[[C3, Cs3, D3]] = Scrimonia::Action::LayerChange.new(:default, :switch)

mp.add_layer :passthrough, passthrough_mapping

mp.start!
