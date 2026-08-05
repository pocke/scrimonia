
## ビルド

Rakefile にビルド用タスクが定義されている。ビルド時はこれらの rake タスクを使うこと。

### 初回セットアップ

```sh
rake setup
```

git submodule の初期化と依存ライブラリのインストールを行う。

### フルビルド

```sh
rake all
```

以下の3ステージを順に実行し、`build/scrimonia.uf2` を生成する:
1. `rake libmruby` — PicoRuby (mruby/c VM + gem) を ARM Cortex-M0+ 向けにクロスコンパイルして libmruby.a を生成
2. `rake cmake` — pico-sdk / pico-extras を使い CMake ビルドシステムを生成
3. `rake build` — C ソースと libmruby.a をリンクして .uf2 ファームウェアを生成

各ステージは個別にも実行できる。

### テスト

```sh
rake test
```

ホスト向け PicoRuby VM をビルドし、`test/` 以下を picotest で実行する。

### クリーン

```sh
rake clean       # ビルド成果物のクリーン
rake deep_clean  # libmruby の中間ファイルも含めた完全クリーン
```

## 他

プロジェクト構成を知るには README.md を読むこと。
