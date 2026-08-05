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
* `Scrimonia::Action::Macro`は、文字列をキーストロークとして自動入力します。
  * マクロは文字列で定義します。
  * 詳細は後述の「マクロ」を参照してください。
* `Proc`オブジェクトもアクションとして使用できます。
  * ノートがオンのときに呼び出されます。
* `Scrimonia::Note`オブジェクトもアクションとして使用できます。
  * PC側にMIDI出力として送信します。キーボード入力ではなく、MIDIキーボードとしてのパススルーに使えます。

## マクロ

`Scrimonia::Action::Macro`は、1つのノートに文字列を割り当て、ノートオン時にその文字列を1文字ずつキーストロークとして送信します。

```ruby
mp.add_layer :default, {
  C5 => Scrimonia::Action::Macro.new("Hello, world!"),
  D5 => Scrimonia::Action::Macro.new("def foo\n  \nend"),
  [C4, E4, G4] => Scrimonia::Action::Macro.new("chord macro"),
}
```

* 入力できるのはASCIIの範囲の文字です。大文字や`!`、`@`のようなShiftが必要な文字は自動的にShift付きで送信されます。
* `"\n"`はEnter、`"\t"`はTabとして送信されます。`"\r"`は読み飛ばされるため、`"\r\n"`と書いてもEnterは1回です。
* 上記以外の文字（全角文字、`"\e"`など）が含まれている場合、`Macro.new`が`ArgumentError`を投げます。キーマップの読み込みが失敗し、シリアルコンソールにエラーが出力されます。
* ノートオン時に1回だけ発火します。ノートを押しっぱなしにしてもリピートしません。
* ベロシティ条件付きのノートや和音にも割り当てられます。
* マクロ実行中に押されている修飾キーは、マクロのキーストロークには影響しません。

### キーボードレイアウト

文字からキーコードへの変換はUS配列を前提としています。
PC側のキーボードレイアウトがJIS配列に設定されている場合や、CapsLockがオンの場合は、意図と異なる文字が入力されます。これはデバイス側からは制御できません。

### マクロ実行中の制約

マクロ実行中、デバイスはMIDI入力を処理しません。
USB HIDのポーリング間隔が10msのため、1文字あたり約20msかかります。`"Hello, world!"`（13文字）で約260msです。

この間に演奏されたノートは、C層のリングバッファ（64イベント、約32打鍵ぶん）に保持され、マクロ完了後にまとめて処理されます。次の点に注意してください。

* バッファ内のイベントは受信時刻を持たないため、マクロ中に別々に弾かれたノートが和音として誤判定されることがあります。
* バッファが溢れた場合、新しいイベントから捨てられます。落ちるのはノートオフになりやすく、その場合PC側でキーが押されっぱなしになります。
* マクロを連打すると、押し直しのぶんだけマクロが積み上がります。最悪の場合32回ぶんが積まれ、8秒以上デバイスが応答しなくなります。

長い文字列のマクロや、マクロキーの連打は避けてください。
