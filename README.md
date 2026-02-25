# midipico

USB MIDIキーボードを文字入力キーボードとして使うための変換装置。
Raspberry Pi Pico と PicoRuby で実装する。

## 概要

USB MIDIキーボードの演奏（ノートオン/オフ）をキー入力に変換し、PCにはUSB HIDキーボードとして認識させる。

```
USB MIDIキーボード → [PIO USB Host] → Raspberry Pi Pico → [ネイティブ USB Device] → PC
                                        (PicoRuby)
```

Pico 1台で実現する。RP2040 の PIO (Programmable I/O) を使ってソフトウェア USB Host ポートを追加し、ネイティブ USB ポートと合わせてデュアルポート構成を取る。

- **PIO USB (Host)**: MIDIキーボードを接続し、MIDI メッセージを受信する
- **ネイティブ USB (Device)**: PC に HID キーボードとして接続し、キー入力を送信する

## アーキテクチャ

### C層とRuby層の役割分担

低レベルの USB 通信は C で実装し、PicoRuby の picogem (C拡張) として公開する。
アプリケーションロジック（MIDIノートからキーコードへの変換）は Ruby で記述する。

**C層 (picogem)**:
- PIO USB Host の初期化 (`Pico-PIO-USB` + `TinyUSB`)
- マルチコア制御（Core1: USB Host タスク、Core0: USB Device タスク + PicoRuby VM）
- MIDI パケットの受信・パース
- HID キーボードレポートの送信

**Ruby層**:
- MIDI ノート → キーコードのマッピング定義
- レイヤー、修飾キー、和音などのロジック

### picogem の構成

```
mrbgems/picoruby-pio-usb-midi/
├── mrbgem.rake
├── include/
│   └── pio_usb_midi.h
├── src/
│   ├── pio_usb_midi.c           # VM ディスパッチャ
│   └── mrubyc/
│       └── pio_usb_midi.c       # mrbc_pio_usb_midi_init
├── ports/
│   └── rp2040/
│       └── pio_usb_midi.c       # PIO USB + TinyUSB 実装
└── mrblib/
    └── pio_usb_midi.rb
```

## ハードウェア

### 必要な部品

- Raspberry Pi Pico (RP2040)
- USB-A コネクタ（PIO USB Host ポート用）
- 22Ω 抵抗 × 2（D+/D- ライン用）
- 1.5kΩ 抵抗 × 1（D+ プルアップ用）

### 配線

PIO USB Host ポートとして GPIO 2本を使用する。D+ と D- は隣接する GPIO ピンである必要がある。

| 信号 | GPIO | 備考 |
|------|------|------|
| D+   | GP0  | 22Ω 直列抵抗経由で USB-A コネクタへ。1.5kΩ で 3.3V にプルアップ |
| D-   | GP1  | 22Ω 直列抵抗経由で USB-A コネクタへ |
| VBUS | VBUS | USB-A コネクタの VBUS に接続（5V 給電） |
| GND  | GND  | USB-A コネクタの GND に接続 |

### 制約

- システムクロックを 120MHz に設定する必要がある（PIO USB の要件）

## 依存ライブラリ

- [PicoRuby](https://github.com/picoruby/picoruby) — RP2040 向け Ruby 実装
- [Pico-PIO-USB](https://github.com/sekigon-gonnoc/Pico-PIO-USB) — PIO による USB Host/Device 実装
- [TinyUSB](https://github.com/hathach/tinyusb) — USB スタック（pico-sdk に同梱）

## 参考

- [PRK Firmware](https://github.com/picoruby/prk_firmware) — PicoRuby ベースのキーボードファームウェア。picogem の構成や USB HID の実装を参考にする
- [PicoPiUSBMidiHostDevice](https://github.com/paulhamsh/PicoPiUSBMidiHostDevice) — PIO USB による MIDI Host + Device のデュアルポート実装例
