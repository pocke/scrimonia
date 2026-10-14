require 'scrimonia'
include Scrimonia::Notes # steep:ignore NoMethod
include Scrimonia::Keycodes # steep:ignore NoMethod

# モーラ和音: 子音+母音を同時押し → 「子音→母音」の順で出力
def add_mora_chords(layer)
  vowel_notes = { "a" => C3, "i" => D3, "u" => E3, "e" => G3, "o" => A3 }
  all_vowels = %w[a i u e o]
  mora_chords = [
    [C4, "n", all_vowels],
    [D4, "k", all_vowels],
    [E4, "t", all_vowels],
    [F4, "s", all_vowels],
    [G4, "r", all_vowels],
    [A4, "h", all_vowels],
    [B4, "m", all_vowels],
    [C5, "y", %w[a u o]],
    [D5, "w", %w[a o]],
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

# 彩りダイアトニック（採用） / 37鍵 — 文字 + モーラ和音Macro + 修飾 + 空白/編集
mp = Scrimonia.new

mp.add_layer :default, add_mora_chords({
  # 母音 (低音5音)
  C3   => KC_A,
  D3   => KC_I,
  E3   => KC_U,
  G3   => KC_E,
  A3   => KC_O,

  # 子音
  C4   => KC_N,
  D4   => KC_K,
  E4   => KC_T,
  F4   => KC_S,
  G4   => KC_R,
  A4   => KC_H,
  B4   => KC_M,
  C5   => KC_Y,
  D5   => KC_W,

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

  # 空白 / 編集
  As3  => KC_SPC,   # ␣
  B3   => KC_ENTER,   # ⏎
  B5   => KC_TAB,   # ⇥
  C6   => KC_BSPC,   # ⌫

  # カーソル
  Cs5  => KC_DOWN,   # ↓
  Ds5  => KC_UP,   # ↑
  Fs5  => KC_RIGHT,   # →
})

mp.start!
