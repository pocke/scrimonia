# Keymap specification

Scrimoniaではキーマップを`keymap.rb`で定義する。
このドキュメントでは、`keymap.rb`で使える記法について説明する。

## Simple Example

```ruby
mp = Scrimonia.new

include Scrimonia::Notes
include Scrimonia::Keycodes

mp.add_layer :default, {
  # Notes to keys map
  C4 => KC_A, # Equivalent to Scrimonia::Note.new(60) => Scrimonia::Action::Keycode.new(:KC_A)
  D4 => KC_S,
  E4 => KC_D,
  F4 => KC_F,
  G4 => KC_G,
  A4 => KC_H,
  B4 => KC_J,

  # Notes to modifiers
  E3 => KC_LCTL,

  # Notes to layer changes
  C3 => Scrimonia::Action::LayerChange.new(:symbols, :hold),
  D3 => Scrimonia::Action::LayerChange.new(:qwerty, :switch),

  # With velocity
  C4.with(velocity: 1..50) => KC_Z, # Only triggers when velocity is between 1 and 50

  # Chord (order does not matter)
  [C4, E4, G4] => KC_X,

  # Notes to macros
  C5 => Scrimonia::Action::Macro.new("Hello, world!"),

  # Notes to Proc
  D5 => Proc.new { puts "Note D5 was played!" },

  # Notes to MIDI output (pass through as MIDI keyboard)
  C2 => C2,
}


mp.start!
```

## Scrimonia#start!

`start!`メソッドは、メインループを開始します。
MIDI受信、キーマップの評価、HIDレポートの送信を繰り返し実行します。
このメソッドは戻りません。

## Scrimonia#add_layer

`add_layer`メソッドは、レイヤーを追加します。

このメソッドは、レイヤー名と、ノートとアクションのマッピングを受け取ります。
マッピングは`Hash`で、キーがどのようなノートにマッチするか、値がどのようなアクションを実行するかを定義します。

### ノートマッチャの定義

ノートマッチャは`Scrimonia::Note`クラスのインスタンスか、その配列です。

`Scrimonia::Notes`モジュールを`include`すると、`C4`、`D4`等の定数が使えるようになります。
これらは`Scrimonia::Note.new(60)`等のショートハンドです。

* `Scrimonia::Note#with(velocity:)`メソッドで、マッチするベロシティの範囲を指定できます。
  * デフォルトではベロシティに関わらずマッチします。
  * 範囲を指定した場合、その範囲内のベロシティのノートにのみマッチします。
  * 1つのレイヤーに同じノートでベロシティが指定されているものとそうでないものがある場合、ベロシティが指定されているものが優先されます。
  * 1つのレイヤーに同じノートでベロシティの範囲が重なっているものがある場合、どちらが優先されるかは保証されません。そのような定義は避けるべきです。
* ノートマッチャの配列は、和音にマッチします。配列内のノートの順序は無関係です（内部的にソートされます）。

### アクションの定義

アクションは、`Scrimonia::Action`クラスのサブクラスのインスタンスです。

`Scrimonia::Keycodes`モジュールを`include`すると、`KC_A`、`KC_LCTL`等の定数が使えるようになります。
これらは`Scrimonia::Action::Keycode.new(:KC_A)`等のショートハンドです。

* `Scrimonia::Action::Keycode`は、キーストロークをシミュレートします。
* `Scrimonia::Action::LayerChange`は、レイヤーを切り替えます。
  * 切り替えの方法は、`:hold`と`:switch`の2種類があります。
  * `:hold`は、ノートがオンの間だけレイヤーを切り替えます。ノートがオフになると元のレイヤーに戻ります。
  * `:switch`は、ノートがオンになった時点でアクティブレイヤーを切り替えます。切り替え先のレイヤーにも`LayerChange`を定義しないと、元のレイヤーに戻れなくなるので注意してください。
* `Scrimonia::Action::Macro`は、マクロを実行します。
  * マクロは、文字列か、文字列の配列で定義します。
* `Proc`オブジェクトもアクションとして使用できます。
  * ノートがオンのときに呼び出されます。
* `Scrimonia::Note`オブジェクトもアクションとして使用できます。
  * PC側にMIDI出力として送信します。キーボード入力ではなく、MIDIキーボードとしてのパススルーに使えます。
