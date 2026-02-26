# ファームウェアビルド設定
#
# このファイルは Stage 2 (cmake) と Stage 3 (build) を担当する。
# Stage 1 (libmruby) で生成済みの libmruby.a を前提としている。
#
# ビルドの流れ:
#   1. mrblib/*.rb を picorbc でバイトコード配列 (C ソース) に変換
#   2. src/*.c とPicoRuby gem のポートファイル (RP2040 向け HAL 実装) をコンパイル
#   3. 上記 + libmruby.a + pico-sdk + Pico-PIO-USB をリンクして .uf2 を生成

cmake_minimum_required(VERSION 3.24)

# pico-sdk / pico-extras のブートストラップ。
# 環境変数 PICO_SDK_PATH, PICO_EXTRAS_PATH で渡されたパスを使って SDK を初期化する。
include(pico_sdk_import.cmake)
include(pico_extras_import.cmake)

# build_config/ 下の .rb ファイル名と対応。libmruby のビルド出力パスに使う。
set(BUILD_CONFIG midipico-cortex-m0plus)
set(PICORUBY_ROOT ${CMAKE_SOURCE_DIR}/lib/picoruby)
set(PICO_PIO_USB_ROOT ${CMAKE_SOURCE_DIR}/lib/Pico-PIO-USB)
set(PICO_TINYUSB_PATH ${PICORUBY_ROOT}/mrbgems/picoruby-r2p2/lib/pico-sdk/lib/tinyusb)

# PICORB_VM_MRUBYC: picoruby.h が mruby/c VM 用のヘッダ・API を選択するために必要。
#                    未定義だと mruby VM 側が選ばれてしまう。
# PICORUBY_NO_MSC:   USB Mass Storage Class を無効化。msc_disk.c 全体をスキップする。
# PIO_USB_USE_TINYUSB: Pico-PIO-USB を TinyUSB 経由で使う (独自 API ではなく TinyUSB の Host API を利用)。
add_compile_definitions(
  PICORB_VM_MRUBYC=1
  PICORUBY_NO_MSC=1
  PIO_USB_USE_TINYUSB=1
)

project(midipico C CXX ASM)

pico_sdk_init()

# Pico-PIO-USB ライブラリ。pico_pio_usb INTERFACE ターゲットが使えるようになる。
add_subdirectory(${PICO_PIO_USB_ROOT} pico_pio_usb)

add_compile_options(-Wall
  -Wno-format
  -Wno-unused-function
  -Wno-maybe-uninitialized
  -fshort-enums
)

# --- ソースファイル収集 ---

file(GLOB SRCS src/*.c)

# PicoRuby gem のポートファイル: 各 gem の RP2040 向け HAL 実装 (GPIO操作、USB CDC 等)。
# build_config で有効にした gem に対応するものだけを列挙する。
# CONFIGURE_DEPENDS を指定すると、ファイル追加時に CMake が自動で再構成する。
file(GLOB PORT_FILES CONFIGURE_DEPENDS
  ${PICORUBY_ROOT}/mrbgems/picoruby-gpio/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-machine/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-machine/ports/common/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-io-console/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-env/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-filesystem-fat/ports/rp2040/*.c
)
# msc_disk.c は PICORUBY_MSC_FLASH か PICORUBY_MSC_SD が必要。
# このプロジェクトでは MSC 不要なので除外する (PICORUBY_NO_MSC で中身も空になる)。
list(FILTER PORT_FILES EXCLUDE REGEX "msc_disk\\.c$")

add_executable(${PROJECT_NAME}
  ${SRCS}
  ${PORT_FILES}
  # TinyUSB の PIO USB Host/Device コントローラドライバ
  ${PICO_TINYUSB_PATH}/src/portable/raspberrypi/pio_usb/hcd_pio_usb.c
  ${PICO_TINYUSB_PATH}/src/portable/raspberrypi/pio_usb/dcd_pio_usb.c
)

# --- Ruby → C バイトコード変換 ---
# picorbc は PicoRuby のバイトコードコンパイラ。
# .rb ファイルを「const uint8_t main_task[] = {...};」のような C 配列に変換する。
# 生成された .c は main.c から #include "main_task.c" で取り込まれる。

set(PICORBC ${PICORUBY_ROOT}/bin/picorbc)

add_custom_target(mrbdir ALL
  COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/mrb
)

set(RUBY_TASK_FILES main_task)
foreach(rb ${RUBY_TASK_FILES})
  add_custom_target(${rb}
    COMMAND ${PICORBC} -B${rb}
      -o${CMAKE_BINARY_DIR}/mrb/${rb}.c
      ${CMAKE_SOURCE_DIR}/mrblib/${rb}.rb
  )
endforeach(rb)

add_dependencies(${PROJECT_NAME}
  mrbdir
  ${RUBY_TASK_FILES}
)

# --- インクルードパス ---
target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_SOURCE_DIR}/tinyusb                                       # tusb_config.h (USB デバイス設定)
  ${CMAKE_BINARY_DIR}/mrb                                           # picorbc が生成した .c ファイル
  ${PICORUBY_ROOT}/include                                          # picoruby.h (VM 抽象化層)
  ${PICORUBY_ROOT}/build/${BUILD_CONFIG}/include                    # libmruby ビルドが生成したヘッダ
  ${PICORUBY_ROOT}/build/${BUILD_CONFIG}/mrbgems                    # picogem_init.c (gem 登録テーブル)
  ${PICORUBY_ROOT}/mrbgems/mruby-compiler2/include                 # mrc_common.h 等 (picoruby.h が参照)
  ${PICORUBY_ROOT}/mrbgems/mruby-compiler2/lib/prism/include       # Prism パーサ (コンパイラ依存)
  ${PICORUBY_ROOT}/mrbgems/picoruby-mrubyc/lib/mrubyc/src          # mruby/c VM のヘッダ
  ${PICORUBY_ROOT}/mrbgems/picoruby-machine/include                # hal.h (HAL 抽象層)
  ${PICORUBY_ROOT}/mrbgems/picoruby-filesystem-fat/lib/ff14b/source # FatFs ライブラリ
)

# Stage 1 で生成した libmruby.a の場所
target_link_directories(${PROJECT_NAME} PRIVATE
  ${PICORUBY_ROOT}/build/${BUILD_CONFIG}/lib
)

# --- リンクライブラリ ---
# picoruby-machine のポートファイルが多くの pico-sdk ハードウェアモジュールに依存するため、
# 実際に GPIO と USB CDC しか使っていなくても、これだけのライブラリが必要になる。
target_link_libraries(${PROJECT_NAME} PRIVATE
  pico_stdlib
  pico_unique_id
  pico_multicore
  pico_aon_timer
  pico_pio_usb        # Pico-PIO-USB (PIO ステートマシンによる USB ホスト実装)
  tinyusb_device
  tinyusb_host         # USB Host スタック (列挙、コールバック管理)
  hardware_gpio
  hardware_pio
  hardware_rosc
  hardware_rtc
  hardware_vreg
  hardware_sync
  hardware_irq
  hardware_clocks
  hardware_flash
  hardware_adc
  hardware_uart
  hardware_dma
  hardware_i2c
  hardware_spi
  hardware_pwm
  hardware_sleep
  mruby              # libmruby.a (mruby/c VM + 全 gem)
)

# .elf から .uf2 等の追加出力を生成する pico-sdk のヘルパー
pico_add_extra_outputs(${PROJECT_NAME})

# pico_stdio_usb 無効化: 内部で tusb_init() が Host スタックも初期化し、
# Core1 の PIO USB Host と競合するため。代わりに src/cdc_stdio.c で
# Device スタックのみ初期化するカスタムドライバを使う。
# pico_stdio_uart 無効化: デフォルトの UART0 (GP0/GP1) が PIO USB の
# D+/D- と同じピンで衝突するため。
pico_enable_stdio_usb(${PROJECT_NAME} 0)
pico_enable_stdio_uart(${PROJECT_NAME} 0)
