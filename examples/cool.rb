require 'scrimonia'
include Scrimonia::Notes # steep:ignore NoMethod
include Scrimonia::Keycodes # steep:ignore NoMethod

# 彩りダイアトニック（採用） / 37鍵 — 文字 + モーラ和音Macro + 修飾 + 空白/編集 + :num(トグル)
mp = Scrimonia.new
soft = 1..70
hard = 71..127
layer_num = Scrimonia::Action::LayerChange.new(:num, :switch)

mp.add_layer :default, {
  # 母音 (velocity判定なし・低音5音)
  C3   => KC_A,
  D3   => KC_I,
  E3   => KC_U,
  G3   => KC_E,
  A3   => KC_O,

  # 子音 (弱打=頻出 / 強打=低頻度・相乗り)
  C4   .with(velocity: soft) => KC_N,   # n
  C4   .with(velocity: hard) => KC_Z,   # z (低頻度)
  D4   .with(velocity: soft) => KC_K,   # k
  D4   .with(velocity: hard) => KC_B,   # b (低頻度)
  E4   .with(velocity: soft) => KC_T,   # t
  E4   .with(velocity: hard) => KC_P,   # p (低頻度)
  F4   .with(velocity: soft) => KC_S,   # s
  F4   .with(velocity: hard) => KC_J,   # j (低頻度)
  G4   .with(velocity: soft) => KC_R,   # r
  G4   .with(velocity: hard) => KC_F,   # f (低頻度)
  A4   .with(velocity: soft) => KC_H,   # h
  A4   .with(velocity: hard) => KC_C,   # c (低頻度)
  B4   .with(velocity: soft) => KC_M,   # m
  B4   .with(velocity: hard) => KC_V,   # v (低頻度)
  C5   .with(velocity: soft) => KC_Y,   # y
  C5   .with(velocity: hard) => KC_X,   # x (低頻度)
  D5   .with(velocity: soft) => KC_W,   # w
  D5   .with(velocity: hard) => KC_L,   # l (低頻度)
  E5   .with(velocity: soft) => KC_G,   # g
  E5   .with(velocity: hard) => KC_Q,   # q (低頻度)
  F5   => KC_D,
  G5   => KC_Z,
  A5   => KC_B,
  B5   => KC_P,

  # モーラ和音: 子音+母音を同時押し → 「子音→母音」の順で出力（弱打=頻出子音のみ）
  [C4.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("na"),
  [C4.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("ni"),
  [C4.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("nu"),
  [C4.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("ne"),
  [C4.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("no"),
  [D4.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("ka"),
  [D4.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("ki"),
  [D4.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("ku"),
  [D4.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("ke"),
  [D4.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("ko"),
  [E4.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("ta"),
  [E4.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("ti"),
  [E4.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("tu"),
  [E4.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("te"),
  [E4.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("to"),
  [F4.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("sa"),
  [F4.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("si"),
  [F4.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("su"),
  [F4.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("se"),
  [F4.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("so"),
  [G4.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("ra"),
  [G4.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("ri"),
  [G4.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("ru"),
  [G4.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("re"),
  [G4.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("ro"),
  [A4.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("ha"),
  [A4.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("hi"),
  [A4.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("hu"),
  [A4.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("he"),
  [A4.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("ho"),
  [B4.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("ma"),
  [B4.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("mi"),
  [B4.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("mu"),
  [B4.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("me"),
  [B4.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("mo"),
  [C5.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("ya"),
  [C5.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("yu"),
  [C5.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("yo"),
  [D5.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("wa"),
  [D5.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("wo"),
  [E5.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("ga"),
  [E5.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("gi"),
  [E5.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("gu"),
  [E5.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("ge"),
  [E5.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("go"),
  [F5.with(velocity: soft), C3] => Scrimonia::Action::Macro.new("da"),
  [F5.with(velocity: soft), D3] => Scrimonia::Action::Macro.new("di"),
  [F5.with(velocity: soft), E3] => Scrimonia::Action::Macro.new("du"),
  [F5.with(velocity: soft), G3] => Scrimonia::Action::Macro.new("de"),
  [F5.with(velocity: soft), A3] => Scrimonia::Action::Macro.new("do"),

  # 修飾キー (押している間だけ効く)
  Cs3  => KC_LCTL,   # Ctrl
  Ds3  => KC_LALT,   # Alt
  F3   => KC_LSFT,   # ⇧
  Fs3  => KC_LGUI,   # Gui

  # レイヤー(トグル) / 空白 / 編集
  Gs3  => layer_num,   # 押すたび :num をトグル
  As3  => KC_SPC,   # ␣
  B3   => KC_ENTER,   # ⏎
  Cs4  => KC_BSPC,   # ⌫
  Ds4  => KC_TAB,   # ⇥
  Fs4  => KC_ESC,   # Esc
  Gs4  => KC_DEL,   # Del

  # カーソル
  As4  => KC_LEFT,   # ←
  Cs5  => KC_DOWN,   # ↓
  Ds5  => KC_UP,   # ↑
  Fs5  => KC_RIGHT,   # →
}

# :num レイヤー — 123キーで default とトグル。不協和は無視。
mp.add_layer :num, {
  Gs3  => Scrimonia::Action::LayerChange.new(:default, :switch),   # もう一度押して文字へ戻る

  # 修飾は同位置に維持 (Shift+数字 で ! @ # …)
  Cs3  => KC_LCTL,   # Ctrl
  Ds3  => KC_LALT,   # Alt
  F3   => KC_LSFT,   # ⇧
  Fs3  => KC_LGUI,   # Gui

  # 数字 (音高が上がるほど 1..0)
  C4   => KC_1,   # 1
  D4   => KC_2,   # 2
  E4   => KC_3,   # 3
  F4   => KC_4,   # 4
  G4   => KC_5,   # 5
  A4   => KC_6,   # 6
  B4   => KC_7,   # 7
  C5   => KC_8,   # 8
  D5   => KC_9,   # 9
  E5   => KC_0,   # 0

  # 記号
  C3   => KC_DOT,   # .
  D3   => KC_COMM,   # ,
  E3   => KC_MINUS,   # -
  G3   => KC_SLSH,   # /
  A3   => KC_SCLN,   # ;
  G5   => KC_QUOT,   # '
  Gs5  => KC_LBRC,   # [
  A5   => KC_RBRC,   # ]
  As5  => KC_EQUAL,   # =
  B5   => KC_GRV,   # `
  C6   => KC_BSLS,   # \
}

mp.start!
