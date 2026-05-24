# Scrimonia Typing Game

MIDIキーボードでのタイピングを練習するための静的Webアプリ。

Scrimonia が MIDI 入力を HID キーボード入力に変換するので、ブラウザにはただのキーボード入力として届く。このアプリは keymap.rb を読み込んで「どの鍵盤がどの文字に対応するか」を把握し、タイピング練習を提供する。

## セットアップ

```sh
cd typing_game
npm install
```

## 開発サーバーの起動

```sh
npm run dev
```

ブラウザで表示された URL（通常 http://localhost:5173）を開く。

## 使い方

1. ブラウザでアプリを開く
2. 自分の `keymap.rb`（`mrblib/main_task.rb` と同じ形式）をドラッグ&ドロップまたはファイル選択でアップロード
3. パースされたマッピングデータ（ノート名、ベロシティ条件、出力文字）がテーブルで表示される

## ビルド

```sh
npm run build
```

`dist/` ディレクトリに静的ファイルが生成される。

## 技術スタック

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) v4
- [@picoruby/wasm-wasi](https://www.npmjs.com/package/@picoruby/wasm-wasi) — keymap.rb のパースに使用

## アーキテクチャ

```
[MIDIキーボード] → [Scrimonia (Pico)] → [HIDキーボード入力] → [ブラウザ タイピングゲーム]
                                                                    ↑
                                                            keymap.rb アップロード
                                                            → PicoRuby.wasm でパース
                                                            → マッピングデータ取得
```

### keymap.rb のパース

PicoRuby.wasm を使って keymap.rb をブラウザ上で実行し、MIDI ノート → キーコードのマッピングデータを抽出する。

- `gems/picoruby-scrimonia/mrblib/` の Ruby 定義（Note, Action, Notes, Keycodes）をブラウザ用スタブとして TypeScript 文字列で保持
- `Scrimonia#add_layer` でマッピングデータを収集し、`Scrimonia#start!` で `JS.global` 経由で JavaScript に渡す
- Vite が `@picoruby/wasm-wasi` の `picoruby.js` と `picoruby.wasm` を自動的にビルド出力に含める
