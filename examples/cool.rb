require 'scrimonia'
include Scrimonia::Notes # steep:ignore NoMethod
include Scrimonia::Keycodes # steep:ignore NoMethod

# モーラ和音: 子音+母音を同時押し → 「子音→母音」の順で出力
def add_mora_chords(layer, soft)
  vowel_notes = { "a" => C3, "i" => D3, "u" => E3, "e" => G3, "o" => A3 }
  all_vowels = %w[a i u e o]
  mora_chords = [
    # 白鍵は弱打のときだけ和音になる
    [C4.with(velocity: soft), "n", all_vowels],
    [D4.with(velocity: soft), "k", all_vowels],
    [E4.with(velocity: soft), "t", all_vowels],
    [F4.with(velocity: soft), "s", all_vowels],
    [G4.with(velocity: soft), "r", all_vowels],
    [A4.with(velocity: soft), "h", all_vowels],
    [B4.with(velocity: soft), "m", all_vowels],
    [C5.with(velocity: soft), "y", %w[a u o]],
    [D5.with(velocity: soft), "w", %w[a o]],
    [E5.with(velocity: soft), "g", all_vowels],
    [F5.with(velocity: soft), "d", all_vowels],
    [G5.with(velocity: soft), "z", all_vowels],
    [A5.with(velocity: soft), "b", all_vowels],
    # 黒鍵の濁音・半濁音 (velocity 判定なし)
    [Cs4, "g", all_vowels],
    [Ds4, "d", all_vowels],
    [Fs4, "z", all_vowels],
    [Gs4, "b", all_vowels],
    [As4, "p", all_vowels],
  ] #: Array[[Scrimonia::Note, String, Array[String]]]

  mora_chords.each do |consonant_note, consonant, vowels|
    vowels.each do |vowel|
      layer[[consonant_note, vowel_notes[vowel] || raise("unknown vowel: #{vowel}")]] = Scrimonia::Action::Macro.new(consonant + vowel)
    end
  end
  layer
end

# 彩りダイアトニック（採用） / 37鍵 — 文字 + モーラ和音Macro + 修飾 + 空白/編集 + :num(トグル)
mp = Scrimonia.new
soft = 1..70
hard = 71..127
layer_num = Scrimonia::Action::LayerChange.new(:num, :switch)

mp.add_layer :default, add_mora_chords({
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

  # 濁音・半濁音: 清音の子音から半音ずらした黒鍵
  Cs4  => KC_G,   # g (k の半音下)
  Ds4  => KC_D,   # d (t の半音下)
  Fs4  => KC_Z,   # z (s の半音上)
  Gs4  => KC_B,   # b (h の半音下)
  As4  => KC_P,   # p (h の半音上)

  # 修飾キー (押している間だけ効く)
  Cs3  => KC_LCTL,   # Ctrl
  Ds3  => KC_LALT,   # Alt
  F3   => KC_LSFT,   # ⇧
  Fs3  => KC_LGUI,   # Gui

  # レイヤー(トグル) / 空白 / 編集
  Gs3  => layer_num,   # 押すたび :num をトグル
  As3  => KC_SPC,   # ␣
  B3   => KC_ENTER,   # ⏎
  B5   => KC_TAB,   # ⇥
  C6   => KC_BSPC,   # ⌫

  # カーソル
  Cs5  => KC_DOWN,   # ↓
  Ds5  => KC_UP,   # ↑
  Fs5  => KC_RIGHT,   # →
}, soft)

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
